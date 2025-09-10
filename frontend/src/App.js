import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import UserList from './components/UserList';
import Chat from './components/Chat';
import socketService from './services/socket';
import { getCurrentUser, removeAuthToken } from './services/api';
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
      setCurrentUser(savedUser);
      setAuthToken(savedToken);
      connectSocket(savedToken);
    }

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const connectSocket = async (token) => {
    try {
      setConnectionStatus('connecting');
      await socketService.connect(token);
      setConnectionStatus('connected');
      
      // Setup socket event listeners
      socketService.onMessage((event, data) => {
        switch (event) {
          case 'online_users':
            setOnlineUsers(data.users || []);
            break;
          case 'user_offline':
            setOnlineUsers(prev => 
              prev.filter(user => user.userId !== data.userId)
            );
            break;
          default:
            break;
        }
      });

      socketService.onConnection((event, data) => {
        setConnectionStatus(event);
      });

      // Request online users
      socketService.getOnlineUsers();
      
    } catch (error) {
      console.error('Socket connection failed:', error);
      setConnectionStatus('error');
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
