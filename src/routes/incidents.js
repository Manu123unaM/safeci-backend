const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const authMiddleware = require('../middleware/auth');

router.get('/nearby', incidentController.getNearbyIncidents);
router.get('/stats', incidentController.getStats);
router.post('/', authMiddleware, incidentController.reportIncident);
router.post('/:id/confirm', authMiddleware, incidentController.confirmIncident);
router.patch('/:id/resolve', authMiddleware, incidentController.resolveIncident);

module.exports = router;
