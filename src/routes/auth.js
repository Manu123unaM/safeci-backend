const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { otpLimiter, validatePhone } = require('../middleware/security');

router.post('/otp/request', otpLimiter, validatePhone, authController.requestOTP);
router.post('/otp/verify',  otpLimiter, validatePhone, authController.verifyOTP);

module.exports = router;
