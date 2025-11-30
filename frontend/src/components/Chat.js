import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';
import DebugPanel from './DebugPanel';

const Chat = ({ currentUser, selectedUser, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugVisible, setDebugVisible] = useState(true);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesRef = useRef([]);
  const inputRef = useRef(null);
  const initialScrollDoneRef = useRef(false);
  const roomIdRef = useRef(null);

  const addDebugLog = (message, data) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message, 
      data,
      id: Date.now() + Math.random()
    };

    setDebugLogs(prev => [...prev, logEntry].slice(-50));
    console.log(`[DEBUG ${timestamp}] ${message}:`, data); 
  }; 

  const handleClearDebugLogs = () => {
    setDebugLogs([]);
    addDebugLog('Debug panel cleared', { clearedAt: new Date().toISOString() });
  };

  const toggleDebugPanel = () => {
    setDebugVisible(prev => !prev);
  };

  useEffect(() => {
    if (selectedUser) {
      socketService.joinRoom(selectedUser.id);

      addDebugLog('Joining room', {
        targetUser: selectedUser.username,
        targetUserId: selectedUser.id,
      });
      
      const handleRoomJoined = (data) => {
        console.log('Room Joined:', data);
        setRoomId(data.roomId);
        roomIdRef.current = data.roomId;

        addDebugLog('Room joined successfully', {
          roomId: data.roomId,
          algorithm: 'KrishnaGuard-128-CBC',
          tunnelStatus: 'active'
        });

        if (data.messages && data.messages.length > 0) {
          const formattedMessages = data.messages.map(msg => ({
            id: msg._id,
            text: msg.decryptedContent || msg.content || '[Encrypted]',
            sender: msg.sender.username,
            senderId: msg.sender.userId,
            timestamp: msg.createdAt,
            encrypted: !!msg.encryptedContent,
            encryptionMetadata: msg.encryptionMetadata
          }));

          setMessages(formattedMessages);
          messagesRef.current = formattedMessages;

          addDebugLog('Message history loaded', {
            count: formattedMessages.length,
            encrypted: formattedMessages.filter(m => m.encrypted).length 
          });
        }
      };

      const handleNewMessage = (data) => {
        console.log('New Message received:', data);
        addDebugLog('Message received', {
          from: data.sender.username,
          encrypted: true,
          algorithm: data.encryptionMetadata?.algorithm,
          decrypted: !!data.decryptedContent, 
        });

        const newMsg = {
          id: data._id,
          text: data.decryptedContent || data.content || '[Encrypted]',
          sender: data.sender.username,
          senderId: data.sender.userId,
          timestamp: data.createdAt,
          encrypted: !!data.encryptedContent,
          encryptionMetadata: data.encryptionMetadata
        };

        setMessages(prev => {
          const updated = [...prev, newMsg];
          messagesRef.current = updated;
          return updated;
        });
      };

      // Setup message listeners
      const handleMessage = (event, data) => {
        switch (event) {
          case 'room_joined':
            setRoomId(prev => (prev !== data.roomId ? data.roomId : prev));
            roomIdRef.current = data.roomId;
            addDebugLog('Joined secure tunnel', data);

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

              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const toAdd = previousMsgs.filter(m => !existingIds.has(m.id));
                const merged = prev.length > 0 && roomIdRef.current === data.roomId ? [...prev, ...toAdd] : previousMsgs;
                return merged;
              });

              addDebugLog(`Loaded ${previousMsgs.length} previous messages`, {
                roomId: data.roomId
              });

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
            break;
            
          case 'message_decrypted':
            addDebugLog('Message decrypted successfully', {
              messageId: data.messageId,
              decryptedLength: data.decryptedContent?.length || 0,
              algorithm: data.encryptionMetadata?.algorithm
            });
            
            setMessages(prev => prev.map(msg => {
              if (msg.id === data.messageId) {
                return {
                  ...msg,
                  text: data.decryptedContent,
                  encrypted: false,
                  status: msg.isOwn ? msg.status : 'read'
                };
              }
              return msg;
            }));
            break;
            
          case 'messages_read':
            addDebugLog('Messages marked as read', {
              count: data.messageIds?.length || 0,
              readBy: data.readBy
            });
            
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  };

  const handleClearChat = () => {
    if (!window.confirm(`Are you sure you want to clear all messages with ${selectedUser.username}? This action cannot be undone.`)) {
      return;
    }

    setMessages([]);
    
    const clearMessage = {
      id: `clear_${Date.now()}`,
      text: '🧹 Chat cleared by you',
      timestamp: new Date().toISOString(),
      isOwn: true,
      encrypted: false,
      senderId: currentUser.id,
      senderUsername: currentUser.username,
      messageType: 'system'
    };
    
    setMessages([clearMessage]);
    
    addDebugLog('Chat cleared', { 
      clearedBy: currentUser.username,
      chatWith: selectedUser.username,
      roomId 
    });
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
      socketService.stopTyping(roomId);
      
    } catch (error) {
      console.error('Error sending message:', error);
      addDebugLog('Send message error', error.message);
      setNewMessage(messageText);
    } finally {
      setLoading(false);
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
      if (!isMobile) {
        inputRef.current?.focus();
      }
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (e.target.value.trim() && !isTyping) {
      setIsTyping(true);
      socketService.startTyping(roomId);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.stopTyping(roomId);
    }, 1000);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <div style={{ flex: 1 }}>
          <h3>Chat with {selectedUser.username}</h3>
          <div className="encryption-status">
            🔒 Secure tunnel established {roomId && `(Room: ${roomId.slice(0, 8)}...)`}
          </div>
        </div>
        <button 
          className="btn btn-danger" 
          onClick={handleClearChat}
          style={{ 
            padding: '8px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
          title="Clear all messages in this chat"
        >
          🧹 Clear Chat
        </button>
      </div>

      <div className="messages-container" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Start your secure conversation</h3>
            <p>Messages are encrypted with KrishnaGuard-128-CBC</p>
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
                  
                  {/* TODO: Message actions (edit/delete for own messages) - Features temporarily disabled */}
                  {/*
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
                  */}
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
      
      {/* ✅ DebugPanel Component */}
      <DebugPanel
        logs={debugLogs}
        onClear={handleClearDebugLogs}
        visible={debugVisible}
        onToggle={toggleDebugPanel}
      />
    </div>
  );
};

export default Chat;
