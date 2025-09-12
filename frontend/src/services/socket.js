import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.debugMode = false;
    this.messageCallbacks = [];
    this.connectionCallbacks = [];
    this.debugCallbacks = [];
    this._connectPromise = null; // Track ongoing connection attempts
    this._reconnectTimer = null; // Track reconnection timer
  }

  connect(token) {
    // If already connecting or connected, return the existing promise or create a new one
    if (this._connectPromise) {
      console.log('🔄 Connection attempt already in progress, returning existing promise...');
      return this._connectPromise;
    }

    if (this.socket?.connected) {
      console.log('✅ Socket already connected, returning resolved promise...');
      return Promise.resolve({ success: true, message: 'Already connected' });
    }

    const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5432';
    console.log('🔌 Attempting socket connection to:', serverUrl);
    console.log('🔑 Token provided:', token ? 'Yes' : 'No');
    
    // Clean up any existing socket
    if (this.socket) {
      console.log('🧹 Cleaning up existing socket connection...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Create new connection with better stability settings
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Heartbeat settings
      pingTimeout: 30000,
      pingInterval: 10000,
      // Additional options
      autoConnect: false, // Important: we'll connect manually
      rejectUnauthorized: false
    });

    this.setupEventListeners();
    
    // Create a new connection promise
    this._connectPromise = new Promise((resolve, reject) => {
      // Connection timeout
      const timeout = setTimeout(() => {
        console.error('⏰ Socket connection timeout after 20 seconds');
        this._connectPromise = null;
        this.socket = null;
        reject(new Error('Connection timeout'));
      }, 20000);

      // Setup all event listeners first
      this.setupEventListeners();

      // Then listen for connection events
      this.socket.on('connection_established', (data) => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('✅ Connection established:', data);
        this.log('Connected to secure tunnel', data);
        this._connectPromise = null;
        resolve(data);
      });

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('🔄 Socket connected (fallback)');
        this.log('Socket connected (fallback)');
        this._connectPromise = null;
        resolve({ success: true, message: 'Connected via fallback' });
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Connection error:', error);
        this.log('Connection failed', error);
        this._connectPromise = null;
        reject(error);
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        console.error('🚫 Authentication error:', error);
        this.log('Authentication error', error);
        this._connectPromise = null;
        reject(new Error(`Authentication failed: ${error.message || 'Unknown error'}`));
      });

      // Finally, manually connect
      console.log('🔌 Manually connecting socket...');
      this.socket.connect();
    });

    return this._connectPromise;
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      this.log('Socket connected');
      this.isConnected = true;
      this.notifyConnectionCallbacks('connected');
    });

    this.socket.on('connection_established', (data) => {
      this.log('Connection established with server', data);
      this.isConnected = true;
      this.notifyConnectionCallbacks('connected', data);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.log('Socket disconnected', reason);
      this.notifyConnectionCallbacks('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.log('Connection error', error);
      this.isConnected = false;
      this.notifyConnectionCallbacks('error', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.log('Reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.notifyConnectionCallbacks('connected');
    });

    this.socket.on('reconnect_error', (error) => {
      this.log('Reconnection failed', error);
      this.notifyConnectionCallbacks('error', error);
    });

    // Message events
    this.socket.on('new_message', (data) => {
      this.log('Received new message', data);
      this.notifyMessageCallbacks('new_message', data);
    });

    this.socket.on('message_decrypted', (data) => {
      this.log('Received decrypted message', data);
      this.notifyMessageCallbacks('message_decrypted', data);
    });

    this.socket.on('message_edited', (data) => {
      this.log('Message edited', data);
      this.notifyMessageCallbacks('message_edited', data);
    });

    this.socket.on('message_deleted', (data) => {
      this.log('Message deleted', data);
      this.notifyMessageCallbacks('message_deleted', data);
    });

    this.socket.on('messages_read', (data) => {
      this.log('Messages marked as read', data);
      this.notifyMessageCallbacks('messages_read', data);
    });

    this.socket.on('search_results', (data) => {
      this.log('Search results received', data);
      this.notifyMessageCallbacks('search_results', data);
    });

    this.socket.on('more_messages_loaded', (data) => {
      this.log('More messages loaded', data);
      this.notifyMessageCallbacks('more_messages_loaded', data);
    });

    this.socket.on('messages_marked_read', (data) => {
      this.log('Messages marked as read confirmation', data);
      this.notifyMessageCallbacks('messages_marked_read', data);
    });

    this.socket.on('message_edited_success', (data) => {
      this.log('Message edited successfully', data);
      this.notifyMessageCallbacks('message_edited_success', data);
    });

    this.socket.on('message_deleted_success', (data) => {
      this.log('Message deleted successfully', data);
      this.notifyMessageCallbacks('message_deleted_success', data);
    });

    // Room events
    this.socket.on('room_joined', (data) => {
      this.log('Joined room', data);
      this.notifyMessageCallbacks('room_joined', data);
    });

    // User events
    this.socket.on('online_users', (data) => {
      this.log('Online users updated', data);
      this.notifyMessageCallbacks('online_users', data);
    });

    this.socket.on('user_typing', (data) => {
      this.notifyMessageCallbacks('user_typing', data);
    });

    this.socket.on('user_offline', (data) => {
      this.log('User went offline', data);
      this.notifyMessageCallbacks('user_offline', data);
    });

    // Error events
    this.socket.on('error', (error) => {
      this.log('Socket error', error);
      this.notifyMessageCallbacks('error', error);
    });
  }

  // Room management
  joinRoom(targetUserId) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }
    
    this.log('Joining room with user', targetUserId);
    this.socket.emit('join_room', { targetUserId });
  }

  // Message sending
  sendMessage(targetUserId, message, roomId = null, ackCb = null) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const messageData = {
      targetUserId,
      message,
      // Allow backend to compute authoritative roomId if not provided
      roomId: roomId || undefined,
      timestamp: new Date().toISOString(),
    };

    this.log('Sending message', messageData);
    if (typeof ackCb === 'function') {
      this.socket.emit('private_message', messageData, ackCb);
    } else {
      this.socket.emit('private_message', messageData);
    }
  }

  // Request message decryption
  decryptMessage(messageId, encryptedMessage, senderId, targetUserId) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const decryptData = {
      messageId,
      encryptedContent: encryptedMessage,
      senderId,
      targetUserId
    };

    this.log('Requesting message decryption', decryptData);
    this.socket.emit('decrypt_message', decryptData);
  }

  // Mark messages as read
  markMessagesRead(messageIds, roomId) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const data = {
      messageIds,
      roomId
    };

    this.log('Marking messages as read', data);
    this.socket.emit('mark_messages_read', data);
  }

  // Edit message
  editMessage(messageId, newContent, roomId) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const data = {
      messageId,
      newContent,
      roomId
    };

    this.log('Editing message', data);
    this.socket.emit('edit_message', data);
  }

  // Delete message
  deleteMessage(messageId, roomId) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const data = {
      messageId,
      roomId
    };

    this.log('Deleting message', data);
    this.socket.emit('delete_message', data);
  }

  // Search messages
  searchMessages(query, roomId = null, limit = 20) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const data = {
      query,
      roomId,
      limit
    };

    this.log('Searching messages', data);
    this.socket.emit('search_messages', data);
  }

  // Load more messages (pagination)
  loadMoreMessages(roomId, before, limit = 50) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const data = {
      roomId,
      before,
      limit
    };

    this.log('Loading more messages', data);
    this.socket.emit('load_more_messages', data);
  }

  // Typing indicators
  startTyping(roomId) {
    if (this.isConnected) {
      this.socket.emit('typing_start', { roomId });
    }
  }

  stopTyping(roomId) {
    if (this.isConnected) {
      this.socket.emit('typing_stop', { roomId });
    }
  }

  // Get online users
  getOnlineUsers() {
    if (this.isConnected) {
      this.socket.emit('get_online_users');
    }
  }

  // Event subscription methods
  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }

  onConnection(callback) {
    this.connectionCallbacks.push(callback);
  }

  onDebug(callback) {
    this.debugCallbacks.push(callback);
  }

  // Remove event listeners
  offMessage(callback) {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  offConnection(callback) {
    this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
  }

  offDebug(callback) {
    this.debugCallbacks = this.debugCallbacks.filter(cb => cb !== callback);
  }

  // Notification methods
  notifyMessageCallbacks(event, data) {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in message callback:', error);
      }
    });
  }

  notifyConnectionCallbacks(event, data) {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  notifyDebugCallbacks(event, data) {
    this.debugCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in debug callback:', error);
      }
    });
  }

  // Debug logging
  log(message, data = null) {
    // Only log in development mode
    if (this.debugMode && process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        message,
        data,
      };
      console.log(`[Socket] ${message}`, data);
      
      // Limit the number of callbacks to prevent memory leaks
      if (this.debugCallbacks.length > 20) {
        this.debugCallbacks = this.debugCallbacks.slice(-20);
      }
      
      this.notifyDebugCallbacks('log', logEntry);
    }
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Disconnect
  disconnect() {
    // Clear any pending reconnection timer
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Clear any ongoing connection promise
    this._connectPromise = null;

    if (this.socket) {
      // Remove all listeners to prevent memory leaks
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.log('Socket disconnected manually');
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null,
    };
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
