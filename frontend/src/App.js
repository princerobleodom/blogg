import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);

  // Admin state
  const [adminData, setAdminData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loginAttempts, setLoginAttempts] = useState([]);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [postForm, setPostForm] = useState({ title: '', content: '', category: '', tags: '', featured_image: '' });
  const [commentForm, setCommentForm] = useState({ content: '' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser(token);
    }
    fetchPosts();
    fetchCategories();
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/posts`);
      if (searchTerm) url.searchParams.append('search', searchTerm);
      if (selectedCategory) url.searchParams.append('category', selectedCategory);

      const response = await fetch(url);
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminData(data);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchLoginAttempts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/login-attempts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLoginAttempts(data.login_attempts || []);
      }
    } catch (error) {
      console.error('Error fetching login attempts:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        setLoginForm({ email: '', password: '' });
        setCurrentView('home');
      } else {
        const error = await response.json();
        alert(error.detail || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        setRegisterForm({ name: '', email: '', password: '' });
        setCurrentView('home');
      } else {
        const error = await response.json();
        alert(error.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentView('home');
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...postForm,
          tags: postForm.tags.split(',').map(tag => tag.trim())
        })
      });
      
      if (response.ok) {
        setPostForm({ title: '', content: '', category: '', tags: '', featured_image: '' });
        fetchPosts();
        setCurrentView('home');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create post');
      }
    } catch (error) {
      console.error('Create post error:', error);
      alert('Failed to create post');
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/likes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: postId })
      });
      
      if (response.ok) {
        fetchPosts();
        if (selectedPost && selectedPost.id === postId) {
          fetchPost(postId);
        }
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          post_id: selectedPost.id,
          content: commentForm.content
        })
      });
      
      if (response.ok) {
        setCommentForm({ content: '' });
        fetchPost(selectedPost.id);
      }
    } catch (error) {
      console.error('Comment error:', error);
    }
  };

  const fetchPost = async (postId) => {
    try {
      const response = await fetch(`${API_URL}/api/posts/${postId}`);
      if (response.ok) {
        const post = await response.json();
        setSelectedPost(post);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
    }
  };

  const banUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/ban`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const unbanUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/unban`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        fetchAllUsers();
      }
    } catch (error) {
      console.error('Error unbanning user:', error);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (currentView === 'admin' && user?.is_admin) {
      fetchAdminData();
    }
  }, [currentView, user]);

  const renderHome = () => (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Billions Blog</h1>
            <nav className="flex items-center space-x-6">
              <button
                onClick={() => setCurrentView('home')}
                className="text-gray-700 hover:text-gray-900 transition-colors"
              >
                Home
              </button>
              {user ? (
                <>
                  <span className="text-gray-600">Welcome, {user.name}</span>
                  {user.is_admin && (
                    <>
                      <button
                        onClick={() => setCurrentView('admin')}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                      >
                        Admin Panel
                      </button>
                      <button
                        onClick={() => setCurrentView('create-post')}
                        className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                      >
                        Create Post
                      </button>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setCurrentView('login')}
                    className="text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setCurrentView('register')}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Register
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <div key={post.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                {post.featured_image && (
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{post.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-3">{post.content.substring(0, 150)}...</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">{post.category}</span>
                      <span className="text-sm text-gray-500">{post.like_count} likes</span>
                      <span className="text-sm text-gray-500">{post.comment_count} comments</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPost(post);
                        fetchPost(post.id);
                        setCurrentView('post');
                      }}
                      className="text-yellow-500 hover:text-yellow-600 font-medium"
                    >
                      Read More
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPost = () => (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentView('home')}
              className="text-yellow-500 hover:text-yellow-600 font-medium"
            >
              ← Back to Home
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Billions Blog</h1>
          </div>
        </div>
      </header>

      {selectedPost && (
        <div className="container mx-auto px-4 py-8">
          <article className="max-w-4xl mx-auto">
            {selectedPost.featured_image && (
              <img
                src={selectedPost.featured_image}
                alt={selectedPost.title}
                className="w-full h-64 object-cover rounded-lg mb-8"
              />
            )}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{selectedPost.title}</h1>
            <div className="flex items-center space-x-4 mb-8 text-gray-600">
              <span>By {selectedPost.author_name}</span>
              <span>•</span>
              <span>{selectedPost.category}</span>
              <span>•</span>
              <span>{new Date(selectedPost.created_at).toLocaleDateString()}</span>
            </div>
            <div className="prose max-w-none mb-8 text-gray-800 leading-relaxed">
              {selectedPost.content.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4">{paragraph}</p>
              ))}
            </div>
            
            {/* Like Button */}
            <div className="flex items-center space-x-4 mb-8">
              {user && (
                <button
                  onClick={() => handleLike(selectedPost.id)}
                  className="flex items-center space-x-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <span>❤️</span>
                  <span>Like ({selectedPost.like_count})</span>
                </button>
              )}
              <span className="text-gray-600">{selectedPost.like_count} likes</span>
            </div>

            {/* Comments Section */}
            <div className="border-t pt-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Comments ({selectedPost.comments?.length || 0})</h3>
              
              {user && (
                <form onSubmit={handleComment} className="mb-8">
                  <textarea
                    value={commentForm.content}
                    onChange={(e) => setCommentForm({...commentForm, content: e.target.value})}
                    placeholder="Write your comment..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    rows="4"
                    required
                  />
                  <button
                    type="submit"
                    className="mt-4 bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    Post Comment
                  </button>
                </form>
              )}

              <div className="space-y-6">
                {selectedPost.comments?.map(comment => (
                  <div key={comment.id} className="bg-gray-50 p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-gray-900">{comment.author_name}</span>
                      <span className="text-sm text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Login to Billions Blog</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
          >
            Login
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('register')}
            className="text-yellow-500 hover:text-yellow-600"
          >
            Don't have an account? Register
          </button>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => setCurrentView('home')}
            className="text-gray-500 hover:text-gray-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Join Billions Blog</h2>
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
          >
            Register
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('login')}
            className="text-yellow-500 hover:text-yellow-600"
          >
            Already have an account? Login
          </button>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => setCurrentView('home')}
            className="text-gray-500 hover:text-gray-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderCreatePost = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
            <button
              onClick={() => setCurrentView('home')}
              className="text-yellow-500 hover:text-yellow-600 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleCreatePost} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={postForm.title}
                onChange={(e) => setPostForm({...postForm, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <input
                type="text"
                value={postForm.category}
                onChange={(e) => setPostForm({...postForm, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="e.g., Technology, Fashion, Sports"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
              <input
                type="text"
                value={postForm.tags}
                onChange={(e) => setPostForm({...postForm, tags: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="e.g., tech, innovation, future"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image URL</label>
              <input
                type="url"
                value={postForm.featured_image}
                onChange={(e) => setPostForm({...postForm, featured_image: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea
                value={postForm.content}
                onChange={(e) => setPostForm({...postForm, content: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                rows="12"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-yellow-500 text-white py-3 px-4 rounded-lg hover:bg-yellow-600 transition-colors font-medium"
            >
              Create Post
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <button
              onClick={() => setCurrentView('home')}
              className="text-yellow-500 hover:text-yellow-600 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Menu</h3>
              <nav className="space-y-2">
                <button
                  onClick={() => {
                    setCurrentView('admin');
                    fetchAdminData();
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg transition-colors"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setCurrentView('admin-users');
                    fetchAllUsers();
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg transition-colors"
                >
                  Manage Users
                </button>
                <button
                  onClick={() => {
                    setCurrentView('admin-logins');
                    fetchLoginAttempts();
                  }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 rounded-lg transition-colors"
                >
                  Login Attempts
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {currentView === 'admin' && adminData && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-900">Total Users</h3>
                    <p className="text-3xl font-bold text-yellow-500">{adminData.stats.total_users}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-900">Total Posts</h3>
                    <p className="text-3xl font-bold text-yellow-500">{adminData.stats.total_posts}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-900">Total Comments</h3>
                    <p className="text-3xl font-bold text-yellow-500">{adminData.stats.total_comments}</p>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-900">Total Likes</h3>
                    <p className="text-3xl font-bold text-yellow-500">{adminData.stats.total_likes}</p>
                  </div>
                </div>

                {/* Recent Logins */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Login Attempts</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Email</th>
                          <th className="text-left py-2">IP Address</th>
                          <th className="text-left py-2">Time</th>
                          <th className="text-left py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.recent_logins.map(login => (
                          <tr key={login.id} className="border-b">
                            <td className="py-2">{login.email}</td>
                            <td className="py-2">{login.ip_address}</td>
                            <td className="py-2">{new Date(login.timestamp).toLocaleString()}</td>
                            <td className="py-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${login.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {login.success ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Popular Posts */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Posts</h3>
                  <div className="space-y-4">
                    {adminData.popular_posts.map(post => (
                      <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">{post.title}</h4>
                          <p className="text-sm text-gray-600">{post.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-900">{post.like_count} likes</p>
                          <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentView === 'admin-users' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">All Users</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Email</th>
                        <th className="text-left py-2">Role</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map(user => (
                        <tr key={user.id} className="border-b">
                          <td className="py-2">{user.name}</td>
                          <td className="py-2">{user.email}</td>
                          <td className="py-2">{user.is_admin ? 'Admin' : 'User'}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${user.is_banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {user.is_banned ? 'Banned' : 'Active'}
                            </span>
                          </td>
                          <td className="py-2">
                            {!user.is_admin && (
                              <button
                                onClick={() => user.is_banned ? unbanUser(user.id) : banUser(user.id)}
                                className={`px-3 py-1 rounded text-xs ${user.is_banned ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                              >
                                {user.is_banned ? 'Unban' : 'Ban'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentView === 'admin-logins' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Attempts</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Email</th>
                        <th className="text-left py-2">Password</th>
                        <th className="text-left py-2">IP Address</th>
                        <th className="text-left py-2">Time</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginAttempts.map(attempt => (
                        <tr key={attempt.id} className="border-b">
                          <td className="py-2">{attempt.email}</td>
                          <td className="py-2">{attempt.password || 'N/A'}</td>
                          <td className="py-2">{attempt.ip_address}</td>
                          <td className="py-2">{new Date(attempt.timestamp).toLocaleString()}</td>
                          <td className="py-2">{attempt.attempt_type}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${attempt.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {attempt.success ? 'Success' : 'Failed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render based on current view
  if (currentView === 'login') return renderLogin();
  if (currentView === 'register') return renderRegister();
  if (currentView === 'create-post') return renderCreatePost();
  if (currentView === 'post') return renderPost();
  if (currentView.startsWith('admin')) return renderAdmin();
  return renderHome();
}

export default App;