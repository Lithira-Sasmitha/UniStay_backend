const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Seed started connecting to MONGODB_URI...');

        const salt = await bcrypt.genSalt(10);
        const hashedP = await bcrypt.hash('password123', salt);

        const students = [
            {
                name: "Kasun Perera",
                username: "it23001144@my.sliit.lk",
                email: "kasun@gmail.com",
                password: hashedP,
                role: "student",
                university: "SLIIT",
                faculty: "Computing",
                year: "3rd Year",
                semester: "2nd Semester",
                hometown: "Kandy",
                address: "45 Peradeniya Rd, Kandy",
                age: 22,
                nic: "200201111234",
                phonenumber: "0771234567",
                isVerified: true,
                universityEmail: "it23001144@my.sliit.lk"
            },
            {
                name: "Amara Silva",
                username: "it23112233@my.sliit.lk",
                email: "amara@gmail.com",
                password: hashedP,
                role: "student",
                university: "SLIIT",
                faculty: "Computing",
                year: "2nd Year",
                semester: "1st Semester",
                hometown: "Colombo",
                address: "12 Marine Dr, Colombo 03",
                age: 21,
                nic: "200356789012",
                phonenumber: "0719876543",
                isVerified: true,
                universityEmail: "it23112233@my.sliit.lk"
            },
            {
                name: "Nuwan Bandara",
                username: "it22998877@my.sliit.lk",
                email: "nuwan@gmail.com",
                password: hashedP,
                role: "student",
                university: "SLIIT",
                faculty: "Engineering",
                year: "4th Year",
                semester: "2nd Semester",
                hometown: "Galle",
                address: "78 Galle Rd, Galle",
                age: 23,
                nic: "200109876543",
                phonenumber: "0704445556",
                isVerified: true,
                universityEmail: "it22998877@my.sliit.lk"
            }
        ];

        for (const s of students) {
            // Use findOneAndUpdate with upsert to avoid duplicates by username
            await User.findOneAndUpdate({ username: s.username }, s, { upsert: true, new: true });
        }

        console.log('Successfully seeded 3 verified students.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
