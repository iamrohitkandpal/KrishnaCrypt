import React, { useState } from 'react';
import { authAPI, setAuthToken, setCurrentUser } from '../services/api';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let response;
      
      if (isLogin) {
        response = await authAPI.login(formData.username, formData.password);
      } else {
        response = await authAPI.register(formData.username, formData.password);
        setSuccess('Registration successful! You can now login.');
        setIsLogin(true);
        setFormData({ username: '', password: '' });
        setLoading(false);
        return;
      }

      if (response.success) {
        setAuthToken(response.data.token);
        setCurrentUser(response.data.user);
        onLogin(response.data.user, response.data.token);
      } else {
        setError(response.message || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(
        error.response?.data?.message || 
        error.message || 
        'Network error. Please check if the server is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setFormData({ username: '', password: '' });
  };

  return (
    <div className="app">
      <div className="container auth-container">
        <div className="header">
          <h1>🔐 KrishnaCrypt</h1>
          <p className="subtitle">Secure Tunneling Chat Application</p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <h2>{isLogin ? 'Login' : 'Register'}</h2>
          
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              disabled={loading}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleMode}
            disabled={loading}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </form>

        <div style={{ marginTop: '30px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
          <p>🔒 End-to-end encrypted messaging</p>
          <p>🛡️ Custom lightweight encryption algorithm</p>
          <p>🔐 Secure VPN-like tunneling</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
