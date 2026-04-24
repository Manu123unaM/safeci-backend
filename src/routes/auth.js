const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { otpLimiter, validatePhone } = require('../middleware/security');

// Dev — OTP dans les logs
router.post('/otp/request', otpLimiter, validatePhone, authController.requestOTP);
router.post('/otp/verify',  otpLimiter, validatePhone, authController.verifyOTP);

// Production — Firebase Phone Auth
router.post('/firebase/verify', otpLimiter, authController.verifyFirebaseToken);

module.exports = router;
