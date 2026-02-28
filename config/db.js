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
  }
};

module.exports = connectDB;
