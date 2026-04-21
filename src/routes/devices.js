const express = require('express');
const router = express.Router();
const securePhoneController = require('../controllers/securePhoneController');
const authMiddleware = require('../middleware/auth');

// Routes publiques
router.get('/check/:imei', securePhoneController.checkIMEI);
router.get('/command/:imei', securePhoneController.checkCommand);

// Routes protégées
router.get('/mine', authMiddleware, securePhoneController.getMyDevices);
router.post('/', authMiddleware, securePhoneController.registerDevice);
router.patch('/:deviceId/stolen', authMiddleware, securePhoneController.reportStolen);
router.post('/:deviceId/photos', securePhoneController.uploadTheftPhoto);
router.get('/:deviceId/photos', authMiddleware, securePhoneController.getTheftPhotos);
router.post('/:deviceId/command', authMiddleware, securePhoneController.sendCommand);

module.exports = router;
