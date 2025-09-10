import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required' 
            });
        }

        const jwtSecret = process.env.JWT_SECRET || 'krishna-crypt-secret-key';
        
        // Verify token
        const decoded = jwt.verify(token, jwtSecret);
        
        // Find user by ID from token
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token - user not found' 
            });
        }

        // Attach user to request object
        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired' 
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Authentication failed' 
        });
    }
};

/**
 * Socket.io Authentication Middleware
 * Verifies JWT token for socket connections
 */
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const jwtSecret = process.env.JWT_SECRET || 'krishna-crypt-secret-key';
        
        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace('Bearer ', '');
        
        // Verify token
        const decoded = jwt.verify(cleanToken, jwtSecret);
        
        // Find user by ID from token
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        // Attach user to socket object
        socket.user = user;
        next();

    } catch (error) {
        console.error('Socket authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Invalid token'));
        }
        
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
        }

        return next(new Error('Authentication error: Authentication failed'));
    }
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
    const jwtSecret = process.env.JWT_SECRET || 'krishna-crypt-secret-key';
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    return jwt.sign(
        { 
            userId: user._id,
            username: user.username 
        },
        jwtSecret,
        { 
            expiresIn: jwtExpiresIn 
        }
    );
};

/**
 * Verify JWT token without middleware
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
    const jwtSecret = process.env.JWT_SECRET || 'krishna-crypt-secret-key';
    return jwt.verify(token, jwtSecret);
};

/**
 * Extract user ID from JWT token
 * @param {string} token - JWT token
 * @returns {string|null} User ID or null if invalid
 */
const getUserIdFromToken = (token) => {
    try {
        const decoded = verifyToken(token);
        return decoded.userId;
    } catch (error) {
        console.error('Token extraction error:', error);
        return null;
    }
};

export {
    authenticateToken,
    authenticateSocket,
    generateToken,
    verifyToken,
    getUserIdFromToken
};
