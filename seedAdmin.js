require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding...');

    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'superadmin@unistay.com';
    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'superadmin';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'superadmin';
    
    // Find if admin already exists
    let admin = await User.findOne({ 
      $or: [{ email: adminEmail }, { username: adminUsername }] 
    });

    if (admin) {
      console.log('Super Admin exists. Updating password...');
      admin.password = adminPassword;
      await admin.save();
    } else {
      // Create Super Admin
      admin = await User.create({
        name: 'Main Super Admin',
        username: adminUsername,
        email: adminEmail,
        password: adminPassword, 
        role: 'superadmin',
        university: 'System',
        address: 'Main Office',
        age: 30,
        nic: '000000000V',
        phonenumber: '0000000000'
      });
    }

    console.log('-----------------------------------------');
    console.log('✅ SUPER ADMIN READY!');
    console.log(`Username: ${admin.username}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Password: ${adminPassword}`);
    console.log('-----------------------------------------');
    process.exit();
  } catch (error) {
    console.error('Error seeding Super Admin:', error.message);
    process.exit(1);
  }
};

seedSuperAdmin();
