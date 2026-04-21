const express = require('express');
const router = express.Router();
const trackCIController = require('../controllers/trackCIController');
const authMiddleware = require('../middleware/auth');

// Routes publiques
router.get('/verify/:qrCode', trackCIController.verifyObject);
router.get('/stats', trackCIController.getTrackCIStats);

// Routes protégées
router.get('/mine', authMiddleware, trackCIController.getMyObjects);
router.post('/', authMiddleware, trackCIController.registerObject);
router.patch('/:objectId/stolen', authMiddleware, trackCIController.reportObjectStolen);
router.patch('/:objectId/found', authMiddleware, trackCIController.markObjectFound);

module.exports = router;
