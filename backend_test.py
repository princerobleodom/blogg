import requests
import unittest
import random
import string
import time
from datetime import datetime

class BillionsBlogAPITest(unittest.TestCase):
    """Test suite for Billions Blog API"""
    
    def setUp(self):
        """Set up test environment before each test method"""
        self.base_url = "https://120a56ef-6029-46a2-bdcf-0142479f4999.preview.emergentagent.com/api"
        self.admin_credentials = {
            "email": "billionstheinvestor@gmail.com",
            "password": "password"
        }
        self.test_user = {
            "name": f"Test User {self.random_string(5)}",
            "email": f"testuser_{self.random_string(5)}@example.com",
            "password": "TestPassword123!"
        }
        self.tokens = {}
        self.test_data = {}
    
    def random_string(self, length=8):
        """Generate a random string for test data"""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))
    
    def test_01_register_user(self):
        """Test user registration"""
        print(f"\n🔍 Testing user registration with {self.test_user['email']}...")
        
        response = requests.post(
            f"{self.base_url}/auth/register",
            json=self.test_user
        )
        
        self.assertEqual(response.status_code, 200, f"Registration failed: {response.text}")
        data = response.json()
        
        self.assertIn("access_token", data, "Token not found in response")
        self.assertIn("user", data, "User data not found in response")
        self.assertEqual(data["user"]["email"], self.test_user["email"], "Email mismatch")
        self.assertEqual(data["user"]["name"], self.test_user["name"], "Name mismatch")
        
        # Save token for later tests
        self.tokens["user"] = data["access_token"]
        print(f"✅ User registration successful")
    
    def test_02_login_admin(self):
        """Test admin login"""
        print(f"\n🔍 Testing admin login with {self.admin_credentials['email']}...")
        
        response = requests.post(
            f"{self.base_url}/auth/login",
            json=self.admin_credentials
        )
        
        self.assertEqual(response.status_code, 200, f"Admin login failed: {response.text}")
        data = response.json()
        
        self.assertIn("access_token", data, "Token not found in response")
        self.assertIn("user", data, "User data not found in response")
        self.assertTrue(data["user"]["is_admin"], "User is not admin")
        
        # Save token for later tests
        self.tokens["admin"] = data["access_token"]
        print(f"✅ Admin login successful")
    
    def test_03_create_post(self):
        """Test creating a blog post as admin"""
        print("\n🔍 Testing blog post creation...")
        
        if "admin" not in self.tokens:
            self.skipTest("Admin token not available")
        
        post_data = {
            "title": f"Test Post {self.random_string(5)}",
            "content": f"This is a test post content with some random text: {self.random_string(20)}",
            "category": "Test Category",
            "tags": ["test", "api", "blog"]
        }
        
        response = requests.post(
            f"{self.base_url}/posts",
            json=post_data,
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Post creation failed: {response.text}")
        data = response.json()
        
        self.assertIn("id", data, "Post ID not found in response")
        self.assertEqual(data["title"], post_data["title"], "Title mismatch")
        
        # Save post data for later tests
        self.test_data["post"] = data
        print(f"✅ Post creation successful with ID: {data['id']}")
    
    def test_04_get_posts(self):
        """Test fetching blog posts"""
        print("\n🔍 Testing fetching blog posts...")
        
        response = requests.get(f"{self.base_url}/posts")
        
        self.assertEqual(response.status_code, 200, f"Fetching posts failed: {response.text}")
        data = response.json()
        
        self.assertIn("posts", data, "Posts not found in response")
        self.assertIsInstance(data["posts"], list, "Posts is not a list")
        
        print(f"✅ Fetched {len(data['posts'])} posts successfully")
    
    def test_05_filter_posts_by_category(self):
        """Test filtering posts by category"""
        if "post" not in self.test_data:
            self.skipTest("Test post not available")
            
        category = self.test_data["post"]["category"]
        print(f"\n🔍 Testing filtering posts by category: {category}...")
        
        response = requests.get(f"{self.base_url}/posts?category={category}")
        
        self.assertEqual(response.status_code, 200, f"Filtering posts failed: {response.text}")
        data = response.json()
        
        self.assertIn("posts", data, "Posts not found in response")
        
        # Check if all returned posts have the specified category
        for post in data["posts"]:
            self.assertEqual(post["category"], category, f"Post category mismatch: {post['category']} != {category}")
        
        print(f"✅ Category filtering successful, found {len(data['posts'])} posts")
    
    def test_06_search_posts(self):
        """Test searching posts by title"""
        if "post" not in self.test_data:
            self.skipTest("Test post not available")
            
        search_term = self.test_data["post"]["title"].split()[0]
        print(f"\n🔍 Testing searching posts with term: {search_term}...")
        
        response = requests.get(f"{self.base_url}/posts?search={search_term}")
        
        self.assertEqual(response.status_code, 200, f"Searching posts failed: {response.text}")
        data = response.json()
        
        self.assertIn("posts", data, "Posts not found in response")
        
        # Check if any returned post contains the search term in the title
        found = False
        for post in data["posts"]:
            if search_term.lower() in post["title"].lower():
                found = True
                break
        
        self.assertTrue(found, f"No posts found with search term '{search_term}' in title")
        print(f"✅ Search successful, found {len(data['posts'])} matching posts")
    
    def test_07_get_single_post(self):
        """Test fetching a single post"""
        if "post" not in self.test_data:
            self.skipTest("Test post not available")
            
        post_id = self.test_data["post"]["id"]
        print(f"\n🔍 Testing fetching single post with ID: {post_id}...")
        
        response = requests.get(f"{self.base_url}/posts/{post_id}")
        
        self.assertEqual(response.status_code, 200, f"Fetching post failed: {response.text}")
        data = response.json()
        
        self.assertEqual(data["id"], post_id, "Post ID mismatch")
        self.assertEqual(data["title"], self.test_data["post"]["title"], "Post title mismatch")
        
        print(f"✅ Successfully fetched post: {data['title']}")
    
    def test_08_add_comment(self):
        """Test adding a comment to a post"""
        if "post" not in self.test_data or "user" not in self.tokens:
            self.skipTest("Test post or user token not available")
            
        post_id = self.test_data["post"]["id"]
        print(f"\n🔍 Testing adding comment to post ID: {post_id}...")
        
        comment_data = {
            "post_id": post_id,
            "content": f"This is a test comment: {self.random_string(10)}"
        }
        
        response = requests.post(
            f"{self.base_url}/comments",
            json=comment_data,
            headers={"Authorization": f"Bearer {self.tokens['user']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Adding comment failed: {response.text}")
        data = response.json()
        
        self.assertIn("id", data, "Comment ID not found in response")
        self.assertEqual(data["post_id"], post_id, "Post ID mismatch")
        self.assertEqual(data["content"], comment_data["content"], "Comment content mismatch")
        
        # Save comment data for later tests
        self.test_data["comment"] = data
        print(f"✅ Comment added successfully with ID: {data['id']}")
    
    def test_09_toggle_like(self):
        """Test toggling like on a post"""
        if "post" not in self.test_data or "user" not in self.tokens:
            self.skipTest("Test post or user token not available")
            
        post_id = self.test_data["post"]["id"]
        print(f"\n🔍 Testing toggling like on post ID: {post_id}...")
        
        like_data = {
            "post_id": post_id
        }
        
        # Like the post
        response = requests.post(
            f"{self.base_url}/likes",
            json=like_data,
            headers={"Authorization": f"Bearer {self.tokens['user']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Liking post failed: {response.text}")
        data = response.json()
        
        self.assertIn("liked", data, "Like status not found in response")
        self.assertTrue(data["liked"], "Post was not liked")
        
        print(f"✅ Post liked successfully")
        
        # Check like status
        response = requests.get(
            f"{self.base_url}/likes/{post_id}/check",
            headers={"Authorization": f"Bearer {self.tokens['user']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Checking like status failed: {response.text}")
        data = response.json()
        
        self.assertIn("liked", data, "Like status not found in response")
        self.assertTrue(data["liked"], "Like status is incorrect")
        
        print(f"✅ Like status check successful")
        
        # Unlike the post
        response = requests.post(
            f"{self.base_url}/likes",
            json=like_data,
            headers={"Authorization": f"Bearer {self.tokens['user']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Unliking post failed: {response.text}")
        data = response.json()
        
        self.assertIn("liked", data, "Like status not found in response")
        self.assertFalse(data["liked"], "Post was not unliked")
        
        print(f"✅ Post unliked successfully")
    
    def test_10_admin_dashboard(self):
        """Test admin dashboard"""
        if "admin" not in self.tokens:
            self.skipTest("Admin token not available")
            
        print("\n🔍 Testing admin dashboard...")
        
        response = requests.get(
            f"{self.base_url}/admin/dashboard",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Fetching admin dashboard failed: {response.text}")
        data = response.json()
        
        self.assertIn("stats", data, "Stats not found in response")
        self.assertIn("recent_logins", data, "Recent logins not found in response")
        self.assertIn("popular_posts", data, "Popular posts not found in response")
        
        print(f"✅ Admin dashboard fetched successfully")
    
    def test_11_admin_get_users(self):
        """Test admin getting all users"""
        if "admin" not in self.tokens:
            self.skipTest("Admin token not available")
            
        print("\n🔍 Testing admin getting all users...")
        
        response = requests.get(
            f"{self.base_url}/admin/users",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Fetching users failed: {response.text}")
        data = response.json()
        
        self.assertIn("users", data, "Users not found in response")
        self.assertIsInstance(data["users"], list, "Users is not a list")
        
        # Find our test user
        test_user_found = False
        for user in data["users"]:
            if user["email"] == self.test_user["email"]:
                test_user_found = True
                self.test_data["user_id"] = user["id"]
                break
        
        self.assertTrue(test_user_found, f"Test user {self.test_user['email']} not found in users list")
        print(f"✅ Successfully fetched {len(data['users'])} users")
    
    def test_12_admin_ban_user(self):
        """Test admin banning a user"""
        if "admin" not in self.tokens or "user_id" not in self.test_data:
            self.skipTest("Admin token or user ID not available")
            
        user_id = self.test_data["user_id"]
        print(f"\n🔍 Testing banning user with ID: {user_id}...")
        
        response = requests.put(
            f"{self.base_url}/admin/users/{user_id}/ban",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Banning user failed: {response.text}")
        
        # Verify user is banned
        response = requests.get(
            f"{self.base_url}/admin/users",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        data = response.json()
        for user in data["users"]:
            if user["id"] == user_id:
                self.assertTrue(user["is_banned"], "User was not banned")
                break
        
        print(f"✅ User banned successfully")
    
    def test_13_admin_unban_user(self):
        """Test admin unbanning a user"""
        if "admin" not in self.tokens or "user_id" not in self.test_data:
            self.skipTest("Admin token or user ID not available")
            
        user_id = self.test_data["user_id"]
        print(f"\n🔍 Testing unbanning user with ID: {user_id}...")
        
        response = requests.put(
            f"{self.base_url}/admin/users/{user_id}/unban",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Unbanning user failed: {response.text}")
        
        # Verify user is unbanned
        response = requests.get(
            f"{self.base_url}/admin/users",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        data = response.json()
        for user in data["users"]:
            if user["id"] == user_id:
                self.assertFalse(user["is_banned"], "User was not unbanned")
                break
        
        print(f"✅ User unbanned successfully")
    
    def test_14_admin_login_attempts(self):
        """Test admin viewing login attempts"""
        if "admin" not in self.tokens:
            self.skipTest("Admin token not available")
            
        print("\n🔍 Testing admin viewing login attempts...")
        
        response = requests.get(
            f"{self.base_url}/admin/login-attempts",
            headers={"Authorization": f"Bearer {self.tokens['admin']}"}
        )
        
        self.assertEqual(response.status_code, 200, f"Fetching login attempts failed: {response.text}")
        data = response.json()
        
        self.assertIn("login_attempts", data, "Login attempts not found in response")
        self.assertIsInstance(data["login_attempts"], list, "Login attempts is not a list")
        
        print(f"✅ Successfully fetched {len(data['login_attempts'])} login attempts")
    
    def test_15_get_categories(self):
        """Test getting categories"""
        print("\n🔍 Testing getting categories...")
        
        response = requests.get(f"{self.base_url}/categories")
        
        self.assertEqual(response.status_code, 200, f"Fetching categories failed: {response.text}")
        data = response.json()
        
        self.assertIn("categories", data, "Categories not found in response")
        self.assertIsInstance(data["categories"], list, "Categories is not a list")
        
        print(f"✅ Successfully fetched {len(data['categories'])} categories")

if __name__ == "__main__":
    # Run tests in order
    unittest.main(argv=['first-arg-is-ignored'], exit=False)