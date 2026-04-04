const { getFirebaseAdmin } = require('../config/firebase');
const { User } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/token');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { success } = require('../utils/apiResponse');
const { changePasswordSchema, setPasswordSchema } = require('../validators/auth.validator');

/**
 * POST /api/auth/register
 * FE sends Firebase idToken after OTP verification.
 * BE verifies token, creates or retrieves User in MongoDB, returns app tokens.
 */
const register = catchAsync(async (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) return next(new AppError('idToken is required', 400));

  // 1. Verify Firebase ID Token
  const admin = getFirebaseAdmin();
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    return next(new AppError('Firebase token không hợp lệ hoặc đã hết hạn.', 401));
  }

  const { phone_number, email, name, picture, uid } = decoded;
  if (!phone_number && !email) {
    return next(new AppError('Token không có thông tin số điện thoại hoặc email.', 400));
  }

  // 2. Upsert user in MongoDB (find existing or create new)
  let user = await User.findOne({ firebaseUid: uid }).select('+passwordHash');
  let isNewUser = false;

  if (!user) {
    if (phone_number) {
      // 2a. Phone Flow
      const phoneExists = await User.findOne({ phone: phone_number }).select('+passwordHash');
      if (phoneExists) {
        phoneExists.firebaseUid = uid;
        await phoneExists.save();
        user = phoneExists;
      } else {
        user = await User.create({ phone: phone_number, firebaseUid: uid });
        isNewUser = true;
      }
    } else if (email) {
      // 2b. Google / Email Flow
      const emailExists = await User.findOne({ email }).select('+passwordHash');
      if (emailExists) {
        emailExists.firebaseUid = uid;
        await emailExists.save();
        user = emailExists;
      } else {
        user = await User.create({ 
          email, 
          firebaseUid: uid,
          fullName: name || null,
          displayName: name || null,
          avatar: picture || null
        });
        isNewUser = true;
      }
    }
  } else {
    // If user exists but might have missing email/phone from initial registration
    if (email && !user.email) {
      user.email = email;
      await user.save();
    }
  }

  // 3. Generate app-level JWT tokens (not Firebase tokens)
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  return success(res, {
    accessToken,
    refreshToken,
    isNewUser,
    hasPassword: !!user.passwordHash,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id,
      phone: user.phone,
      fullName: user.fullName,
      displayName: user.displayName,
      gender: user.gender,
      hasPassword: !!user.passwordHash,
    },
  }, 200, isNewUser ? 'Đăng ký thành công' : 'Đăng nhập thành công');
});

/**
 * POST /api/auth/check-phone
 * Checks if a phone number already exists and if it has a password set.
 */
const checkPhone = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('Số điện thoại là bắt buộc.', 400));

  // Normalize phone
  const normalizedPhone = phone.startsWith('+') ? phone : `+84${phone.replace(/^0/, '')}`;
  const user = await User.findOne({ phone: normalizedPhone });

  return success(res, {
    exists: !!user,
    hasPassword: !!(user && user.passwordHash),
  }, 200, 'Kiểm tra số điện thoại thành công.');
});

/**
 * POST /api/auth/set-password
 * After OTP verify, new user sets their password.
 * Requires valid accessToken in Authorization header.
 */
const setPassword = catchAsync(async (req, res, next) => {
  const { password } = req.body;
  const { error: validationError } = setPasswordSchema.validate({ 
    newPassword: password, 
    confirmPassword: password 
  }); 
  if (validationError) {
    return next(new AppError(validationError.details[0].message, 400));
  }

  const userId = req.user?.id;
  if (!userId) return next(new AppError('Không xác thực được người dùng.', 401));

  const user = await User.findById(userId);
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  user.passwordHash = await User.hashPassword(password);
  await user.save();

  return success(res, null, 200, 'Mật khẩu đã được đặt thành công.');
});

/**
 * POST /api/auth/change-password
 * Authenticated user changes their password (requires old password).
 */
const changePassword = catchAsync(async (req, res, next) => {
  const { error: validationError } = changePasswordSchema.validate(req.body);
  if (validationError) {
    return next(new AppError(validationError.details[0].message, 400));
  }

  const { oldPassword, newPassword } = req.body;

  const userId = req.user?.id;
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) return next(new AppError('Không tìm thấy người dùng.', 404));

  // Verify old password
  if (user.passwordHash) {
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return next(new AppError('Mật khẩu hiện tại không chính xác.', 401));
    }
  }

  // Set new password
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  return success(res, null, 200, 'Đổi mật khẩu thành công.');
});

/**
 * POST /api/auth/login
 * Returning user logs in with phone + password.
 */
const login = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;
  if (!phone || !password) return next(new AppError('Thiếu số điện thoại hoặc mật khẩu.', 400));

  // Normalize phone: strip leading 0, add +84 for searching
  const normalizedPhone = phone.startsWith('+') ? phone : `+84${phone.replace(/^0/, '')}`;
  const user = await User.findOne({ phone: normalizedPhone }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    return next(new AppError('Số điện thoại chưa được đăng ký hoặc chưa có mật khẩu.', 401));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return next(new AppError('Mật khẩu không chính xác.', 401));

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  return success(res, {
    accessToken,
    refreshToken,
    isNewUser: false,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id,
      phone: user.phone,
      fullName: user.fullName,
      displayName: user.displayName,
      gender: user.gender,
      hasPassword: !!user.passwordHash,
    },
  }, 200, 'Đăng nhập thành công');
});

/**
 * POST /api/auth/google-login
 * FE sends Google idToken (obtained directly from Google Sign-In, not Firebase).
 * BE verifies token using Google API, creates or retrieves User, returns app tokens.
 */
const googleLogin = catchAsync(async (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) return next(new AppError('idToken is required', 400));

  let decoded;
  try {
    const { default: axios } = require('axios'); // Lazy require to avoid top-level load if not needed
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    decoded = response.data;
  } catch (err) {
    return next(new AppError('Google token không hợp lệ hoặc đã hết hạn.', 401));
  }

  const { email, name, picture, sub: googleId } = decoded;
  if (!email) {
    return next(new AppError('Token không có thông tin email.', 400));
  }

  // Upsert user in MongoDB (find existing by email or firebaseUid/googleId)
  let user = await User.findOne({ email }).select('+passwordHash');
  let isNewUser = false;

  if (!user) {
    // If user signs in with Google, we create them with email and googleId
    // Firebase is not strictly required if using direct Google Cloud link
    user = await User.create({
      email,
      firebaseUid: googleId, // Use googleId as fallback to keep model happy or add googleId field
      fullName: name || null,
      displayName: name || null,
      avatar: picture || null,
      isProfileComplete: false,
    });
    isNewUser = true;
  }

  // Generate app-level JWT tokens
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  return success(res, {
    accessToken,
    refreshToken,
    isNewUser,
    isProfileComplete: user.isProfileComplete,
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      displayName: user.displayName,
      gender: user.gender,
      hasPassword: !!user.passwordHash,
    },
  }, 200, isNewUser ? 'Đăng ký Google thành công' : 'Đăng nhập Google thành công');
});

module.exports = { register, checkPhone, setPassword, changePassword, login, googleLogin };
