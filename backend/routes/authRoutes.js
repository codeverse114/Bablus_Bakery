/**
 * BACKREY BASES - AUTH ROUTES
 * Implements Blueprint Addendum Section 5 & Section 11:
 * - POST /api/auth/otp/request
 * - POST /api/auth/otp/verify
 */

const express = require('express');
const router = express.Router();
const store = require('../models/store');

/**
 * POST /api/auth/otp/request
 * Checks registered list before sending OTP (Tests L1, L2, L3, L4).
 */
router.post('/otp/request', (req, res) => {
  try {
    const { mobile, deviceId } = req.body;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number is required.'
      });
    }

    const result = store.requestOtp(mobile, deviceId);
    if (!result.success) {
      // Test L1 & L3: Neutral refusal without sending OTP
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/auth/otp/verify
 * Verifies OTP and returns customer session token (Test L2).
 */
router.post('/otp/verify', (req, res) => {
  try {
    const { mobile, otp, deviceId } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Both mobile number and OTP are required.'
      });
    }

    const result = store.verifyOtp(mobile, otp, deviceId);
    res.json(result);
  } catch (err) {
    const status = err.statusCode || 401;
    res.status(status).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
