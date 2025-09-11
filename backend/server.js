import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Import routes and handlers
import authRoutes from './routes/auth.js';
import { initializeSocket, getActiveConnectionsCount } from './socket/socketHandler.js';
import { connectDB, isConnected } from './config/database.js';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS for React frontend
const allowedOrigins = [
    process.env.CLIENT_URL
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    // Connection persistence settings
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    connectTimeout: 20000, // 20 seconds
    maxHttpBufferSize: 1e8, // 100MB for large messages
    allowEIO3: true, // Allow Engine.IO v3 clients
    cookie: false // Disable cookies for better compatibility
});

// Environment variables
const PORT = process.env.PORT || 5432;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize the server
const startServer = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDB();
        
        // Add basic route for health check
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'ok',
                database: isConnected ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString()
            });
        });

        // Start the server
        server.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🚀 KrishnaCrypt Server Started Successfully!');
            console.log('='.repeat(50));
            console.log(`📍 Server running on port: ${PORT}`);
            console.log(`🌐 Environment: ${NODE_ENV}`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}`);
            console.log(`💾 Database: ${isConnected ? 'Connected' : 'Disconnected'}`);
            console.log('='.repeat(50));
            
            // Initialize Socket.io after server starts
            initializeSocket(io);
        });
        
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use.`);
            } else {
                console.error('Server error:', error);
            }
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error('Dependencies not installed. Run: npm install');
        }
        process.exit(1);
    }
};

// Middleware to check database connection
app.use((req, res, next) => {
    if (!isConnected && req.path !== '/health') {
        return res.status(503).json({
            success: false,
            message: 'Database connection not available',
            timestamp: new Date().toISOString()
        });
    }
    next();
});

// CORS Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
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

// Start the server
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
