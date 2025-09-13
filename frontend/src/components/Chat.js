import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';

const Chat = ({ currentUser, selectedUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  // Debug panel removed for cleaner UI
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesRef = useRef([]); // Track latest messages to prevent stale closures
  const inputRef = useRef(null);
  const initialScrollDoneRef = useRef(false);
  const roomIdRef = useRef(null);

  useEffect(() => {
    if (selectedUser) {
      // Join room with selected user
      socketService.joinRoom(selectedUser.id);
      
      // Setup message listeners
      const handleMessage = (event, data) => {
        switch (event) {
          case 'room_joined':
            // Only update roomId if changed
            setRoomId(prev => (prev !== data.roomId ? data.roomId : prev));
            roomIdRef.current = data.roomId;
            addDebugLog('Joined secure tunnel', data);

            // Load/merge previous messages if available
            if (data.previousMessages && data.previousMessages.length > 0) {
              const previousMsgs = data.previousMessages.map(msg => ({
                id: msg.id,
                senderId: String(msg.sender.userId),
                senderUsername: msg.sender.username,
                targetUserId: String(msg.recipient.userId),
                text: '[ENCRYPTED]',
                encryptedText: msg.content,
                timestamp: msg.createdAt,
                isOwn: String(msg.sender.userId) === String(currentUser.id) || msg.sender.username === currentUser.username,
                encrypted: true,
                messageType: msg.messageType,
                status: msg.status,
                deliveryStatus: msg.deliveryStatus,
                metadata: msg.metadata,
                encryptionMetadata: msg.encryptionMetadata
              }));

              // If we already have messages for the same room, merge instead of replacing
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const toAdd = previousMsgs.filter(m => !existingIds.has(m.id));
                const merged = prev.length > 0 && roomIdRef.current === data.roomId ? [...prev, ...toAdd] : previousMsgs;
                return merged;
              });

              addDebugLog(`Loaded ${previousMsgs.length} previous messages`, {
                roomId: data.roomId
              });

              // Auto-decrypt previous messages that this user can decrypt
              previousMsgs.forEach(msg => {
                if (msg.senderId === currentUser.id || msg.targetUserId === currentUser.id) {
                  socketService.decryptMessage(msg.id, msg.encryptedText, msg.senderId, msg.targetUserId);
                }
              });

              // Avoid smooth scroll on initial hydrate
              setTimeout(() => {
                scrollToBottom();
                initialScrollDoneRef.current = true;
              }, 0);
            }
            break;
            
          case 'new_message':
            addDebugLog('Received encrypted message', {
              algorithm: data.encryptionMetadata?.algorithm,
              encryptedLength: data.content?.length || 0,
              sender: data.sender.username,
              roomId: data.roomId,
              status: data.status
            });
            
            // Add encrypted message to display
            const encryptedMsg = {
              id: data.id,
              senderId: String(data.sender.userId),
              senderUsername: data.sender.username,
              targetUserId: String(data.recipient.userId),
              text: '[ENCRYPTED]',
              encryptedText: data.content,
              timestamp: data.createdAt,
              isOwn: String(data.sender.userId) === String(currentUser.id) || data.sender.username === currentUser.username,
              encrypted: true,
              messageType: data.messageType,
              status: data.status,
              deliveryStatus: data.deliveryStatus,
              metadata: data.metadata,
              encryptionMetadata: data.encryptionMetadata
            };
            setMessages(prev => [...prev, encryptedMsg]);
            
            // Auto-decrypt if this user can decrypt it
            if (String(data.sender.userId) === String(currentUser.id) || String(data.recipient.userId) === String(currentUser.id)) {
              socketService.decryptMessage(
                data.id,
                data.content,
                String(data.sender.userId),
                String(data.recipient.userId)
              );
            }
            break;
            
          case 'message_decrypted':
            addDebugLog('Message decrypted successfully', {
              messageId: data.messageId,
              decryptedLength: data.decryptedContent?.length || 0,
              algorithm: data.encryptionMetadata?.algorithm
            });
            
            // Update the encrypted message with decrypted text
            setMessages(prev => prev.map(msg => {
              if (msg.id === data.messageId) {
                return {
                  ...msg,
                  text: data.decryptedContent,
                  encrypted: false,
                  status: msg.isOwn ? msg.status : 'read' // Mark as read when decrypted
                };
              }
              return msg;
            }));
            break;
            
          case 'message_edited':
            addDebugLog('Message edited', {
              messageId: data.id,
              edited: data.metadata?.edited
            });
            
            // Update the message with edited content
            setMessages(prev => prev.map(msg => {
              if (msg.id === data.id) {
                return {
                  ...msg,
                  text: '[ENCRYPTED]', // Reset to encrypted state
                  encryptedText: data.content,
                  encrypted: true,
                  metadata: data.metadata
                };
              }
              return msg;
            }));
            
            // Auto-decrypt the edited message
            if (data.sender.userId === currentUser.id || data.recipient.userId === currentUser.id) {
              socketService.decryptMessage(data.id, data.content, data.sender.userId, data.recipient.userId);
            }
            break;
            
          case 'message_deleted':
            addDebugLog('Message deleted', {
              messageId: data.messageId,
              deletedBy: data.deletedBy
            });
            
            // Remove the message from display
            setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
            break;
            
          case 'messages_read':
            addDebugLog('Messages marked as read', {
              count: data.messageIds?.length || 0,
              readBy: data.readBy
            });
            
            // Update message status to read
            setMessages(prev => prev.map(msg => {
              if (data.messageIds.includes(msg.id)) {
                return {
                  ...msg,
                  status: 'read',
                  deliveryStatus: {
                    ...msg.deliveryStatus,
                    readAt: data.readAt
                  }
                };
              }
              return msg;
            }));
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
    // Scroll only when there are messages; use container scroll to avoid layout jump
    if (messages.length > 0) {
      scrollToBottom();
      if (!initialScrollDoneRef.current) {
        initialScrollDoneRef.current = true;
      }
    }
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    const c = messagesContainerRef.current;
    if (c) {
      c.scrollTop = c.scrollHeight;
    } else {
      // Fallback
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  };

  const addDebugLog = () => {}; // No-op after removal

  const handleEditMessage = async (message) => {
    const newContent = prompt('Edit your message:', message.text);
    if (newContent && newContent.trim() !== message.text) {
      try {
        addDebugLog('Editing message', {
          messageId: message.id,
          oldLength: message.text.length,
          newLength: newContent.length
        });

        // Send edit request to server
        socketService.socket.emit('edit_message', {
          messageId: message.id,
          newContent: newContent.trim(),
          roomId: roomId
        });

      } catch (error) {
        console.error('Error editing message:', error);
        addDebugLog('Edit message error', error.message);
      }
    }
  };

  const handleDeleteMessage = async (message) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        addDebugLog('Deleting message', {
          messageId: message.id,
          contentLength: message.text.length
        });

        // Send delete request to server
        socketService.socket.emit('delete_message', {
          messageId: message.id,
          roomId: roomId
        });

      } catch (error) {
        console.error('Error deleting message:', error);
        addDebugLog('Delete message error', error.message);
      }
    }
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

      socketService.sendMessage(selectedUser.id, messageText, roomId);
      
      // Stop typing indicator
      socketService.stopTyping(roomId);
      
    } catch (error) {
      console.error('Error sending message:', error);
      addDebugLog('Send message error', error.message);
      setNewMessage(messageText); // Restore message on error
    } finally {
      setLoading(false);
      // Keep focus for rapid messaging (avoid on mobile to prevent layout jump)
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
      if (!isMobile) {
        inputRef.current?.focus();
      }
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    // Handle typing indicators
    if (e.target.value.trim() && !isTyping) {
      setIsTyping(true);
      socketService.startTyping(roomId);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(roomId);
    }, 1000);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Debug timestamp formatting removed

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

      <div className="messages-container" ref={messagesContainerRef}>
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
                {!message.isOwn && (
                  <div className="message-header">
                    <span>{message.senderUsername}</span>
                  </div>
                )}
                <div className="message-content">
                  <div className="message-text">
                    {message.text}
                    {message.encrypted && (
                      <button 
                        onClick={() => socketService.decryptMessage(
                          message.id,
                          message.encryptedText, 
                          message.senderId, 
                          message.targetUserId
                        )}
                        style={{
                          marginLeft: '10px',
                          padding: '2px 6px',
                          background: '#ffc107',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        🔓 Decrypt
                      </button>
                    )}
                  </div>
                  
                  {/* Message metadata */}
                  <div className="message-meta">
                    {message.metadata?.edited && (
                      <span className="edited-indicator" style={{ 
                        fontSize: '10px', 
                        color: '#666', 
                        marginRight: '8px' 
                      }}>
                        edited
                      </span>
                    )}
                    
                    {/* Message status indicators */}
                    {message.isOwn && (
                      <span className="message-status" style={{ 
                        fontSize: '10px', 
                        color: message.status === 'read' ? '#28a745' : 
                               message.status === 'delivered' ? '#17a2b8' : '#6c757d'
                      }}>
                        {message.status === 'read' ? '✓✓' : 
                         message.status === 'delivered' ? '✓' : '○'}
                      </span>
                    )}
                  </div>
                  
                  {/* Message actions (edit/delete for own messages) */}
                  {message.isOwn && !message.encrypted && (
                    <div className="message-actions" style={{ 
                      marginTop: '5px', 
                      display: 'flex', 
                      gap: '5px' 
                    }}>
                      {message.metadata?.edited !== true && (
                        <button 
                          onClick={() => handleEditMessage(message)}
                          style={{
                            padding: '2px 6px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteMessage(message)}
                        style={{
                          padding: '2px 6px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="message-timestamp">
                  {formatTimestamp(message.timestamp)}
                </div>
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
            ref={inputRef}
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
    </div>
  );
};

export default Chat;
