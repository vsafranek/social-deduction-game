const mongoose = require('mongoose');

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'test') {
  require('dotenv').config({ path: '.env.test' });
} else if (nodeEnv === 'development') {
  require('dotenv').config({ path: '.env.development' });
} else {
  // Production - load .env
  require('dotenv').config({ path: '.env' });
}

const connectDB = async () => {
  try {
    // Use environment variable or fallback to local MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/social-deduction-game';
    
    console.log('🔌 Attempting MongoDB connection to:', mongoURI);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB připojeno:', mongoURI);
    
    // Test connection
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Mongoose disconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB chyba připojení:', error.message);
    console.error('Stack:', error.stack);
    throw error; // Re-throw to stop app
  }
};

module.exports = connectDB;
