const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/otp/request', authController.requestOTP);
router.post('/otp/verify', authController.verifyOTP);

module.exports = router;
