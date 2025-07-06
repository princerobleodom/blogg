from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
from datetime import datetime, timedelta
import jwt
import hashlib
import uuid
from pymongo import MongoClient
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Billions Blog API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()
SECRET_KEY = "billions-blog-secret-key-2025"
ALGORITHM = "HS256"

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/billions_blog")
client = MongoClient(MONGO_URL)
db = client.billions_blog

# Collections
users_collection = db.users
posts_collection = db.posts
comments_collection = db.comments
likes_collection = db.likes
login_attempts_collection = db.login_attempts

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PostCreate(BaseModel):
    title: str
    content: str
    category: str
    tags: List[str] = []
    featured_image: Optional[str] = None

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    featured_image: Optional[str] = None

class CommentCreate(BaseModel):
    post_id: str
    content: str

class LikeCreate(BaseModel):
    post_id: str

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_client_ip(request: Request):
    x_forwarded_for = request.headers.get('x-forwarded-for')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0]
    return request.client.host if request.client else "unknown"

# Initialize admin user if not exists
@app.on_event("startup")
async def startup_event():
    admin_email = "billionstheinvestor@gmail.com"
    admin_user = users_collection.find_one({"email": admin_email})
    if not admin_user:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password": hash_password("password"),
            "name": "Admin",
            "is_admin": True,
            "is_banned": False,
            "created_at": datetime.utcnow(),
            "last_login": None
        }
        users_collection.insert_one(admin_user)
        logger.info("Admin user created")

# Authentication endpoints
@app.post("/api/auth/register")
async def register(user_data: UserCreate, request: Request):
    # Check if user already exists
    existing_user = users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "is_admin": False,
        "is_banned": False,
        "created_at": datetime.utcnow(),
        "last_login": None
    }
    users_collection.insert_one(user)
    
    # Log registration attempt
    login_attempts_collection.insert_one({
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "attempt_type": "register",
        "success": True,
        "ip_address": get_client_ip(request),
        "timestamp": datetime.utcnow(),
        "user_agent": request.headers.get("user-agent", "")
    })
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "is_admin": False
        }
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin, request: Request):
    user = users_collection.find_one({"email": user_data.email})
    
    # Log login attempt (without password for security)
    login_attempt = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "attempt_type": "login",
        "success": False,
        "ip_address": get_client_ip(request),
        "timestamp": datetime.utcnow(),
        "user_agent": request.headers.get("user-agent", "")
    }
    
    if not user or not verify_password(user_data.password, user["password"]):
        login_attempts_collection.insert_one(login_attempt)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("is_banned", False):
        login_attempts_collection.insert_one(login_attempt)
        raise HTTPException(status_code=403, detail="Account is banned")
    
    # Update login attempt as successful
    login_attempt["success"] = True
    login_attempts_collection.insert_one(login_attempt)
    
    # Update last login
    users_collection.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    # Create token
    access_token = create_access_token(data={"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "is_admin": user.get("is_admin", False)
        }
    }

# User endpoints
@app.get("/api/users/me")
async def get_current_user_info(current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "is_admin": user.get("is_admin", False),
        "created_at": user["created_at"]
    }

# Blog post endpoints
@app.get("/api/posts")
async def get_posts(skip: int = 0, limit: int = 10, category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    
    posts = list(posts_collection.find(query).sort("created_at", -1).skip(skip).limit(limit))
    
    # Get like counts for each post
    for post in posts:
        like_count = likes_collection.count_documents({"post_id": post["id"]})
        comment_count = comments_collection.count_documents({"post_id": post["id"]})
        post["like_count"] = like_count
        post["comment_count"] = comment_count
        post.pop("_id", None)
    
    return {"posts": posts}

@app.get("/api/posts/{post_id}")
async def get_post(post_id: str):
    post = posts_collection.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get like count and comments
    like_count = likes_collection.count_documents({"post_id": post_id})
    comments = list(comments_collection.find({"post_id": post_id}).sort("created_at", -1))
    
    for comment in comments:
        comment.pop("_id", None)
    
    post["like_count"] = like_count
    post["comments"] = comments
    post.pop("_id", None)
    
    return post

@app.post("/api/posts")
async def create_post(post_data: PostCreate, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Only admins can create posts")
    
    post_id = str(uuid.uuid4())
    post = {
        "id": post_id,
        "title": post_data.title,
        "content": post_data.content,
        "category": post_data.category,
        "tags": post_data.tags,
        "featured_image": post_data.featured_image,
        "author_id": current_user_id,
        "author_name": user["name"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    posts_collection.insert_one(post)
    
    post.pop("_id", None)
    return post

@app.put("/api/posts/{post_id}")
async def update_post(post_id: str, post_data: PostUpdate, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Only admins can update posts")
    
    post = posts_collection.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    update_data = {k: v for k, v in post_data.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.utcnow()
    
    posts_collection.update_one({"id": post_id}, {"$set": update_data})
    
    updated_post = posts_collection.find_one({"id": post_id})
    updated_post.pop("_id", None)
    return updated_post

@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: str, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Only admins can delete posts")
    
    result = posts_collection.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Delete related comments and likes
    comments_collection.delete_many({"post_id": post_id})
    likes_collection.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted successfully"}

# Comment endpoints
@app.post("/api/comments")
async def create_comment(comment_data: CommentCreate, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_banned", False):
        raise HTTPException(status_code=403, detail="Account is banned")
    
    comment_id = str(uuid.uuid4())
    comment = {
        "id": comment_id,
        "post_id": comment_data.post_id,
        "content": comment_data.content,
        "author_id": current_user_id,
        "author_name": user["name"],
        "created_at": datetime.utcnow()
    }
    comments_collection.insert_one(comment)
    
    comment.pop("_id", None)
    return comment

@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    comment = comments_collection.find_one({"id": comment_id})
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Allow deletion if user is admin or comment author
    if not (user.get("is_admin", False) or comment["author_id"] == current_user_id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    comments_collection.delete_one({"id": comment_id})
    return {"message": "Comment deleted successfully"}

# Like endpoints
@app.post("/api/likes")
async def toggle_like(like_data: LikeCreate, current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_banned", False):
        raise HTTPException(status_code=403, detail="Account is banned")
    
    # Check if user already liked this post
    existing_like = likes_collection.find_one({
        "post_id": like_data.post_id,
        "user_id": current_user_id
    })
    
    if existing_like:
        # Unlike
        likes_collection.delete_one({"id": existing_like["id"]})
        return {"message": "Post unliked", "liked": False}
    else:
        # Like
        like_id = str(uuid.uuid4())
        like = {
            "id": like_id,
            "post_id": like_data.post_id,
            "user_id": current_user_id,
            "created_at": datetime.utcnow()
        }
        likes_collection.insert_one(like)
        return {"message": "Post liked", "liked": True}

@app.get("/api/likes/{post_id}/check")
async def check_like_status(post_id: str, current_user_id: str = Depends(get_current_user)):
    existing_like = likes_collection.find_one({
        "post_id": post_id,
        "user_id": current_user_id
    })
    return {"liked": existing_like is not None}

# Admin endpoints
@app.get("/api/admin/dashboard")
async def get_admin_dashboard(current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get statistics
    total_users = users_collection.count_documents({})
    total_posts = posts_collection.count_documents({})
    total_comments = comments_collection.count_documents({})
    total_likes = likes_collection.count_documents({})
    
    # Get recent login attempts
    recent_logins = list(login_attempts_collection.find().sort("timestamp", -1).limit(10))
    for login in recent_logins:
        login.pop("_id", None)
    
    # Get most liked posts
    pipeline = [
        {"$lookup": {
            "from": "likes",
            "localField": "id",
            "foreignField": "post_id",
            "as": "likes"
        }},
        {"$addFields": {"like_count": {"$size": "$likes"}}},
        {"$sort": {"like_count": -1}},
        {"$limit": 5}
    ]
    popular_posts = list(posts_collection.aggregate(pipeline))
    for post in popular_posts:
        post.pop("_id", None)
        post.pop("likes", None)
    
    return {
        "stats": {
            "total_users": total_users,
            "total_posts": total_posts,
            "total_comments": total_comments,
            "total_likes": total_likes
        },
        "recent_logins": recent_logins,
        "popular_posts": popular_posts
    }

@app.get("/api/admin/users")
async def get_all_users(current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = list(users_collection.find())
    for user in users:
        user.pop("_id", None)
        user.pop("password", None)  # Don't return passwords
    
    return {"users": users}

@app.put("/api/admin/users/{user_id}/ban")
async def ban_user(user_id: str, current_user_id: str = Depends(get_current_user)):
    admin_user = users_collection.find_one({"id": current_user_id})
    if not admin_user or not admin_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin", False):
        raise HTTPException(status_code=400, detail="Cannot ban admin users")
    
    users_collection.update_one({"id": user_id}, {"$set": {"is_banned": True}})
    return {"message": "User banned successfully"}

@app.put("/api/admin/users/{user_id}/unban")
async def unban_user(user_id: str, current_user_id: str = Depends(get_current_user)):
    admin_user = users_collection.find_one({"id": current_user_id})
    if not admin_user or not admin_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    users_collection.update_one({"id": user_id}, {"$set": {"is_banned": False}})
    return {"message": "User unbanned successfully"}

@app.get("/api/admin/login-attempts")
async def get_login_attempts(current_user_id: str = Depends(get_current_user)):
    user = users_collection.find_one({"id": current_user_id})
    if not user or not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    login_attempts = list(login_attempts_collection.find().sort("timestamp", -1).limit(50))
    for attempt in login_attempts:
        attempt.pop("_id", None)
    
    return {"login_attempts": login_attempts}

@app.get("/api/categories")
async def get_categories():
    categories = posts_collection.distinct("category")
    return {"categories": categories}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)