const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ role: 'super_admin' });
    if (existing) {
      console.log('Super admin already exists');
      process.exit(0);
    }

    await User.create({
      name: 'Super Admin',
      email: 'admin@unistay.com',
      password: 'admin123456',
      role: 'super_admin',
    });

    console.log('Super admin created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
