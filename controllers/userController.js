const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOTP } = require('../utils/emailService');

/**
 * Generate Access Token (Short-lived: 15m)
 */
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
  });
};

/**
 * Generate Refresh Token (Long-lived: 7d)
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/users/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { 
      name, 
      username,
      email, 
      password, 
      role, 
      university, 
      address, 
      age, 
      nic, 
      phonenumber 
    } = req.body;

    // Auto-generate username from email if not provided
    const finalUsername = username || email;

    const userExists = await User.findOne({ 
      $or: [{ email }, { username: finalUsername }] 
    });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User or Email already exists' });
    }

    const user = await User.create({
      name,
      username: finalUsername,
      email,
      password,
      role: role || 'student', // Default to student for public registration
      university,
      address,
      age,
      nic,
      phonenumber,
    });

    if (user) {
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id);

      // Save Refresh Token to database
      user.refreshToken = refreshToken;
      await user.save();

      // Set Refresh Token in HTTP-only Cookie
      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessToken,
        refreshToken,
      });
    }
  } catch (error) {
    console.error('Registration Error:', error.message);
    // Handle Mongoose Validation Error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    // Handle Mongo Duplicate Key Error (NIC, Username, etc)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Unique field duplication error (NIC or Username already exists)' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Authenticate user & get tokens
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id);

      // Save Refresh Token to database
      user.refreshToken = refreshToken;
      await user.save();

      // Set Refresh Token in HTTP-only Cookie
      res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        universityEmail: user.universityEmail,
        accessToken,
        refreshToken,
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get new Access Token using Refresh Token
 * @route   GET /api/users/refresh
 * @access  Public (Requires Cookie)
 */
const refreshToken = async (req, res) => {
  try {
    const cookies = req.cookies;

    if (!cookies?.jwt) {
      return res.status(401).json({ success: false, message: 'Refresh token missing' });
    }

    const refreshToken = cookies.jwt;

    // Verify Refresh Token
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ success: false, message: 'Forbidden: Invalid refresh token' });

      const user = await User.findById(decoded.id);
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      const accessToken = generateAccessToken(user._id, user.role);
      res.json({ success: true, accessToken });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/users/logout
 * @access  Private
 */
const logoutUser = (req, res) => {
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'Strict', secure: process.env.NODE_ENV === 'production' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * @desc    Update user role (Super Admin Only)
 * @route   PATCH /api/users/:id/role
 * @access  Private/SuperAdmin
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    // Validate if role is valid
    if (!['superadmin', 'student', 'boardingowner'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: false }
    );

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          university: user.university,
          address: user.address,
          age: user.age,
          nic: user.nic,
          phonenumber: user.phonenumber,
          universityEmail: user.universityEmail,
          isVerified: user.isVerified,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.university = req.body.university || user.university;
      user.address = req.body.address || user.address;
      user.age = req.body.age || user.age;
      user.nic = req.body.nic || user.nic;
      user.phonenumber = req.body.phonenumber || user.phonenumber;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          university: updatedUser.university,
          address: updatedUser.address,
          age: updatedUser.age,
          nic: updatedUser.nic,
          phonenumber: updatedUser.phonenumber,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete user (Super Admin Only)
 * @route   DELETE /api/users/:id
 * @access  Private/SuperAdmin
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Optional: Prevent deleting the superadmin themselves or other superadmins if needed
    // if (user.role === 'superadmin') {
    //   return res.status(400).json({ success: false, message: 'Cannot delete a superadmin' });
    // }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get all users (Super Admin Only)
 * @route   GET /api/users
 * @access  Private/SuperAdmin
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update any user details (Super Admin Only)
 * @route   PUT /api/users/:id
 * @access  Private/SuperAdmin
 */
const updateUserByAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.university = req.body.university || user.university;
      user.address = req.body.address || user.address;
      user.age = req.body.age || user.age;
      user.nic = req.body.nic || user.nic;
      user.phonenumber = req.body.phonenumber || user.phonenumber;
      if (req.body.role) {
        user.role = req.body.role;
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          university: updatedUser.university,
          address: updatedUser.address,
          age: updatedUser.age,
          nic: updatedUser.nic,
          phonenumber: updatedUser.phonenumber,
        },
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Send verification OTP to student email
 * @route   POST /api/users/send-otp
 * @access  Private
 */
const sendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findById(req.user._id);

    // If email provided, use it. Otherwise use current email if valid.
    const targetEmail = email || user.email;

    if (!targetEmail.toLowerCase().endsWith('@my.sliit.lk')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only university emails (@my.sliit.lk) are allowed for verification' 
      });
    }

    // Check if targetEmail is already taken by another verified user
    const existingUser = await User.findOne({ email: targetEmail, isVerified: true });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ success: false, message: 'This email is already verified by another account' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.tempEmail = targetEmail; // Store target for verification step
    await user.save();

    await sendOTP(targetEmail, otp);

    res.json({ success: true, message: `OTP sent successfully to ${targetEmail}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Verify OTP and set user as verified
 * @route   POST /api/users/verify-otp
 * @access  Private
 */
const verifyEmailOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    if (user.tempEmail) {
      user.universityEmail = user.tempEmail;
    }
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.tempEmail = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully! You are now a Verified Student.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    List potential roommates (Verified students without active bookings)
 * @route   GET /api/roommates
 * @access  Private (Middlewares will handle checks)
 */
const listRoommates = async (req, res) => {
  try {
    const roommates = await User.find({
      _id: { $ne: req.user._id },
      role: 'student',
      isVerified: true
    }).select('name email university address age nic phonenumber');
    res.json({ success: true, roommates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  updateUserRole,
  getUserProfile,
  updateUserProfile,
  deleteUser,
  getAllUsers,
  updateUserByAdmin,
  sendVerificationOTP,
  verifyEmailOTP,
  listRoommates,
};
