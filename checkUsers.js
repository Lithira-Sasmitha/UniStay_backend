const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await User.countDocuments({ role: 'student', isVerified: true });
        console.log('Verified students in DB:', count);
        const all = await User.find({ role: 'student', isVerified: true }).limit(5);
        console.log('Sample names:', all.map(u => u.name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
