const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User or Email already exists' });
    }

    const user = await User.create({
      name,
      username,
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
        refreshToken, // Added to response body as requested
      });
    }
  } catch (error) {
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
        accessToken,
        refreshToken, // Added to response body as requested
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

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    await user.save();

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

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  updateUserRole,
};
