import { authenticateSocket } from '../middleware/auth.js';
import User from '../models/User.js';
import { 
    generateRoomId, 
    tunnelEncrypt, 
    tunnelDecrypt, 
    validateEncryptedFormat 
} from '../utils/encryption.js';

// Store active connections
const activeConnections = new Map();

/**
 * Initialize Socket.io with authentication and message handling
 * @param {Object} io - Socket.io server instance
 */
function initializeSocket(io) {
    // Authentication middleware for all socket connections
    io.use(authenticateSocket);

    io.on('connection', async (socket) => {
        try {
            const user = socket.user;
            console.log(`User ${user.username} connected with socket ID: ${socket.id}`);

            // Store active connection
            activeConnections.set(user._id.toString(), {
                socketId: socket.id,
                username: user.username,
                userId: user._id.toString()
            });

            // Update user online status in database
            await user.setOnlineStatus(true, socket.id);

            // Notify user of successful connection
            socket.emit('connection_established', {
                success: true,
                message: 'Connected to secure tunnel',
                user: {
                    id: user._id,
                    username: user.username
                }
            });

            // Handle joining private rooms
            socket.on('join_room', async (data) => {
                try {
                    const { targetUserId } = data;
                    
                    if (!targetUserId) {
                        socket.emit('error', { message: 'Target user ID is required' });
                        return;
                    }

                    // Generate secure room ID
                    const roomId = generateRoomId(user._id.toString(), targetUserId);
                    
                    // Join the room
                    socket.join(roomId);
                    
                    console.log(`User ${user.username} joined room: ${roomId}`);
                    
                    socket.emit('room_joined', {
                        success: true,
                        roomId,
                        message: 'Joined secure tunnel',
                        participants: [user._id.toString(), targetUserId]
                    });

                } catch (error) {
                    console.error('Join room error:', error);
                    socket.emit('error', { message: 'Failed to join room' });
                }
            });

            // Handle private messages
            socket.on('private_message', async (data) => {
                try {
                    const { targetUserId, message, roomId } = data;
                    
                    if (!targetUserId || !message) {
                        socket.emit('error', { message: 'Target user ID and message are required' });
                        return;
                    }

                    // Verify room ID matches expected room for these users
                    const expectedRoomId = generateRoomId(user._id.toString(), targetUserId);
                    if (roomId !== expectedRoomId) {
                        socket.emit('error', { message: 'Invalid room ID' });
                        return;
                    }

                    // Encrypt message using tunnel encryption
                    const encryptionResult = tunnelEncrypt(message, user._id.toString(), targetUserId);
                    
                    if (!encryptionResult.success) {
                        socket.emit('error', { message: 'Failed to encrypt message' });
                        return;
                    }

                    const messageData = {
                        id: Date.now().toString(),
                        senderId: user._id.toString(),
                        senderUsername: user.username,
                        targetUserId,
                        message: encryptionResult.encrypted,
                        roomId,
                        timestamp: new Date().toISOString(),
                        encrypted: true,
                        tunnelMetadata: encryptionResult.metadata
                    };

                    // Send encrypted message to room
                    io.to(roomId).emit('new_message', messageData);
                    
                    console.log(`Encrypted message sent from ${user.username} in room ${roomId}`);

                } catch (error) {
                    console.error('Private message error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

            // Handle message decryption requests
            socket.on('decrypt_message', async (data) => {
                try {
                    const { encryptedMessage, senderId, targetUserId } = data;
                    
                    if (!encryptedMessage || !senderId || !targetUserId) {
                        socket.emit('error', { message: 'Missing required decryption parameters' });
                        return;
                    }

                    // Verify user is authorized to decrypt (must be sender or target)
                    const currentUserId = user._id.toString();
                    if (currentUserId !== senderId && currentUserId !== targetUserId) {
                        socket.emit('error', { message: 'Unauthorized decryption attempt' });
                        return;
                    }

                    // Decrypt message using tunnel decryption
                    const decryptionResult = tunnelDecrypt(encryptedMessage, senderId, targetUserId);
                    
                    if (!decryptionResult.success) {
                        socket.emit('error', { message: 'Failed to decrypt message' });
                        return;
                    }

                    socket.emit('message_decrypted', {
                        success: true,
                        decryptedMessage: decryptionResult.decrypted,
                        tunnelMetadata: decryptionResult.metadata
                    });

                } catch (error) {
                    console.error('Decrypt message error:', error);
                    socket.emit('error', { message: 'Decryption failed' });
                }
            });

            // Handle typing indicators
            socket.on('typing_start', (data) => {
                const { roomId } = data;
                if (roomId) {
                    socket.to(roomId).emit('user_typing', {
                        userId: user._id.toString(),
                        username: user.username,
                        isTyping: true
                    });
                }
            });

            socket.on('typing_stop', (data) => {
                const { roomId } = data;
                if (roomId) {
                    socket.to(roomId).emit('user_typing', {
                        userId: user._id.toString(),
                        username: user.username,
                        isTyping: false
                    });
                }
            });

            // Handle get online users
            socket.on('get_online_users', async () => {
                try {
                    const onlineUsers = await User.getOnlineUsers();
                    socket.emit('online_users', {
                        success: true,
                        users: onlineUsers.map(u => ({
                            id: u._id.toString(),
                            username: u.username,
                            lastSeen: u.lastSeen
                        }))
                    });
                } catch (error) {
                    console.error('Get online users error:', error);
                    socket.emit('error', { message: 'Failed to fetch online users' });
                }
            });

            // Handle disconnection
            socket.on('disconnect', async (reason) => {
                try {
                    console.log(`User ${user.username} disconnected: ${reason}`);
                    
                    // Remove from active connections
                    activeConnections.delete(user._id.toString());
                    
                    // Update user offline status
                    await user.setOnlineStatus(false, null);
                    
                    // Notify other users about offline status
                    socket.broadcast.emit('user_offline', {
                        userId: user._id.toString(),
                        username: user.username
                    });

                } catch (error) {
                    console.error('Disconnect error:', error);
                }
            });

        } catch (error) {
            console.error('Socket connection error:', error);
            socket.emit('error', { message: 'Connection failed' });
            socket.disconnect();
        }
    });

    // Handle connection errors
    io.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error);
    });

    console.log('Socket.io initialized with authentication and encryption');
}

/**
 * Get count of active connections
 * @returns {number} Number of active connections
 */
function getActiveConnectionsCount() {
    return activeConnections.size;
}

/**
 * Get active connection by user ID
 * @param {string} userId - User ID
 * @returns {Object|null} Connection object or null
 */
function getActiveConnection(userId) {
    return activeConnections.get(userId) || null;
}

/**
 * Get all active connections
 * @returns {Map} Map of active connections
 */
function getAllActiveConnections() {
    return new Map(activeConnections);
}

/**
 * Broadcast message to all connected users
 * @param {Object} io - Socket.io server instance
 * @param {string} event - Event name
 * @param {Object} data - Data to broadcast
 */
function broadcastToAll(io, event, data) {
    io.emit(event, data);
}

/**
 * Send message to specific user
 * @param {Object} io - Socket.io server instance
 * @param {string} userId - Target user ID
 * @param {string} event - Event name
 * @param {Object} data - Data to send
 */
function sendToUser(io, userId, event, data) {
    const connection = activeConnections.get(userId);
    if (connection) {
        io.to(connection.socketId).emit(event, data);
        return true;
    }
    return false;
}

export {
    initializeSocket,
    getActiveConnectionsCount,
    getActiveConnection,
    getAllActiveConnections,
    broadcastToAll,
    sendToUser
};
