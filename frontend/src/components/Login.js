import React, { useState, useEffect } from 'react';
import { authAPI, setAuthToken, setCurrentUser } from '../services/api';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  // Password validation for registration
  useEffect(() => {
    if (!isLogin && formData.password) {
      validatePasswordStrength(formData.password);
    } else {
      setPasswordStrength(null);
      setPasswordErrors([]);
    }
  }, [formData.password, isLogin]);

  const validatePasswordStrength = async (password) => {
    if (password.length === 0) {
      setPasswordStrength(null);
      setPasswordErrors([]);
      return;
    }

    try {
      const response = await authAPI.validatePassword(password);
      if (response.success) {
        setPasswordStrength(response.data.strength);
        setPasswordErrors(response.data.errors);
      }
    } catch (error) {
      console.error('Password validation error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { username, password } = formData;
      
      if (!username || !password) {
        setError('Please fill in all fields');
        return;
      }

      // Additional validation for registration
      if (!isLogin && passwordErrors.length > 0) {
        setError('Please fix password requirements before registering');
        return;
      }

      let response;
      if (isLogin) {
        response = await authAPI.login(username, password);
      } else {
        response = await authAPI.register(username, password);
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
      setError(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const getStrengthColor = (level) => {
    switch (level) {
      case 'strong': return '#00ff41';
      case 'medium': return '#ffff00';
      default: return '#ff0040';
    }
  };

  return (
    <div className="auth-container">
      <div className="matrix-bg"></div>
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-buttons">
            <span className="btn-close"></span>
            <span className="btn-minimize"></span>
            <span className="btn-maximize"></span>
          </div>
          <div className="terminal-title">
            {isLogin ? 'SECURE_LOGIN.exe' : 'USER_REGISTRATION.exe'}
          </div>
        </div>
        
        <div className="terminal-body">
          <div className="ascii-art">
            {isLogin ? (
              <pre>{`
██╗  ██╗██████╗ ██╗███████╗██╗  ██╗███╗   ██╗ █████╗ 
██║ ██╔╝██╔══██╗██║██╔════╝██║  ██║████╗  ██║██╔══██╗
█████╔╝ ██████╔╝██║███████╗███████║██╔██╗ ██║███████║C
██╔═██╗ ██╔══██╗██║╚════██║██╔══██║██║╚██╗██║██╔══██║
██║  ██╗██║  ██║██║███████║██║  ██║██║ ╚████║██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
              `}</pre>
            ) : (
              <pre>{`
██████╗ ███████╗ ██████╗ ██╗███████╗████████╗███████╗██████╗ 
██╔══██╗██╔════╝██╔════╝ ██║██╔════╝╚══██╔══╝██╔════╝██╔══██╗
██████╔╝█████╗  ██║  ███╗██║███████╗   ██║   █████╗  ██████╔╝
██╔══██╗██╔══╝  ██║   ██║██║╚════██║   ██║   ██╔══╝  ██╔══██╗
██║  ██║███████╗╚██████╔╝██║███████║   ██║   ███████╗██║  ██║
╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
              `}</pre>
            )}
          </div>

          <div className="system-info">
            <div className="info-line">
              <span className="prompt">root@krishnacrypt:~$</span> 
              <span className="command">
                {isLogin ? 'authenticate --secure-tunnel' : 'create-user --encrypted-profile'}
              </span>
            </div>
            <div className="info-line">
              <span className="status">STATUS:</span> 
              <span className="status-text">SECURE CHANNEL ESTABLISHED</span>
            </div>
            <div className="info-line">
              <span className="status">ENCRYPTION:</span> 
              <span className="status-text">AES-256 + CUSTOM ALGORITHM</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="terminal-form">
            <div className="input-group">
              <label className="input-label">
                <span className="prompt">username@secure:</span>
              </label>
              <input
                type="text"
                name="username"
                placeholder="Enter username..."
                value={formData.username}
                onChange={handleInputChange}
                required
                minLength="3"
                maxLength="20"
                pattern="[a-zA-Z0-9_]+"
                className="terminal-input"
              />
            </div>
            
            <div className="input-group">
              <label className="input-label">
                <span className="prompt">password@secure:</span>
              </label>
              <div className="password-container">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter password..."
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={isLogin ? "6" : "8"}
                  className="terminal-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            {/* Password Strength Indicator for Registration */}
            {!isLogin && passwordStrength && (
              <div className="password-strength">
                <div className="strength-header">
                  <span>PASSWORD STRENGTH: </span>
                  <span 
                    className="strength-level"
                    style={{ color: getStrengthColor(passwordStrength.level) }}
                  >
                    {passwordStrength.level.toUpperCase()}
                  </span>
                </div>
                <div className="strength-bar">
                  <div 
                    className="strength-fill"
                    style={{ 
                      width: `${(passwordStrength.score / 8) * 100}%`,
                      backgroundColor: getStrengthColor(passwordStrength.level)
                    }}
                  ></div>
                </div>
                {passwordErrors.length > 0 && (
                  <div className="password-errors">
                    <div className="error-header">SECURITY REQUIREMENTS:</div>
                    {passwordErrors.map((error, index) => (
                      <div key={index} className="error-item">
                        <span className="error-bullet">×</span> {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="error-display">
                <div className="error-header">ERROR:</div>
                <div className="error-text">{error}</div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || (!isLogin && passwordErrors.length > 0)}
              className="terminal-button"
            >
              {loading ? (
                <span>
                  <span className="loading-spinner">⟳</span> PROCESSING...
                </span>
              ) : (
                <span>
                  {isLogin ? '🔓 AUTHENTICATE' : '🔐 CREATE ACCOUNT'}
                </span>
              )}
            </button>
          </form>

          <div className="auth-switch">
            <div className="switch-line">
              <span className="prompt">system@krishnacrypt:~$</span>
              <span className="switch-text">
                {isLogin ? 'Need access? ' : 'Already registered? '}
                <button 
                  type="button" 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setPasswordStrength(null);
                    setPasswordErrors([]);
                  }}
                  className="switch-button"
                >
                  {isLogin ? 'CREATE_ACCOUNT' : 'LOGIN_EXISTING'}
                </button>
              </span>
            </div>
          </div>

          <div className="security-notice">
            <div className="notice-line">
              <span className="warning">⚠️ SECURITY NOTICE:</span>
            </div>
            <div className="notice-line">
              • All communications are encrypted with custom algorithm
            </div>
            <div className="notice-line">
              • VPN-like secure tunneling active
            </div>
            <div className="notice-line">
              • Zero-knowledge authentication protocol
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
