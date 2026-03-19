require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Initialize Express
const app = express();

// Set up CORS - Production ready configuration
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow Vite and React frontend
    credentials: true,                                       // Allow sending/receiving cookies
  })
);

// Middleware
app.use(helmet());                   // Security headers
app.use(express.json());             // Data handler
app.use(cookieParser());             // Cookie handler

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));            // Log HTTP requests
}

// Connect to MongoDB
connectDB().then(() => {
  console.log('Database operation completed.');
});

// Mount Routes
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.send('UniStay API is Running...');
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
