import mongoose from 'mongoose';
import { generateRoomId } from '../utils/encryption.js';

const messageSchema = new mongoose.Schema({
    // Core message data
    content: {
        type: String,
        required: true,
        maxlength: [5000, 'Message content cannot exceed 5000 characters']
    },

    // Message type (text, system, file, etc.)
    messageType: {
        type: String,
        enum: ['text', 'system', 'file', 'image', 'voice'],
        default: 'text'
    },

    // Encryption data
    encryptedContent: {
        type: String,
        required: true
    },

    encryptionMetadata: {
        algorithm: {
            type: String,
            default: 'KrishnaCrypt-Custom-CBC'
        },
        keySize: {
            type: Number,
            default: 128
        },
        blockSize: {
            type: Number,
            default: 128
        },
        rounds: {
            type: Number,
            default: 3
        },
        encryptionTime: Number,
        tunnelId: String,
        encryptedAt: {
            type: Date,
            default: Date.now
        }
    },

    // Participants
    sender: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },

    recipient: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },

    // Room information
    roomId: {
        type: String,
        required: true,
        index: true
    },

    // Message status
    status: {
        type: String,
        enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },

    // Delivery tracking
    deliveryStatus: {
        sentAt: {
            type: Date,
            default: Date.now
        },
        deliveredAt: Date,
        readAt: Date,
        failedAt: Date,
        failureReason: String
    },

    // Message metadata
    metadata: {
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message'
        },
        edited: {
            type: Boolean,
            default: false
        },
        editedAt: Date,
        originalContent: String,
        wordCount: Number,
        characterCount: Number
    },

    // Security and audit
    security: {
        integrityHash: String, // Hash of original content for integrity verification
        encryptionVersion: {
            type: String,
            default: '1.0'
        }
    }
}, {
    timestamps: true,
    // Add virtual for conversation ID
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for conversation ID (sorted user IDs)
messageSchema.virtual('conversationId').get(function() {
    const ids = [this.sender.userId.toString(), this.recipient.userId.toString()].sort();
    return ids.join('_');
});

// Indexes for performance
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ 'sender.userId': 1, createdAt: -1 });
messageSchema.index({ 'recipient.userId': 1, createdAt: -1 });
messageSchema.index({ 'metadata.replyTo': 1 });
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 }); // For general chronological queries

// Pre-save middleware
messageSchema.pre('save', async function(next) {
    // Generate integrity hash
    if (this.content && !this.security.integrityHash) {
        const crypto = await import('crypto');
        this.security.integrityHash = crypto.createHash('sha256')
            .update(this.content)
            .digest('hex');
    }

    // Set character and word counts
    if (this.content) {
        this.metadata.characterCount = this.content.length;
        this.metadata.wordCount = this.content.split(/\s+/).filter(word => word.length > 0).length;
    }

    next();
});

// Static methods for message operations
messageSchema.statics = {
    // Get messages for a room with pagination
    async getRoomMessages(roomId, options = {}) {
        const {
            limit = 50,
            before = null,
            after = null,
            includeSystem = true
        } = options;

        let query = { roomId };

        // Add pagination filters
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }
        if (after) {
            query.createdAt = { ...query.createdAt, $gt: new Date(after) };
        }

        // Filter message types
        if (!includeSystem) {
            query.messageType = { $ne: 'system' };
        }

        const messages = await this.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender.userId', 'username')
            .populate('recipient.userId', 'username')
            .populate('metadata.replyTo')
            .lean();

        return messages.reverse(); // Return in chronological order
    },

    // Get conversation between two users
    async getConversation(userId1, userId2, options = {}) {
        const roomId = generateRoomId(userId1, userId2);
        return this.getRoomMessages(roomId, options);
    },

    // Search messages
    async searchMessages(query, userId, options = {}) {
        const {
            limit = 20,
            roomId = null,
            before = null,
            after = null
        } = options;

        // Build search query
        const searchQuery = {
            $and: [
                // User must be sender or recipient
                {
                    $or: [
                        { 'sender.userId': userId },
                        { 'recipient.userId': userId }
                    ]
                },
                // Text search in content
                {
                    $or: [
                        { content: { $regex: query, $options: 'i' } },
                        { 'sender.username': { $regex: query, $options: 'i' } },
                        { 'recipient.username': { $regex: query, $options: 'i' } }
                    ]
                }
            ]
        };

        // Add room filter if specified
        if (roomId) {
            searchQuery.$and.push({ roomId });
        }

        // Add time filters
        if (before || after) {
            const timeFilter = {};
            if (before) timeFilter.$lt = new Date(before);
            if (after) timeFilter.$gt = new Date(after);
            searchQuery.$and.push({ createdAt: timeFilter });
        }

        return this.find(searchQuery)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender.userId', 'username')
            .populate('recipient.userId', 'username');
    },

    // Mark messages as delivered
    async markAsDelivered(messageIds, userId) {
        return this.updateMany(
            {
                _id: { $in: messageIds },
                'recipient.userId': userId,
                status: { $in: ['sent', 'sending'] }
            },
            {
                status: 'delivered',
                'deliveryStatus.deliveredAt': new Date()
            }
        );
    },

    // Mark messages as read
    async markAsRead(messageIds, userId) {
        return this.updateMany(
            {
                _id: { $in: messageIds },
                'recipient.userId': userId,
                status: { $in: ['sent', 'delivered'] }
            },
            {
                status: 'read',
                'deliveryStatus.readAt': new Date()
            }
        );
    },

    // Get unread message count
    async getUnreadCount(userId) {
        return this.countDocuments({
            'recipient.userId': userId,
            status: { $nin: ['read'] }
        });
    },

    // Get unread messages for a conversation
    async getUnreadMessages(userId, roomId = null) {
        const query = {
            'recipient.userId': userId,
            status: { $nin: ['read'] }
        };

        if (roomId) {
            query.roomId = roomId;
        }

        return this.find(query)
            .sort({ createdAt: -1 })
            .populate('sender.userId', 'username');
    },

    // Delete message (soft delete by marking as deleted)
    async deleteMessage(messageId, userId) {
        return this.updateOne(
            {
                _id: messageId,
                'sender.userId': userId
            },
            {
                status: 'deleted',
                'metadata.deleted': true,
                'metadata.deletedAt': new Date(),
                'metadata.deletedBy': userId
            }
        );
    },

    // Edit message
    async editMessage(messageId, userId, newContent) {
        const updateData = {
            content: newContent,
            'metadata.edited': true,
            'metadata.editedAt': new Date(),
            'metadata.originalContent': this.content
        };

        // Update integrity hash for new content
        const crypto = await import('crypto');
        updateData['security.integrityHash'] = crypto.createHash('sha256')
            .update(newContent)
            .digest('hex');

        return this.updateOne(
            {
                _id: messageId,
                'sender.userId': userId,
                status: { $nin: ['deleted'] }
            },
            updateData
        );
    }
};

// Instance methods
messageSchema.methods = {
    // Check if message can be edited (within time limit)
    canEdit() {
        const EDIT_TIME_LIMIT = 15 * 60 * 1000; // 15 minutes
        return (Date.now() - this.createdAt.getTime()) < EDIT_TIME_LIMIT;
    },

    // Check if message can be deleted
    canDelete() {
        const DELETE_TIME_LIMIT = 24 * 60 * 60 * 1000; // 24 hours
        return (Date.now() - this.createdAt.getTime()) < DELETE_TIME_LIMIT;
    },

    // Verify message integrity
    async verifyIntegrity() {
        const crypto = await import('crypto');
        const currentHash = crypto.createHash('sha256')
            .update(this.content)
            .digest('hex');

        return currentHash === this.security.integrityHash;
    },

    // Get message summary for notifications
    getNotificationSummary() {
        let summary = this.content;

        // Truncate long messages
        if (summary.length > 100) {
            summary = summary.substring(0, 97) + '...';
        }

        return {
            id: this._id,
            sender: this.sender.username,
            summary,
            timestamp: this.createdAt,
            type: this.messageType
        };
    }
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
