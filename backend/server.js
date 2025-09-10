import 'dotenv/config';
import express from 'express';
import http from 'http';
import socketIo from 'socket.io';
import cors from 'cors';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import { initializeSocket, getActiveConnectionsCount } from './socket/socketHandler.js';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS for React frontend
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'KrishnaCrypt server is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        activeConnections: getActiveConnectionsCount()
    });
});

// API Routes
app.use('/api/auth', authRoutes);

// Basic API info endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'KrishnaCrypt API v1.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                profile: 'GET /api/auth/me',
                logout: 'POST /api/auth/logout',
                users: 'GET /api/auth/users'
            },
            websocket: {
                endpoint: '/socket.io/',
                events: [
                    'join_room',
                    'private_message',
                    'decrypt_message',
                    'typing_start',
                    'typing_stop',
                    'get_online_users'
                ]
            }
        }
    });
});

// Initialize Socket.io
initializeSocket(io);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to KrishnaCrypt - Secure Tunneling Chat Application',
        version: '1.0.0',
        features: [
            'End-to-end encrypted messaging',
            'JWT authentication',
            'Real-time communication via Socket.io',
            'Secure private rooms with SHA-256 hashing',
            'VPN-like message tunneling',
            'User presence tracking'
        ],
        documentation: {
            api: '/api',
            health: '/health'
        }
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        ...(NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error('Unhandled Promise Rejection:', err);
    // Close server & exit process
    server.close(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 KrishnaCrypt Server Started Successfully!');
    console.log('='.repeat(50));
    console.log(`📍 Server running on port: ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🔗 Server URL: http://localhost:${PORT}`);
    console.log(`🔌 Socket.io endpoint: http://localhost:${PORT}/socket.io/`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API documentation: http://localhost:${PORT}/api`);
    console.log('='.repeat(50));
    console.log('🔐 Features enabled:');
    console.log('  ✅ JWT Authentication');
    console.log('  ✅ End-to-end Encryption');
    console.log('  ✅ Real-time Messaging');
    console.log('  ✅ Secure Private Rooms');
    console.log('  ✅ VPN-like Tunneling');
    console.log('='.repeat(50));
});
