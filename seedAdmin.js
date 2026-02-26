require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected for seeding...');

    const adminEmail = 'superadmin@unistay.com';
    const adminPassword = 'superadmin';
    
    // Find if admin already exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log('Super Admin exists. Updating password to "superadmin"...');
      admin.password = adminPassword;
      await admin.save();
    } else {
      // Create Super Admin
      admin = await User.create({
        name: 'Main Super Admin',
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
    console.log(`Email: ${admin.email}`);
    console.log('Password: superadmin');
    console.log('-----------------------------------------');
    process.exit();
  } catch (error) {
    console.error('Error seeding Super Admin:', error.message);
    process.exit(1);
  }
};

seedSuperAdmin();
