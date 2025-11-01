import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connection state tracking
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Connection options with improved stability
const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Increased to 30 seconds for better stability
    socketTimeoutMS: 45000, // Increased socket timeout
    connectTimeoutMS: 30000, // Connection timeout
    heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
    maxPoolSize: 10, // Maximum number of connections in the connection pool
    minPoolSize: 2, // Minimum number of connections to maintain
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    waitQueueTimeoutMS: 5000, // How long to wait for a connection from the pool
    retryWrites: true,
    w: 'majority',
    appName: 'KrishnaCrypt-Atlas',
    // For Atlas, we don't need to set ssl as it's handled by the connection string
    // Keep retryWrites enabled for better reliability
    retryReads: true,
    // Additional stability options
    family: 4 // Use IPv4, skip trying IPv6
};

// Debug logging
mongoose.set('debug', process.env.NODE_ENV === 'development');

/**
 * Handle MongoDB connection events with improved monitoring
 */
const setupEventHandlers = () => {
    mongoose.connection.on('connected', () => {
        isConnected = true;
        retryCount = 0;
        console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
        console.log(`📊 Connection pool size: ${mongoose.connection.db?.serverConfig?.poolSize || 'N/A'}`);
    });

    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('Error details:', {
            name: err.name,
            code: err.code,
            codeName: err.codeName
        });
        isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        isConnected = false;
        // Only attempt reconnect if not shutting down gracefully
        if (!process.exitCode) {
            attemptReconnect();
        }
    });

    // Monitor connection pool events
    mongoose.connection.on('fullsetup', () => {
        console.log('📡 MongoDB replica set fully connected');
    });

    mongoose.connection.on('all', () => {
        console.log('🔄 MongoDB all servers connected');
    });

    mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        isConnected = true;
        retryCount = 0;
    });

    // Handle process termination
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // For nodemon
};

/**
 * Attempt to reconnect to MongoDB with exponential backoff
 */
const attemptReconnect = async () => {
    if (retryCount >= MAX_RETRIES) {
        console.error('Max reconnection attempts reached. Please check your MongoDB connection.');
        return;
    }

    const delay = RETRY_DELAY * Math.pow(2, retryCount);
    retryCount++;

    console.log(`Attempting to reconnect to MongoDB (attempt ${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
    
    setTimeout(async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/krishnacrypt', connectionOptions);
        } catch (error) {
            console.error('Reconnection attempt failed:', error.message);
            attemptReconnect();
        }
    }, delay);
};

/**
 * Gracefully shut down the MongoDB connection
 */
const gracefulShutdown = async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
};

/**
 * Connect to MongoDB database
 * Supports both local MongoDB and MongoDB Atlas
 */
const connectDB = async () => {
    if (isConnected) {
        console.log('Using existing database connection');
        return;
    }

    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        console.log('Attempting to connect to MongoDB...');
        console.log('Connection string:', mongoURI.replace(/:([^:]*?)@/, ':***@')); // Hide password in logs
        
        await mongoose.connect(mongoURI, connectionOptions);
        
        setupEventHandlers();
        
        // Verify the connection is actually established
        await mongoose.connection.db.admin().ping();
        console.log('✅ MongoDB connection verified');
        isConnected = true;
        
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error.message);
        if (error.name === 'MongooseServerSelectionError') {
            console.error('This usually means the database server is not reachable.');
            console.error('Please check your MongoDB connection string and ensure the server is running.');
        }
        console.error('Full error:', error);
        attemptReconnect();
        throw error;
    }
};

/**
 * Health check function to verify database connectivity
 */
const healthCheck = async () => {
    try {
        if (!mongoose.connection.db) {
            return { healthy: false, error: 'No database connection' };
        }
        
        // Ping the database
        await mongoose.connection.db.admin().ping();
        
        // Check connection state
        const state = mongoose.connection.readyState;
        const stateNames = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        
        return {
            healthy: state === 1,
            state: stateNames[state] || 'unknown',
            host: mongoose.connection.host,
            name: mongoose.connection.name,
            poolSize: mongoose.connection.db?.serverConfig?.poolSize || 'N/A'
        };
    } catch (error) {
        return {
            healthy: false,
            error: error.message
        };
    }
};

/**
 * Middleware to check database connection before processing requests
 */
const dbHealthMiddleware = async (req, res, next) => {
    if (!isConnected) {
        return res.status(503).json({
            error: 'Database connection unavailable',
            message: 'The database is currently disconnected. Please try again later.'
        });
    }
    next();
};

// Export both the connect function and helper functions
export { connectDB, healthCheck, dbHealthMiddleware };
export const getConnectionStatus = () => isConnected;
