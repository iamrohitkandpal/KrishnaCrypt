import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import UserList from './components/UserList';
import Chat from './components/Chat';
import socketService from './services/socket';
import { getCurrentUser, removeAuthToken } from './services/api';
import api from './services/api';
import './index.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check for existing authentication
    const savedUser = getCurrentUser();
    const savedToken = localStorage.getItem('authToken');
    
    if (savedUser && savedToken) {
      console.log('🔑 Found saved authentication data, validating...');
      // Validate token by making a test API call
      api.get('/api/auth/me')
        .then(response => {
          if (response.data.success) {
            console.log('✅ Token is valid, connecting...');
            setCurrentUser(savedUser);
            setAuthToken(savedToken);
            connectSocket(savedToken);
          } else {
            throw new Error('Invalid token response');
          }
        })
        .catch(error => {
          console.log('❌ Token validation failed, clearing data:', error.message);
          removeAuthToken();
        });
    } else {
      console.log('ℹ️ No saved authentication data found');
    }

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Add connection health check
    const healthCheckInterval = setInterval(() => {
      if (currentUser && authToken && connectionStatus === 'connected') {
        // Ping the server to check connection health
        api.get('/health')
          .then(response => {
            if (!response.data.database) {
              console.warn('⚠️ Database connection issue detected');
            }
          })
          .catch(error => {
            console.warn('⚠️ Health check failed:', error.message);
            // Try to reconnect if health check fails
            if (connectionStatus === 'connected') {
              console.log('🔄 Attempting to reconnect due to health check failure...');
              connectSocket(authToken);
            }
          });
      }
    }, 30000); // Check every 30 seconds
    
    // Add visibility change handler for better connection management
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUser && authToken) {
        // When user comes back to the tab, check connection
        if (connectionStatus !== 'connected') {
          console.log('🔄 User returned to tab, checking connection...');
          connectSocket(authToken);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearInterval(healthCheckInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, authToken, connectionStatus]);

  // Connection attempt tracker
  const connectingRef = useRef(false);

  const connectSocket = async (token) => {
    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current) {
      console.log('🔄 Connection attempt already in progress, skipping...');
      return;
    }

    try {
      connectingRef.current = true;
      console.log('🔌 Starting socket connection process...');
      setConnectionStatus('connecting');
      
      // Validate token before attempting socket connection
      if (!token) {
        throw new Error('No authentication token provided');
      }
      
      console.log('🔑 Token found, attempting socket connection...');
      await socketService.connect(token);
      
      // Only update state if still mounting/mounted
      setConnectionStatus('connected');
      console.log('✅ Socket connection successful');
      
      // Setup socket event listeners (only once)
      const messageHandler = (event, data) => {
        switch (event) {
          case 'online_users':
            console.log('👥 Online users updated:', data.users);
            setOnlineUsers(data.users || []);
            break;
          case 'user_offline':
            console.log('👤 User went offline:', data);
            setOnlineUsers(prev => 
              prev.filter(user => user.id !== data.userId)
            );
            break;
          case 'room_joined':
            console.log('🏠 Joined room:', data);
            break;
          case 'new_message':
            console.log('💬 New message received');
            break;
          default:
            console.log('📡 Socket event:', event, data);
        }
      };

      const connectionHandler = (event, data) => {
        console.log('🔄 Socket connection event:', event, data);
        setConnectionStatus(event);
        
        // If reconnected, refresh friends list and online users
        if (event === 'connected' && data && !data.message?.includes('fallback')) {
          console.log('🔄 Reconnected, refreshing data...');
          socketService.getOnlineUsers();
        }
      };

      socketService.onMessage(messageHandler);
      socketService.onConnection(connectionHandler);

      // Request online users
      socketService.getOnlineUsers();
      
    } catch (error) {
      console.error('❌ Socket connection failed:', error);
      setConnectionStatus('error');
      
      // If authentication failed, clear stored data
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        console.log('🔄 Clearing invalid authentication data...');
        removeAuthToken();
        setCurrentUser(null);
        setAuthToken(null);
      }
    } finally {
      connectingRef.current = false;
    }
  };

  const handleLogin = async (user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    await connectSocket(token);
  };

  const handleLogout = () => {
    socketService.disconnect();
    removeAuthToken();
    setCurrentUser(null);
    setAuthToken(null);
    setSelectedUser(null);
    setOnlineUsers([]);
    setConnectionStatus('disconnected');
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleBackToUserList = () => {
    setSelectedUser(null);
  };

  // Show login if not authenticated
  if (!currentUser || !authToken) {
    return <Login onLogin={handleLogin} />;
  }

  // Mobile view logic
  if (isMobile) {
    if (selectedUser) {
      return (
        <div className="app">
          <div className="container">
            <div className="header">
              <h1>🔐 KrishnaCrypt</h1>
              <div className="subtitle">
                Status: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
            <Chat 
              currentUser={currentUser}
              selectedUser={selectedUser}
              onBack={handleBackToUserList}
            />
          </div>
        </div>
      );
    } else {
      return (
        <div className="app">
          <div className="container">
            <div className="header">
              <h1>🔐 KrishnaCrypt</h1>
              <div className="subtitle">
                Welcome, {currentUser.username} | Status: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
            <UserList 
              currentUser={currentUser}
              onUserSelect={handleUserSelect}
              selectedUser={selectedUser}
              onlineUsers={onlineUsers}
            />
          </div>
        </div>
      );
    }
  }

  // Desktop view
  return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1>🔐 KrishnaCrypt</h1>
          <div className="subtitle">
            Welcome, {currentUser.username} | Status: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="chat-container">
          <UserList 
            currentUser={currentUser}
            onUserSelect={handleUserSelect}
            selectedUser={selectedUser}
            onlineUsers={onlineUsers}
          />
          
          <Chat 
            currentUser={currentUser}
            selectedUser={selectedUser}
            onBack={handleBackToUserList}
          />
        </div>

        {/* Connection Status Indicator */}
        {connectionStatus !== 'connected' && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            background: connectionStatus === 'connecting' ? '#ffc107' : '#dc3545',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '6px',
            fontSize: '14px',
            zIndex: 1000
          }}>
            {connectionStatus === 'connecting' && '🔄 Connecting to secure tunnel...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected from server'}
            {connectionStatus === 'error' && '❌ Connection failed'}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
