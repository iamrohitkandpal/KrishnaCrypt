import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connection state tracking
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Connection options
const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // 5 seconds timeout for Atlas
    socketTimeoutMS: 30000, // 30 seconds socket timeout
    maxPoolSize: 10, // Maximum number of connections in the connection pool
    retryWrites: true,
    w: 'majority',
    appName: 'KrishnaCrypt-Atlas',
    // For Atlas, we don't need to set ssl as it's handled by the connection string
    // Keep retryWrites enabled for better reliability
    retryReads: true
};

// Debug logging
mongoose.set('debug', process.env.NODE_ENV === 'development');

/**
 * Handle MongoDB connection events
 */
const setupEventHandlers = () => {
    mongoose.connection.on('connected', () => {
        isConnected = true;
        retryCount = 0;
        console.log(`MongoDB connected: ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        isConnected = false;
        attemptReconnect();
    });

    // Handle process termination
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
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

// Export both the connect function and a helper to check connection status
export { connectDB };
export const getConnectionStatus = () => isConnected;
