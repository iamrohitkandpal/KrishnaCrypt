import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const UserList = ({ currentUser, onUserSelect, selectedUser, onlineUsers = [] }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // Update online status when onlineUsers prop changes
    if (onlineUsers.length > 0) {
      setUsers(prevUsers => 
        prevUsers.map(user => ({
          ...user,
          isOnline: onlineUsers.some(onlineUser => onlineUser.userId === user.id)
        }))
      );
    }
  }, [onlineUsers]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUsers();
      
      if (response.success) {
        setUsers(response.data.users);
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user) => {
    onUserSelect(user);
  };

  const getUserInitials = (username) => {
    return username.charAt(0).toUpperCase();
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeenDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Users</h3>
          <p>Loading...</p>
        </div>
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Users</h3>
          <p>Error loading users</p>
        </div>
        <div className="error" style={{ margin: '20px' }}>{error}</div>
        <button 
          className="btn btn-primary" 
          onClick={fetchUsers}
          style={{ margin: '0 20px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Users ({users.length})</h3>
        <p>Select a user to start chatting</p>
      </div>

      <div className="user-list">
        {users.length === 0 ? (
          <div className="empty-state">
            <h3>No other users</h3>
            <p>Invite someone to join KrishnaCrypt!</p>
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user._id}
              className={`user-item ${selectedUser?._id === user._id ? 'active' : ''}`}
              onClick={() => handleUserClick(user)}
            >
              <div className="user-avatar">
                {getUserInitials(user.username)}
              </div>
              
              <div className="user-info">
                <h4>{user.username}</h4>
                <div className="user-status">
                  {user.isOnline ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`}
                </div>
              </div>
              
              {user.isOnline && <div className="online-indicator" />}
            </button>
          ))
        )}
      </div>

      <div style={{ 
        padding: '15px 20px', 
        borderTop: '1px solid #e1e1e1', 
        fontSize: '12px', 
        color: '#666',
        background: 'white'
      }}>
        <p>🔒 All messages are encrypted</p>
        <p>🛡️ Secure tunneling active</p>
      </div>
    </div>
  );
};

export default UserList;
