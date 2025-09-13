import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Array} Array of error messages
 */
function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    if (password.length > 128) {
        errors.push('Password must not exceed 128 characters');
    }
    
    return errors;
}

/**
 * Calculate password strength score
 * @param {string} password - Password to evaluate
 * @returns {Object} Strength score and level
 */
function calculatePasswordStrength(password) {
    let score = 0;
    let feedback = [];
    
    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Character variety scoring
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
    
    // Complexity bonus
    if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score += 1;
    }
    
    let level = 'weak';
    let color = '#dc3545';
    
    if (score >= 6) {
        level = 'strong';
        color = '#28a745';
    } else if (score >= 4) {
        level = 'medium';
        color = '#ffc107';
    }
    
    return { score, level, color };
}

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

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Username must be between 3-20 characters'
            });
        }

        // Username validation - alphanumeric and underscores only
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({
                success: false,
                message: 'Username can only contain letters, numbers, and underscores'
            });
        }

        // Strong password validation
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Password requirements not met',
                errors: passwordErrors
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

        // Generate unique secret ID
        let secretId;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            secretId = crypto.randomUUID();
            attempts++;
        } while (await User.findBySecretId(secretId) && attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate unique secret ID'
            });
        }

        // Create new user
        const user = new User({
            username: username.toLowerCase().trim(),
            password,
            secretId
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
                    secretId: user.secretId,
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

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user._id,
                    username: user.username,
                    secretId: user.secretId,
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
                    secretId: req.user.secretId,
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
 * GET /api/auth/friends
 * Get user's friends (requires authentication)
 */
router.get('/friends', authenticateToken, async (req, res) => {
    try {
        const friends = await req.user.getFriends();

        res.json({
            success: true,
            data: {
                friends: friends.map(friend => ({
                    id: friend._id,
                    username: friend.username,
                    isOnline: friend.isOnline,
                    lastSeen: friend.lastSeen
                })),
                total: friends.length,
                online: friends.filter(friend => friend.isOnline).length
            }
        });

    } catch (error) {
        console.error('Friends fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch friends'
        });
    }
});

/**
 * POST /api/auth/add-friend
 * Add friend by secret ID (requires authentication)
 */
router.post('/add-friend', authenticateToken, async (req, res) => {
    try {
        const { secretId } = req.body;

        if (!secretId) {
            return res.status(400).json({
                success: false,
                message: 'Secret ID is required'
            });
        }

        // Find the friend by secretId
        const friend = await User.findBySecretId(secretId);
        if (!friend) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this secret ID'
            });
        }

        // Check if trying to add self
        if (friend._id.equals(req.user._id)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot add yourself as a friend'
            });
        }

        // Check if already friends
        if (req.user.friends.includes(friend._id)) {
            return res.status(409).json({
                success: false,
                message: 'Already friends with this user'
            });
        }

        // Add friend
        await req.user.addFriend(friend._id);

        res.json({
            success: true,
            message: 'Friend added successfully',
            data: {
                friend: {
                    id: friend._id,
                    username: friend.username,
                    isOnline: friend.isOnline
                }
            }
        });

    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add friend'
        });
    }
});

/**
 * POST /api/auth/validate-password
 * Validate password strength without registration
 */
router.post('/validate-password', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required'
            });
        }

        const errors = validatePassword(password);
        const strength = calculatePasswordStrength(password);

        res.json({
            success: true,
            data: {
                isValid: errors.length === 0,
                errors,
                strength
            }
        });

    } catch (error) {
        console.error('Password validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Password validation failed'
        });
    }
});

export default router;
