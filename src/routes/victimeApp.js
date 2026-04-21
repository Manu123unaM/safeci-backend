const express = require('express');
const router = express.Router();
const victimeController = require('../controllers/victimeController');
const authMiddleware = require('../middleware/auth');

router.get('/guide', victimeController.getGuide);
router.get('/contacts', victimeController.getEmergencyContacts);
router.post('/report', authMiddleware, victimeController.generateReport);

module.exports = router;
