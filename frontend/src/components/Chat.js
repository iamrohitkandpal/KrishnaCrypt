import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';

const Chat = ({ currentUser, selectedUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (selectedUser) {
      // Join room with selected user
      socketService.joinRoom(selectedUser._id);
      
      // Setup message listeners
      const handleMessage = (event, data) => {
        switch (event) {
          case 'room_joined':
            setRoomId(data.roomId);
            addDebugLog('Joined secure tunnel', data);
            break;
            
          case 'encrypted_message':
            addDebugLog('Received encrypted message', {
              algorithm: data.algorithm,
              iv: data.iv,
              encryptedLength: data.encrypted?.length || 0,
              sender: data.senderUsername
            });
            
            // Request decryption
            socketService.decryptMessage(data);
            break;
            
          case 'decrypted_message':
            const message = {
              id: Date.now() + Math.random(),
              senderId: data.senderId,
              senderUsername: data.senderUsername,
              recipientId: data.recipientId,
              recipientUsername: data.recipientUsername,
              text: data.message,
              timestamp: data.timestamp,
              isOwn: data.senderId === currentUser.id
            };
            
            setMessages(prev => [...prev, message]);
            addDebugLog('Message decrypted and displayed', {
              messageLength: data.message.length,
              sender: data.senderUsername
            });
            break;
            
          case 'user_typing':
            if (data.userId !== currentUser.id) {
              setTypingUser(data.isTyping ? data.username : null);
            }
            break;
            
          case 'error':
            addDebugLog('Socket error', data);
            break;
            
          default:
            addDebugLog(`Unhandled event: ${event}`, data);
        }
      };

      socketService.onMessage(handleMessage);
      
      return () => {
        socketService.offMessage(handleMessage);
        setMessages([]);
        setRoomId(null);
        setTypingUser(null);
      };
    }
  }, [selectedUser, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addDebugLog = (message, data = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };
    setDebugLogs(prev => [...prev.slice(-19), logEntry]); // Keep last 20 logs
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || loading || !selectedUser) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setLoading(true);

    try {
      addDebugLog('Sending message', {
        recipient: selectedUser.username,
        messageLength: messageText.length,
        roomId
      });

      socketService.sendMessage(selectedUser._id, messageText, roomId);
      
      // Stop typing indicator
      socketService.stopTyping(selectedUser._id);
      
    } catch (error) {
      console.error('Error sending message:', error);
      addDebugLog('Send message error', error.message);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicators
    if (e.target.value.trim() && !isTyping) {
      setIsTyping(true);
      socketService.startTyping(selectedUser._id);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(selectedUser._id);
    }, 1000);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDebugTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  if (!selectedUser) {
    return (
      <div className="chat-area">
        <div className="empty-state">
          <h3>🔐 KrishnaCrypt</h3>
          <p>Select a user from the list to start a secure conversation</p>
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            <p>🛡️ All messages are encrypted with custom algorithm</p>
            <p>🔒 VPN-like secure tunneling active</p>
            <p>🔐 End-to-end security guaranteed</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <button 
          className="btn btn-secondary" 
          onClick={onBack}
          style={{ marginRight: '15px', padding: '8px 12px' }}
        >
          ← Back
        </button>
        <div>
          <h3>Chat with {selectedUser.username}</h3>
          <div className="encryption-status">
            Secure tunnel established {roomId && `(Room: ${roomId.slice(0, 8)}...)`}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Start your secure conversation</h3>
            <p>Messages are encrypted with custom lightweight algorithm</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${message.isOwn ? 'own' : ''}`}
            >
              <div className="message-bubble">
                <div className="message-header">
                  <span>{message.senderUsername}</span>
                  <span>{formatTimestamp(message.timestamp)}</span>
                </div>
                <div className="message-text">{message.text}</div>
              </div>
            </div>
          ))
        )}
        
        {typingUser && (
          <div className="message">
            <div className="message-bubble" style={{ 
              background: '#f0f0f0', 
              fontStyle: 'italic',
              color: '#666'
            }}>
              {typingUser} is typing...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input">
        <form onSubmit={handleSendMessage} className="input-container">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder={`Send encrypted message to ${selectedUser.username}...`}
            disabled={loading}
            maxLength={1000}
          />
          <button 
            type="submit" 
            className="send-btn"
            disabled={loading || !newMessage.trim()}
          >
            {loading ? '🔐' : '📤'}
          </button>
        </form>
      </div>

      {/* Debug Panel Toggle */}
      <button 
        className="debug-toggle"
        onClick={() => setShowDebug(!showDebug)}
        title="Toggle debug panel"
      >
        🔍
      </button>

      {/* Debug Panel */}
      {showDebug && (
        <div className="debug-panel">
          <h4>🔐 Encryption Debug Log</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {debugLogs.length === 0 ? (
              <p>No debug logs yet...</p>
            ) : (
              debugLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '8px', fontSize: '11px' }}>
                  <div style={{ color: '#ffc107' }}>
                    [{formatDebugTimestamp(log.timestamp)}] {log.message}
                  </div>
                  {log.data && (
                    <div style={{ color: '#ccc', marginLeft: '10px' }}>
                      {typeof log.data === 'string' 
                        ? log.data 
                        : JSON.stringify(log.data, null, 2)
                      }
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <button 
            onClick={() => setDebugLogs([])}
            style={{ 
              marginTop: '10px', 
              padding: '5px 10px', 
              background: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontSize: '11px'
            }}
          >
            Clear Logs
          </button>
        </div>
      )}
    </div>
  );
};

export default Chat;
