import express from 'express';
import User from '../models/User.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Username must be at least 3 characters long'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        // Create new user
        const user = new User({
            username: username.toLowerCase().trim(),
            password
        });

        await user.save();

        // Generate JWT token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    createdAt: user.createdAt
                },
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        // Find user
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update online status
        await user.setOnlineStatus(true);

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    isOnline: user.isOnline,
                    lastSeen: user.lastSeen
                },
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user (requires authentication)
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Update user online status
        await req.user.setOnlineStatus(false);

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: {
                    id: req.user._id,
                    username: req.user.username,
                    isOnline: req.user.isOnline,
                    lastSeen: req.user.lastSeen,
                    createdAt: req.user.createdAt
                }
            }
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

/**
 * GET /api/auth/users
 * Get all users (requires authentication)
 */
router.get('/users', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({})
            .select('username isOnline lastSeen createdAt')
            .sort({ username: 1 });

        res.json({
            success: true,
            data: {
                users: users.map(user => ({
                    id: user._id,
                    username: user.username,
                    isOnline: user.isOnline,
                    lastSeen: user.lastSeen,
                    createdAt: user.createdAt
                })),
                total: users.length,
                online: users.filter(user => user.isOnline).length
            }
        });

    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

export default router;
