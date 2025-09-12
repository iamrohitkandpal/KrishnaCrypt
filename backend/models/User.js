import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [30, 'Username cannot exceed 30 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    secretId: {
        type: String,
        required: true,
        unique: true
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    socketId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const saltRounds = 12;
        this.password = await bcrypt.hash(this.password, saltRounds);
        next();
    } catch (error) {
        next(error);
    }
});

// Generate secretId before saving if not present
userSchema.pre('save', function(next) {
    if (!this.secretId) {
        this.secretId = crypto.randomUUID();
    }
    next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Instance method to add friend
userSchema.methods.addFriend = async function(friendId) {
    console.log(`➕ Adding friend ${friendId} to user ${this.username} (${this._id})`);
    
    if (!this.friends.includes(friendId)) {
        this.friends.push(friendId);
        await this.save();
        console.log(`✅ Friend ${friendId} added successfully to user ${this.username}`);
        console.log(`📋 Updated friends list:`, this.friends);
    } else {
        console.log(`⚠️ Friend ${friendId} already exists in user ${this.username}'s friends list`);
    }
};

// Instance method to remove friend
userSchema.methods.removeFriend = async function(friendId) {
    this.friends = this.friends.filter(id => !id.equals(friendId));
    await this.save();
};

// Instance method to get friends
userSchema.methods.getFriends = async function() {
    try {
        console.log(`🔍 Getting friends for user ${this.username} (${this._id})`);
        console.log(`📋 Raw friends array:`, this.friends);
        
        await this.populate('friends', 'username isOnline lastSeen');
        
        console.log(`✅ Populated friends:`, this.friends.map(f => ({
            id: f._id,
            username: f.username,
            isOnline: f.isOnline,
            lastSeen: f.lastSeen
        })));
        
        return this.friends;
    } catch (error) {
        console.error('❌ Error fetching friends:', error);
        throw new Error('Failed to fetch friends');
    }
};

// Instance method to set online status
userSchema.methods.setOnlineStatus = async function(isOnline) {
    this.isOnline = isOnline;
    this.lastSeen = new Date();
    await this.save();
};

// Static method to find user by username
userSchema.statics.findByUsername = function(username) {
    return this.findOne({ username: username.toLowerCase() });
};

// Static method to find user by secretId
userSchema.statics.findBySecretId = function(secretId) {
    return this.findOne({ secretId });
};

// Static method to get online users
userSchema.statics.getOnlineUsers = function() {
    return this.find({ isOnline: true }).select('username lastSeen');
};

// Transform output to remove sensitive data
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.socketId;
    delete userObject.friends; // Don't expose friends list
    return userObject;
};

// Index for better query performance
userSchema.index({ username: 1 });
userSchema.index({ isOnline: 1 });

const User = mongoose.model('User', userSchema);

export default User;
