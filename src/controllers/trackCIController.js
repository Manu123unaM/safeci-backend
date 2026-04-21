const db = require('../utils/database');
const crypto = require('crypto');
require('dotenv').config();

// Génère un QR code unique SafeCI
function generateQRCode(userId, category) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `SAFECI-${category.toUpperCase()}-${timestamp}-${random}`.toUpperCase();
}

// Enregistrer un objet
exports.registerObject = async (req, res) => {
  try {
    const { category, brand, model, serialNumber, description } = req.body;
    const userId = req.user.id;

    if (!category || !brand || !model) {
      return res.status(400).json({
        success: false,
        message: 'Catégorie, marque et modèle requis'
      });
    }

    const validCategories = [
      'phone', 'laptop', 'motorcycle', 'bicycle',
      'tablet', 'camera', 'generator', 'other'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Catégorie invalide. Valides : ${validCategories.join(', ')}`
      });
    }

    const qrCode = generateQRCode(userId, category);

    const result = await db.query(
      `INSERT INTO tracked_objects
        (user_id, category, brand, model, serial_number, description, qr_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered')
       RETURNING *`,
      [userId, category, brand, model, serialNumber || null, description || null, qrCode]
    );

    res.status(201).json({
      success: true,
      message: 'Objet enregistré avec succès',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur registerObject:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Mes objets enregistrés
exports.getMyObjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM tracked_objects
       WHERE user_id = $1
       ORDER BY registered_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error('Erreur getMyObjects:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Vérifier un objet par QR code (public — pour les revendeurs)
exports.verifyObject = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const result = await db.query(
      `SELECT
        obj.id, obj.category, obj.brand, obj.model,
        obj.status, obj.registered_at, obj.stolen_at,
        obj.qr_code,
        u.phone as owner_phone
       FROM tracked_objects obj
       JOIN users u ON obj.user_id = u.id
       WHERE obj.qr_code = $1`,
      [qrCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objet non trouvé dans la base SafeCI',
        safe: false
      });
    }

    const obj = result.rows[0];
    const isStolen = obj.status === 'stolen';

    res.json({
      success: true,
      safe: !isStolen,
      stolen: isStolen,
      message: isStolen
        ? '⚠️ ATTENTION — Cet objet est signalé volé !'
        : '✅ Objet vérifié — Non signalé volé',
      data: {
        category:      obj.category,
        brand:         obj.brand,
        model:         obj.model,
        status:        obj.status,
        registeredAt:  obj.registered_at,
        stolenAt:      obj.stolen_at,
        ownerPhone:    isStolen ? obj.owner_phone : null
      }
    });

  } catch (error) {
    console.error('Erreur verifyObject:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Signaler un objet volé
exports.reportObjectStolen = async (req, res) => {
  try {
    const { objectId } = req.params;
    const userId = req.user.id;

    const obj = await db.query(
      'SELECT * FROM tracked_objects WHERE id = $1 AND user_id = $2',
      [objectId, userId]
    );

    if (obj.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objet introuvable'
      });
    }

    await db.query(
      `UPDATE tracked_objects
       SET status = 'stolen', stolen_at = NOW()
       WHERE id = $1`,
      [objectId]
    );

    res.json({
      success: true,
      message: 'Objet signalé volé — base de données mise à jour',
      data: { objectId, status: 'stolen' }
    });

  } catch (error) {
    console.error('Erreur reportObjectStolen:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Marquer un objet comme retrouvé
exports.markObjectFound = async (req, res) => {
  try {
    const { objectId } = req.params;
    const userId = req.user.id;

    await db.query(
      `UPDATE tracked_objects
       SET status = 'found', stolen_at = NULL
       WHERE id = $1 AND user_id = $2`,
      [objectId, userId]
    );

    res.json({
      success: true,
      message: 'Objet marqué comme retrouvé',
      data: { objectId, status: 'found' }
    });

  } catch (error) {
    console.error('Erreur markObjectFound:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Statistiques TrackCI
exports.getTrackCIStats = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_objets,
        COUNT(CASE WHEN status = 'registered' THEN 1 END) as proteges,
        COUNT(CASE WHEN status = 'stolen' THEN 1 END) as voles,
        COUNT(CASE WHEN status = 'found' THEN 1 END) as retrouves,
        COUNT(DISTINCT category) as categories
       FROM tracked_objects`
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur getTrackCIStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
