import mongoose from 'mongoose';
import { generateRoomId } from '../utils/encryption.js';

const messageSchema = new mongoose.Schema({
    // Core message data (do NOT persist plaintext)
    // Kept for backward compatibility, but not required and not selected by default.
    // We never set this field when creating/editing messages.
    content: {
        type: String,
        required: false,
        select: false,
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
    try {
        // Use transient _plainContent (set at runtime) or legacy content if present
        const plain = this._plainContent || this.content;

        if (plain && !this.security.integrityHash) {
            const crypto = await import('crypto');
            this.security.integrityHash = crypto.createHash('sha256')
                .update(plain)
                .digest('hex');
        }

        if (plain) {
            this.metadata = this.metadata || {};
            this.metadata.characterCount = plain.length;
            this.metadata.wordCount = plain.split(/\s+/).filter(word => word.length > 0).length;
        }

        // Ensure plaintext is not persisted
        if (this.isModified('content')) {
            this.set('content', undefined, { strict: false });
        }
        // Also drop transient field if it exists
        if (this._plainContent) {
            delete this._plainContent;
        }

        next();
    } catch (err) {
        next(err);
    }
});

// Static methods for message operations
// Get messages for a room with pagination
messageSchema.statics.getRoomMessages = async function(roomId, options = {}) {
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
};

// Get conversation between two users
messageSchema.statics.getConversation = async function(userId1, userId2, options = {}) {
        const roomId = generateRoomId(userId1, userId2);
        return this.getRoomMessages(roomId, options);
};

// Search messages (note: plaintext content is not stored; search by usernames only)
messageSchema.statics.searchMessages = async function(query, userId, options = {}) {
        const {
            limit = 20,
            roomId = null,
            before = null,
            after = null
        } = options;

        // Build search query (no plaintext content search)
        const searchQuery = {
            $and: [
                // User must be sender or recipient
                {
                    $or: [
                        { 'sender.userId': userId },
                        { 'recipient.userId': userId }
                    ]
                },
                // Text search in participant usernames only
                {
                    $or: [
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
};

// Mark messages as delivered
messageSchema.statics.markAsDelivered = async function(messageIds, userId) {
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
};

// Mark messages as read
messageSchema.statics.markAsRead = async function(messageIds, userId) {
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
};

// Get unread message count
messageSchema.statics.getUnreadCount = async function(userId) {
        return this.countDocuments({
            'recipient.userId': userId,
            status: { $nin: ['read'] }
        });
};

// Get unread messages for a conversation
messageSchema.statics.getUnreadMessages = async function(userId, roomId = null) {
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
};

// Delete message (soft delete by marking as deleted)
messageSchema.statics.deleteMessage = async function(messageId, userId) {
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
};

// Edit message
messageSchema.statics.editMessage = async function(messageId, userId, newContent) {
        const updateData = {
            'metadata.edited': true,
            'metadata.editedAt': new Date(),
            // DO NOT store plaintext in originalContent
            'metadata.characterCount': newContent.length,
            'metadata.wordCount': newContent.split(/\s+/).filter(w => w.length > 0).length
        };

        // Update integrity hash for new content (without storing plaintext)
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

    // Verify message integrity with provided plaintext
    async verifyIntegrity(plainText) {
        const crypto = await import('crypto');
        const currentHash = crypto.createHash('sha256')
            .update(plainText || '')
            .digest('hex');
        return currentHash === this.security.integrityHash;
    },

    // Get message summary for notifications (no plaintext available)
    getNotificationSummary() {
        const summary = '[Encrypted message]';
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
