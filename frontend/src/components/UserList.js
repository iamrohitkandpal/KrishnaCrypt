import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';

import './UserList.css';

const UserList = ({ currentUser, onUserSelect, selectedUser, onlineUsers = [] }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addFriendSecretId, setAddFriendSecretId] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [addFriendError, setAddFriendError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [addFriendSuccess, setAddFriendSuccess] = useState(false);
  const [openSections, setOpenSections] = useState({
    profile: true,
    addFriend: false,
    friendsList: true
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    fetchFriends();
    
    // Set up periodic refresh of friends list every 30 seconds
    const refreshInterval = setInterval(() => {
      if (!loading) {
        fetchFriends();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Update online status when onlineUsers prop changes
    if (onlineUsers.length > 0) {
      setFriends(prevFriends =>
        prevFriends.map(friend => ({
          ...friend,
          isOnline: onlineUsers.some(onlineUser => onlineUser.id === friend.id)
        }))
      );
    }
  }, [onlineUsers]);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching friends list...');
      const response = await authAPI.getUsers();
      console.log('📋 Friends API response:', response);

      if (response.success) {
        // Map the MongoDB friends data to the frontend format
        const allFriends = (response.data.friends || []).map(friend => ({
          id: friend.id || friend._id, // Support both id and _id
          username: friend.username,
          isOnline: friend.isOnline || false,
          lastSeen: friend.lastSeen
        }));
        console.log('👥 All friends from API:', allFriends);
        
        const filteredFriends = allFriends.filter(friend => 
          friend.id && friend.id !== currentUser?.id
        );
        
        console.log('✅ Filtered friends:', filteredFriends);
        setFriends(filteredFriends);
        setError('');
      } else {
        console.error('❌ Friends API returned error:', response);
        setError('Failed to fetch friends');
      }
    } catch (error) {
      console.error('❌ Error fetching friends:', error);
      setError('Network error while fetching friends');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (friend) => {
    onUserSelect(friend);
  };

  const handleCopySecretId = async () => {
    try {
      await navigator.clipboard.writeText(currentUser.secretId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (error) {
      console.error('Failed to copy secret ID:', error);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!addFriendSecretId.trim()) return;

    setAddFriendLoading(true);
    setAddFriendError('');
    setAddFriendSuccess(false);

    try {
      console.log('➕ Adding friend with secret ID:', addFriendSecretId.trim());
      const response = await authAPI.addFriend(addFriendSecretId.trim());
      console.log('📋 Add friend API response:', response);

      if (response.success) {
        console.log('✅ Friend added successfully:', response.data.friend);
        setAddFriendSecretId('');
        setAddFriendSuccess(true);
        setTimeout(() => setAddFriendSuccess(false), 3000);
        // Refresh friends list
        console.log('🔄 Refreshing friends list after adding friend...');
        await fetchFriends();
      } else {
        console.error('❌ Add friend API returned error:', response);
        setAddFriendError(response.message || 'Failed to add friend');
      }
    } catch (error) {
      console.error('❌ Error adding friend:', error);
      setAddFriendError(error.response?.data?.message || 'Failed to add friend');
    } finally {
      setAddFriendLoading(false);
    }
  };

  const getUserInitials = (username) => {
    return username.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>FRIENDS TERMINAL</h3>
          <div className="loading-terminal">
            <div className="terminal-line">
              <span className="prompt">&gt;</span>
              <span className="command">fetching_friends.exe</span>
            </div>
            <div className="terminal-line">
              <span className="status">STATUS:</span>
              <span className="status-text">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>FRIENDS TERMINAL</h3>
          <div className="error-terminal">
            <div className="terminal-line">
              <span className="prompt">&gt;</span>
              <span className="command">fetch_friends_error</span>
            </div>
            <div className="terminal-line">
              <span className="error-text">{error}</span>
            </div>
          </div>
        </div>
        <div className="terminal-actions">
          <button
            className="terminal-btn retry-btn"
            onClick={fetchFriends}
          >
            <span className="btn-icon">🔄</span>
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>FRIENDS TERMINAL</h3>
        <div className="terminal-line">
          <button
            onClick={fetchFriends}
            disabled={loading}
            className="terminal-btn refresh-btn"
            style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
          >
            <span className="btn-icon">🔄</span>
            {loading ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Profile Section */}
        <div className="accordion-section">
          <button 
            className="accordion-header" 
            onClick={() => toggleSection('profile')}
          >
            <span className="section-icon">🔑</span>
            <span className="section-title">MY PROFILE</span>
            <span className={`arrow ${openSections.profile ? 'open' : ''}`}>▼</span>
          </button>
          
          {openSections.profile && (
            <div className="accordion-content">
              <div className="secret-id-display">
                <input
                  type="text"
                  value={currentUser.secretId}
                  readOnly
                  className="terminal-input secret-input"
                />
                <button
                  onClick={handleCopySecretId}
                  className={`terminal-btn copy-btn ${copySuccess ? 'success' : ''}`}
                  disabled={copySuccess}
                >
                  <span className="btn-icon">
                    {copySuccess ? '✅' : '📋'}
                  </span>
                  {copySuccess ? 'COPIED!' : 'COPY'}
                </button>
              </div>
              <div className="terminal-line small">
                <span className="info-text">Share this ID to connect with friends</span>
              </div>
            </div>
          )}
        </div>

        {/* Add Friend Section */}
        <div className="accordion-section">
          <button 
            className="accordion-header" 
            onClick={() => toggleSection('addFriend')}
          >
            <span className="section-icon">👥</span>
            <span className="section-title">ADD FRIEND</span>
            <span className={`arrow ${openSections.addFriend ? 'open' : ''}`}>▼</span>
          </button>
          
          {openSections.addFriend && (
            <div className="accordion-content">
              <form onSubmit={handleAddFriend} className="add-friend-form">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Enter friend's secret ID..."
                    value={addFriendSecretId}
                    onChange={(e) => setAddFriendSecretId(e.target.value)}
                    className="terminal-input"
                    disabled={addFriendLoading}
                  />
                  <button
                    type="submit"
                    disabled={addFriendLoading || !addFriendSecretId.trim() || addFriendSuccess}
                    className={`terminal-btn add-btn ${addFriendSuccess ? 'success' : ''}`}
                  >
                    <span className="btn-icon">
                      {addFriendLoading ? '⏳' : addFriendSuccess ? '✅' : '➕'}
                    </span>
                    {addFriendLoading ? 'ADDING...' : addFriendSuccess ? 'ADDED!' : 'ADD'}
                  </button>
                </div>
              </form>

              {addFriendError && (
                <div className="terminal-error">
                  <div className="terminal-line">
                    <span className="error-icon">❌</span>
                    <span className="error-text">{addFriendError}</span>
                  </div>
                </div>
              )}

              {addFriendSuccess && (
                <div className="terminal-success">
                  <div className="terminal-line">
                    <span className="success-icon">✅</span>
                    <span className="success-text">Friend added successfully!</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Friends List Section */}
        <div className="accordion-section">
          <button 
            className="accordion-header" 
            onClick={() => toggleSection('friendsList')}
          >
            <span className="section-icon">👥</span>
            <span className="section-title">FRIENDS LIST ({friends.length})</span>
            <span className={`arrow ${openSections.friendsList ? 'open' : ''}`}>▼</span>
          </button>
          
          {openSections.friendsList && (
            <div className="accordion-content">
              <div className="user-list">
                {friends.length === 0 ? (
                  <div className="empty-terminal">
                    <div className="terminal-line">
                      <span className="prompt">&gt;</span>
                      <span className="command">no_friends_found</span>
                    </div>
                    <div className="terminal-line">
                      <span className="info-text">Add friends using their secret ID to start chatting!</span>
                    </div>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <button
                      key={friend.id}
                      className={`user-item ${selectedUser?.id === friend.id ? 'active' : ''}`}
                      onClick={() => handleUserClick(friend)}
                    >
                      <div className="user-avatar">
                        {getUserInitials(friend.username)}
                      </div>

                      <div className="user-info">
                        <h4>{friend.username}</h4>
                        <div className="user-status">
                          <span className={`status-dot ${friend.isOnline ? '' : 'offline'}`}></span>
                          {friend.isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Footer */}
      <div className="terminal-footer">
        <div className="terminal-line small">
          <span className="security-icon">🔒</span>
          <span className="security-text">End-to-end encrypted</span>
        </div>
        <div className="terminal-line small">
          <span className="security-icon">🛡️</span>
          <span className="security-text">Secure tunneling active</span>
        </div>
        <div className="terminal-line small">
          <span className="security-icon">👥</span>
          <span className="security-text">Friend-only messaging</span>
        </div>
      </div>
    </div>
  );
};

export default UserList;
