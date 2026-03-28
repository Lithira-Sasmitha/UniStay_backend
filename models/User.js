const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for UniStay Boarding System
 * Roles: superadmin, student, boardingowner
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    username: {
      type: String,
      required: [true, 'Please add a username'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 8,
      select: false, // Security: Don't return password by default
    },
    role: {
      type: String,
      enum: ['superadmin', 'student', 'boardingowner'],
      default: 'student',
    },
    university: {
      type: String,
      required: [
        function() { return this.role === 'student'; },
        'Please add your university'
      ],
    },
    address: {
      type: String,
      required: [true, 'Please add your address'],
    },
    age: {
      type: Number,
      required: [true, 'Please add your age'],
    },
    nic: {
      type: String,
      required: [true, 'Please add your NIC'],
      unique: true, // NIC should be unique
    },
    phonenumber: {
      type: String,
      required: [true, 'Please add your phone number'],
    },
    faculty: {
      type: String,
      trim: true,
    },
    year: {
      type: String,
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    },
    semester: {
      type: String,
      enum: ['1st Semester', '2nd Semester'],
    },
    hometown: {
      type: String,
      trim: true,
    },
    universityEmail: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // Allow multiple nulls for unverified users
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    tempEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Hash password using bcryptjs before saving
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method: Compare entered password with hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
