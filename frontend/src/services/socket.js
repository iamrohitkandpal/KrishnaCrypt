import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.debugMode = false;
    this.messageCallbacks = [];
    this.connectionCallbacks = [];
    this.debugCallbacks = [];
  }

  connect(token) {
    const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
    return new Promise((resolve, reject) => {
      this.socket.on('connection_established', (data) => {
        this.isConnected = true;
        this.log('Connected to secure tunnel', data);
        resolve(data);
      });

      this.socket.on('connect_error', (error) => {
        this.log('Connection failed', error);
        reject(error);
      });
    });
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      this.log('Socket connected');
      this.notifyConnectionCallbacks('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.log('Socket disconnected', reason);
      this.notifyConnectionCallbacks('disconnected', reason);
    });

    // Message events
    this.socket.on('encrypted_message', (data) => {
      this.log('Received encrypted message', data);
      this.notifyMessageCallbacks('encrypted_message', data);
    });

    this.socket.on('decrypted_message', (data) => {
      this.log('Received decrypted message', data);
      this.notifyMessageCallbacks('decrypted_message', data);
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
  sendMessage(recipientId, message, roomId = null) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    const messageData = {
      recipientId,
      message,
      roomId,
      timestamp: new Date().toISOString(),
    };

    this.log('Sending message', messageData);
    this.socket.emit('private_message', messageData);
  }

  // Request message decryption
  decryptMessage(encryptedMessage) {
    if (!this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.log('Requesting message decryption', encryptedMessage);
    this.socket.emit('decrypt_message', { encryptedMessage });
  }

  // Typing indicators
  startTyping(recipientId) {
    if (this.isConnected) {
      this.socket.emit('typing_start', { recipientId });
    }
  }

  stopTyping(recipientId) {
    if (this.isConnected) {
      this.socket.emit('typing_stop', { recipientId });
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
    if (this.debugMode) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        message,
        data,
      };
      console.log(`[Socket] ${message}`, data);
      this.notifyDebugCallbacks('log', logEntry);
    }
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
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
