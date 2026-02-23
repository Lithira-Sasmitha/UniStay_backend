const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const maskedURI = process.env.MONGODB_URI.replace(/:([^@]+)@/, ':****@');
    console.log(`Using URI: ${maskedURI}`);
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('-----------------------------------------');
    console.error('❌ MONGODB CONNECTION ERROR');
    console.error(`Message: ${error.message}`);
    console.error('-----------------------------------------');
    console.error('How to fix this:');
    console.error('1. Log in to MongoDB Atlas (cloud.mongodb.com)');
    console.error('2. Go to "Database Access" and reset password for user "itpm2026" to "itpm2026"');
    console.error('3. Go to "Network Access" and ensure your IP (or 0.0.0.0/0) is added');
    console.error('-----------------------------------------');
  }
};

module.exports = connectDB;
