const db = require('../utils/database');
require('dotenv').config();

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

exports.reportIncident = async (req, res) => {
  try {
    const { type, description, latitude, longitude, severity, quarter } = req.body;
    const userId = req.user?.id || null;

    if (!type || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Type, latitude et longitude sont requis'
      });
    }

    const validTypes = [
      'phone_theft', 'bag_snatching', 'moto_theft',
      'assault', 'burglary', 'pickpocket', 'scam', 'other'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type invalide. Types acceptés : ${validTypes.join(', ')}`
      });
    }

    const result = await db.query(
      `INSERT INTO incidents
        (type, description, latitude, longitude, severity, quarter, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [type, description || null, latitude, longitude,
       severity || 'medium', quarter || 'Abidjan', userId]
    );

    res.status(201).json({
      success: true,
      message: 'Incident signalé avec succès',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur reportIncident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

exports.getNearbyIncidents = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude et longitude requises'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    const result = await db.query(
      `SELECT * FROM incidents
       WHERE status = 'active'
       AND created_at > NOW() - INTERVAL '24 hours'
       AND latitude BETWEEN $1 AND $2
       AND longitude BETWEEN $3 AND $4
       ORDER BY created_at DESC
       LIMIT 50`,
      [
        userLat - (radiusKm / 111),
        userLat + (radiusKm / 111),
        userLng - (radiusKm / 111),
        userLng + (radiusKm / 111)
      ]
    );

    const incidents = result.rows.map(incident => ({
      ...incident,
      distance_km: calculateDistance(
        userLat, userLng,
        parseFloat(incident.latitude),
        parseFloat(incident.longitude)
      ).toFixed(2)
    }));

    incidents.sort((a, b) => a.distance_km - b.distance_km);

    res.json({
      success: true,
      count: incidents.length,
      data: incidents
    });

  } catch (error) {
    console.error('Erreur getNearbyIncidents:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

exports.confirmIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE incidents SET confirmed_by = confirmed_by + 1
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident introuvable' });
    }
    res.json({ success: true, message: 'Incident confirmé', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur confirmIncident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

exports.resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE incidents SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Incident introuvable' });
    }
    res.json({ success: true, message: 'Incident résolu', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur resolveIncident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT quarter, type, COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as actifs,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolus,
        MAX(created_at) as dernier_incident
       FROM incidents
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY quarter, type
       ORDER BY total DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur getStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
