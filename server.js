const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

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
const roommateRoutes = require('./routes/roommateRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Initialize Express
const app = express();

// Set up CORS - Production ready configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Middleware
app.use(helmet());                   // Security headers
app.use(express.json({ limit: '10mb' })); // Data handler with higher limit for base64 images
app.use(express.urlencoded({ limit: '10mb', extended: true }));
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
app.use('/api/roommates', roommateRoutes);
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/safety', require('./routes/safetyRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notices', require('./routes/noticeRoutes'));
app.use('/api/preferences', require('./routes/preferenceRoutes'));

// Root Endpoint
app.get('/', (req, res) => {
  res.send('UniStay API is Running...');
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log('\n========================================');
  console.log(`  UniStay API — port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log('========================================\n');

  // ── MongoDB ──
  try {
    const dbState = require('mongoose').connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    if (dbState === 1) {
      console.log('✅ MongoDB        — connected');
    } else {
      console.log('⏳ MongoDB        — connecting...');
    }
  } catch { console.log('❌ MongoDB        — not configured'); }

  // ── Supabase Storage ──
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    console.log('✅ Supabase       — configured');
  } else {
    console.log('❌ Supabase       — SUPABASE_URL or SUPABASE_SERVICE_KEY missing');
  }

  // ── Stripe ──
  if (process.env.STRIPE_SECRET_KEY) {
    console.log('✅ Stripe         — configured');
  } else {
    console.log('⚠️  Stripe         — STRIPE_SECRET_KEY missing (payments will return 503)');
  }

  // ── Email (Nodemailer) ──
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      await transporter.verify();
      console.log('✅ Email (SMTP)   — connected & verified');
    } catch (err) {
      console.log(`❌ Email (SMTP)   — connection failed: ${err.message}`);
    }
  } else {
    console.log('❌ Email (SMTP)   — EMAIL_USER or EMAIL_PASS missing');
  }

  console.log('\n────────────────────────────────────────\n');
});
