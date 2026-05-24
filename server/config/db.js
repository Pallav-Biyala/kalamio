import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const connectDB = async (retryCount = 0) => {
    try {
        const conn = await mongoose.connect(process.env.DB_LOCATION, {
            autoIndex: true,
            serverSelectionTimeoutMS: 10000,
            // Connection pool settings
            maxPoolSize: 10,          // Max concurrent connections to MongoDB
            minPoolSize: 2,           // Keep 2 connections warm for low-latency
            maxIdleTimeMS: 30000,     // Close idle connections after 30s
            connectTimeoutMS: 45000,  // Timeout for initial connection
            socketTimeoutMS: 45000,   // Timeout for socket operations
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`❌ MongoDB connection attempt ${retryCount + 1} failed: ${err.message}`);

        if (retryCount < MAX_RETRIES - 1) {
            console.log(`🔄 Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
            return connectDB(retryCount + 1);
        }

        console.error(`❌ All ${MAX_RETRIES} MongoDB connection attempts failed. App running without DB.`);
    }
};

// Monitor connection events
mongoose.connection.on('error', (err) => {
    console.error('⚠️  MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

export default connectDB;

