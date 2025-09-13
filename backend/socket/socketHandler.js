import { authenticateSocket } from '../middleware/auth.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { 
    generateRoomId, 
    tunnelEncrypt, 
    tunnelDecrypt, 
    validateEncryptedFormat 
} from '../utils/encryption.js';

// Store active connections: userId -> { userId, username, socketIds: Set<string> }
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

            // Store active connection (support multiple tabs/devices)
            const uid = user._id.toString();
            const existing = activeConnections.get(uid);
            if (existing) {
                existing.socketIds.add(socket.id);
            } else {
                activeConnections.set(uid, {
                    userId: uid,
                    username: user.username,
                    socketIds: new Set([socket.id])
                });
            }

            // Update user online status in database
            await User.findByIdAndUpdate(user._id, { 
                isOnline: true, 
                socketId: socket.id, // last active socket
                lastSeen: new Date()
            });

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

                    // Check if target user is a friend (handle ObjectId vs string)
                    const isFriendJoin = Array.isArray(user.friends) && user.friends.some(fid => fid.toString() === targetUserId);
                    if (!isFriendJoin) {
                        socket.emit('error', { message: 'You can only chat with your friends' });
                        return;
                    }

                    // Fetch target user; allow joining even if offline (for history and offline messaging)
                    const targetUser = await User.findById(targetUserId);
                    if (!targetUser) {
                        socket.emit('error', { message: 'User not found' });
                        return;
                    }

                    // Generate secure room ID
                    const roomId = generateRoomId(user._id.toString(), targetUserId);

                    // Join the room
                    socket.join(roomId);

                    // Load previous messages for this room with pagination
                    try {
                        const previousMessages = await Message.getRoomMessages(roomId, {
                            limit: 50,
                            includeSystem: true
                        });

                        socket.emit('room_joined', {
                            success: true,
                            roomId,
                            message: 'Joined secure tunnel',
                            participants: [user._id.toString(), targetUserId],
                            previousMessages: previousMessages.map(msg => ({
                                id: msg._id.toString(),
                                content: msg.encryptedContent, // Send encrypted content
                                messageType: msg.messageType,
                                sender: {
                                    userId: msg.sender.userId.toString(),
                                    username: msg.sender.username
                                },
                                recipient: {
                                    userId: msg.recipient.userId.toString(),
                                    username: msg.recipient.username
                                },
                                roomId: msg.roomId,
                                status: msg.status,
                                deliveryStatus: msg.deliveryStatus,
                                metadata: msg.metadata,
                                encryptionMetadata: msg.encryptionMetadata,
                                createdAt: msg.createdAt,
                                updatedAt: msg.updatedAt
                            }))
                        });

                        // Mark messages as delivered
                        const messageIds = previousMessages
                            .filter(msg => msg.recipient.userId.toString() === user._id.toString() && msg.status === 'sent')
                            .map(msg => msg._id);

                        if (messageIds.length > 0) {
                            await Message.markAsDelivered(messageIds, user._id);
                        }

                    } catch (error) {
                        console.error('Error loading previous messages:', error);
                        socket.emit('room_joined', {
                            success: true,
                            roomId,
                            message: 'Joined secure tunnel',
                            participants: [user._id.toString(), targetUserId],
                            previousMessages: []
                        });
                    }

                } catch (error) {
                    console.error('Join room error:', error);
                    socket.emit('error', { message: 'Failed to join room' });
                }
            });

            // Handle private messages (roomId is now optional / auto-corrected)
            socket.on('private_message', async (data) => {
                console.log('Incoming private_message payload:', {
                    targetUserId: data?.targetUserId,
                    hasMessage: !!data?.message,
                    roomId: data?.roomId,
                    replyTo: data?.replyTo
                });
                try {
                    const { targetUserId, message, roomId: clientRoomId, replyTo = null } = data;

                    if (!targetUserId || !message) {
                        socket.emit('error', { message: 'Target user ID and message are required' });
                        return;
                    }

                    // Check friendship (handle ObjectId vs string)
                    const isFriend = Array.isArray(user.friends) && user.friends.some(fid => fid.toString() === targetUserId);
                    if (!isFriend) {
                        socket.emit('error', { message: 'You can only send messages to your friends' });
                        return;
                    }

                    // Fetch target user (allow sending even if offline)
                    const targetUser = await User.findById(targetUserId);
                    if (!targetUser) {
                        socket.emit('error', { message: 'User not found' });
                        return;
                    }

                    // Compute expected room ID
                    const expectedRoomId = generateRoomId(user._id.toString(), targetUserId);
                    const finalRoomId = expectedRoomId; // we enforce server-side authority

                    // If client supplied mismatching room, log but continue
                    if (clientRoomId && clientRoomId !== expectedRoomId) {
                        console.warn(`Room ID mismatch from client. Provided=${clientRoomId} Expected=${expectedRoomId}. Using expected.`);
                    }

                    // Ensure sender socket is in the room (auto-join if necessary)
                    if (![...socket.rooms].includes(finalRoomId)) {
                        socket.join(finalRoomId);
                    }

                    // Also ensure target is in the room (if connected) for delivery
                    const targetConnection = activeConnections.get(targetUserId.toString());
                    if (targetConnection) {
                        for (const sid of targetConnection.socketIds) {
                            const targetSocket = io.sockets.sockets.get(sid);
                            if (targetSocket && ![...targetSocket.rooms].includes(finalRoomId)) {
                                targetSocket.join(finalRoomId);
                            }
                        }
                    }

                    // Encrypt message
                    const encryptionResult = tunnelEncrypt(message, user._id.toString(), targetUserId);
                    if (!encryptionResult.success) {
                        socket.emit('error', { message: 'Failed to encrypt message' });
                        return;
                    }

                    const messageData = {
                        // DO NOT persist plaintext `content`
                        messageType: 'text',
                        encryptedContent: encryptionResult.encrypted,
                        encryptionMetadata: {
                            ...encryptionResult.metadata,
                            encryptedAt: new Date()
                        },
                        sender: { userId: user._id, username: user.username },
                        recipient: { userId: targetUserId, username: targetUser.username },
                        roomId: finalRoomId,
                        status: 'sent',
                        deliveryStatus: { sentAt: new Date() },
                        metadata: {
                            replyTo,
                            characterCount: message.length,
                            wordCount: message.split(/\s+/).filter(w => w.length > 0).length
                        },
                        security: { encryptionVersion: '1.0' }
                    };

                    try {
                        const newMessage = new Message(messageData);
                        // Attach transient plaintext for integrity hash/counts (not persisted)
                        newMessage._plainContent = message;
                        await newMessage.save();
                        console.log(`Message saved to database: ${newMessage._id}`);

                        const messageToSend = {
                            id: newMessage._id.toString(),
                            content: newMessage.encryptedContent,
                            messageType: newMessage.messageType,
                            sender: {
                                userId: newMessage.sender.userId.toString(),
                                username: newMessage.sender.username
                            },
                            recipient: {
                                userId: newMessage.recipient.userId.toString(),
                                username: newMessage.recipient.username
                            },
                            roomId: newMessage.roomId,
                            status: newMessage.status,
                            deliveryStatus: newMessage.deliveryStatus,
                            metadata: newMessage.metadata,
                            encryptionMetadata: newMessage.encryptionMetadata,
                            createdAt: newMessage.createdAt
                        };

                        io.to(finalRoomId).emit('new_message', messageToSend);
                        console.log(`Encrypted message sent from ${user.username} in room ${finalRoomId}`);
                    } catch (saveError) {
                        console.error('Error saving message to database:', saveError);
                        socket.emit('error', { message: 'Failed to save message' });
                    }
                } catch (error) {
                    console.error('Private message error:', error);
                    socket.emit('error', { message: 'Failed to send message' });
                }
            });

                        // Handle message decryption requests
            socket.on('decrypt_message', async (data) => {
                try {
                    const { messageId, encryptedContent, senderId, targetUserId } = data || {};

                    const currentUserId = user._id.toString();

                    let enc = encryptedContent;
                    let sId = senderId;
                    let tId = targetUserId;

                    // If messageId is provided, trust DB values to avoid any mismatch from client
                    if (messageId) {
                        const msg = await Message.findById(messageId).lean();
                        if (msg) {
                            sId = msg.sender.userId.toString();
                            tId = msg.recipient.userId.toString();
                            enc = enc || msg.encryptedContent;
                        }
                    }

                    if (!enc || !sId || !tId) {
                        socket.emit('error', { message: 'Missing required decryption parameters' });
                        return;
                    }

                    // Verify authorization (must be one of participants)
                    if (currentUserId !== sId && currentUserId !== tId) {
                        socket.emit('error', { message: 'Unauthorized decryption attempt' });
                        return;
                    }

                    // Decrypt message using tunnel decryption
                    const decryptionResult = tunnelDecrypt(enc, sId, tId);

                    if (!decryptionResult.success) {
                        socket.emit('error', { message: 'Failed to decrypt message' });
                        return;
                    }

                    // If messageId exists and current user is the recipient, mark as read
                    if (messageId && currentUserId === tId) {
                        try {
                            await Message.findByIdAndUpdate(messageId, {
                                status: 'read',
                                'deliveryStatus.readAt': new Date()
                            });
                        } catch (updateError) {
                            console.warn('Failed to update message read status:', updateError);
                        }
                    }

                    socket.emit('message_decrypted', {
                        success: true,
                        messageId,
                        decryptedContent: decryptionResult.decrypted,
                        encryptionMetadata: decryptionResult.metadata
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

            // Handle marking messages as read
            socket.on('mark_messages_read', async (data) => {
                try {
                    const { messageIds, roomId } = data;

                    if (!messageIds || !Array.isArray(messageIds)) {
                        socket.emit('error', { message: 'Message IDs array is required' });
                        return;
                    }

                    // Mark messages as read
                    const result = await Message.markAsRead(messageIds, user._id);

                    // Notify sender that messages were read
                    if (result.modifiedCount > 0 && roomId) {
                        socket.to(roomId).emit('messages_read', {
                            messageIds,
                            readBy: user._id.toString(),
                            readAt: new Date()
                        });
                    }

                    socket.emit('messages_marked_read', {
                        success: true,
                        count: result.modifiedCount
                    });

                } catch (error) {
                    console.error('Mark messages read error:', error);
                    socket.emit('error', { message: 'Failed to mark messages as read' });
                }
            });

            // Handle editing messages
            socket.on('edit_message', async (data) => {
                try {
                    const { messageId, newContent, roomId } = data;

                    if (!messageId || !newContent) {
                        socket.emit('error', { message: 'Message ID and new content are required' });
                        return;
                    }

                    // Edit the message
                    const result = await Message.editMessage(messageId, user._id, newContent);

                    if (result.modifiedCount === 0) {
                        socket.emit('error', { message: 'Message not found or cannot be edited' });
                        return;
                    }

                    // Get the updated message
                    const updatedMessage = await Message.findById(messageId);

                    // Encrypt the new content
                    const encryptionResult = tunnelEncrypt(newContent, user._id.toString(), updatedMessage.recipient.userId.toString());

                    // Update encrypted content
                    updatedMessage.encryptedContent = encryptionResult.encrypted;
                    updatedMessage.encryptionMetadata = {
                        ...encryptionResult.metadata,
                        encryptedAt: new Date()
                    };
                    await updatedMessage.save();

                    // Notify room about the edit
                    const messageToSend = {
                        id: updatedMessage._id.toString(),
                        content: updatedMessage.encryptedContent,
                        messageType: updatedMessage.messageType,
                        sender: {
                            userId: updatedMessage.sender.userId.toString(),
                            username: updatedMessage.sender.username
                        },
                        recipient: {
                            userId: updatedMessage.recipient.userId.toString(),
                            username: updatedMessage.recipient.username
                        },
                        roomId: updatedMessage.roomId,
                        status: updatedMessage.status,
                        metadata: {
                            ...updatedMessage.metadata,
                            edited: true,
                            editedAt: new Date()
                        },
                        encryptionMetadata: updatedMessage.encryptionMetadata,
                        createdAt: updatedMessage.createdAt,
                        updatedAt: updatedMessage.updatedAt
                    };

                    io.to(roomId).emit('message_edited', messageToSend);

                    socket.emit('message_edited_success', {
                        success: true,
                        messageId
                    });

                } catch (error) {
                    console.error('Edit message error:', error);
                    socket.emit('error', { message: 'Failed to edit message' });
                }
            });

            // Handle deleting messages
            socket.on('delete_message', async (data) => {
                try {
                    const { messageId, roomId } = data;

                    if (!messageId) {
                        socket.emit('error', { message: 'Message ID is required' });
                        return;
                    }

                    // Delete the message
                    const result = await Message.deleteMessage(messageId, user._id);

                    if (result.modifiedCount === 0) {
                        socket.emit('error', { message: 'Message not found or cannot be deleted' });
                        return;
                    }

                    // Notify room about the deletion
                    io.to(roomId).emit('message_deleted', {
                        messageId,
                        deletedBy: user._id.toString(),
                        deletedAt: new Date()
                    });

                    socket.emit('message_deleted_success', {
                        success: true,
                        messageId
                    });

                } catch (error) {
                    console.error('Delete message error:', error);
                    socket.emit('error', { message: 'Failed to delete message' });
                }
            });

            // Handle message search
            socket.on('search_messages', async (data) => {
                try {
                    const { query, roomId, limit = 20 } = data;

                    if (!query || query.trim().length < 2) {
                        socket.emit('error', { message: 'Search query must be at least 2 characters' });
                        return;
                    }

                    const messages = await Message.searchMessages(query.trim(), user._id, {
                        roomId,
                        limit
                    });

                    socket.emit('search_results', {
                        success: true,
                        query: query.trim(),
                        results: messages.map(msg => ({
                            id: msg._id.toString(),
                            content: msg.encryptedContent,
                            messageType: msg.messageType,
                            sender: msg.sender,
                            recipient: msg.recipient,
                            roomId: msg.roomId,
                            createdAt: msg.createdAt,
                            metadata: msg.metadata
                        }))
                    });

                } catch (error) {
                    console.error('Search messages error:', error);
                    socket.emit('error', { message: 'Failed to search messages' });
                }
            });

            // Handle loading more messages (pagination)
            socket.on('load_more_messages', async (data) => {
                try {
                    const { roomId, before, limit = 50 } = data;

                    if (!roomId) {
                        socket.emit('error', { message: 'Room ID is required' });
                        return;
                    }

                    const messages = await Message.getRoomMessages(roomId, {
                        limit,
                        before,
                        includeSystem: true
                    });

                    socket.emit('more_messages_loaded', {
                        success: true,
                        roomId,
                        messages: messages.map(msg => ({
                            id: msg._id.toString(),
                            content: msg.encryptedContent,
                            messageType: msg.messageType,
                            sender: msg.sender,
                            recipient: msg.recipient,
                            roomId: msg.roomId,
                            status: msg.status,
                            deliveryStatus: msg.deliveryStatus,
                            metadata: msg.metadata,
                            encryptionMetadata: msg.encryptionMetadata,
                            createdAt: msg.createdAt
                        }))
                    });

                } catch (error) {
                    console.error('Load more messages error:', error);
                    socket.emit('error', { message: 'Failed to load more messages' });
                }
            });

            // Handle get online users (use live activeConnections instead of DB to avoid stale flags)
            socket.on('get_online_users', async () => {
                try {
                    const users = Array.from(activeConnections.values()).map(conn => ({
                        id: conn.userId,
                        username: conn.username,
                        // lastSeen is approximated to now for active sockets
                        lastSeen: new Date()
                    }));
                    socket.emit('online_users', {
                        success: true,
                        users
                    });
                } catch (error) {
                    console.error('Get online users error:', error);
                    socket.emit('error', { message: 'Failed to fetch online users' });
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
    if (connection && connection.socketIds && connection.socketIds.size > 0) {
        for (const sid of connection.socketIds) {
            io.to(sid).emit(event, data);
        }
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
