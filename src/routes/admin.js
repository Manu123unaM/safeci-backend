const express = require('express');
const router = express.Router();
const db = require('../utils/database');

// Middleware admin simple — mot de passe dans le header
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Accès refusé' });
  }
  next();
};

// Stats globales
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [users, incidents, devices, objects, plans] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as actifs FROM incidents', ['active']),
      db.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as voles FROM devices', ['stolen']),
      db.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as voles FROM tracked_objects', ['stolen']),
      db.query('SELECT plan, COUNT(*) as total FROM users GROUP BY plan ORDER BY total DESC'),
    ]);

    res.json({
      success: true,
      data: {
        users:    { total: parseInt(users.rows[0].total) },
        incidents: {
          total:  parseInt(incidents.rows[0].total),
          actifs: parseInt(incidents.rows[0].actifs)
        },
        devices: {
          total: parseInt(devices.rows[0].total),
          voles: parseInt(devices.rows[0].voles)
        },
        objects: {
          total: parseInt(objects.rows[0].total),
          voles: parseInt(objects.rows[0].voles)
        },
        plans: plans.rows
      }
    });
  } catch (error) {
    console.error('Erreur admin stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Derniers utilisateurs
router.get('/users', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, phone, name, plan, created_at
       FROM users ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Derniers incidents
router.get('/incidents', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, type, severity, status, quarter,
              latitude, longitude, confirmed_by, created_at
       FROM incidents ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Incidents par quartier
router.get('/incidents/by-quarter', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT quarter, COUNT(*) as total,
              COUNT(CASE WHEN severity = 'high' THEN 1 END) as graves
       FROM incidents
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY quarter
       ORDER BY total DESC LIMIT 10`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
