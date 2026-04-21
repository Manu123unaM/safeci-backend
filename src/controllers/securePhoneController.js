const db = require('../utils/database');
const redisClient = require('../utils/redis');
require('dotenv').config();

// Enregistrer un appareil
exports.registerDevice = async (req, res) => {
  try {
    const { imei, brand, model } = req.body;
    const userId = req.user.id;

    if (!imei || !brand || !model) {
      return res.status(400).json({
        success: false,
        message: 'IMEI, marque et modèle requis'
      });
    }

    // Vérifie si l'IMEI existe déjà
    const existing = await db.query(
      'SELECT * FROM devices WHERE imei = $1',
      [imei]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cet IMEI est déjà enregistré'
      });
    }

    const result = await db.query(
      `INSERT INTO devices (user_id, imei, brand, model, status)
       VALUES ($1, $2, $3, $4, 'protected')
       RETURNING *`,
      [userId, imei, brand, model]
    );

    res.status(201).json({
      success: true,
      message: 'Appareil enregistré et protégé',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur registerDevice:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Signaler un appareil volé
exports.reportStolen = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { lastLocation } = req.body;
    const userId = req.user.id;

    const device = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (device.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appareil introuvable'
      });
    }

    await db.query(
      `UPDATE devices
       SET status = 'stolen',
           stolen_at = NOW(),
           last_location = $1
       WHERE id = $2`,
      [lastLocation ? JSON.stringify(lastLocation) : null, deviceId]
    );

    // Stocke dans Redis pour accès rapide par l'app
    await redisClient.setEx(
      `device:stolen:${device.rows[0].imei}`,
      86400 * 30, // 30 jours
      JSON.stringify({
        deviceId,
        userId,
        imei: device.rows[0].imei,
        stolenAt: new Date().toISOString()
      })
    );

    res.json({
      success: true,
      message: 'Appareil signalé volé — surveillance activée',
      data: { deviceId, status: 'stolen' }
    });

  } catch (error) {
    console.error('Erreur reportStolen:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Vérifier si un IMEI est signalé volé
exports.checkIMEI = async (req, res) => {
  try {
    const { imei } = req.params;

    // Vérifie dans Redis d'abord
    const cached = await redisClient.get(`device:stolen:${imei}`);
    if (cached) {
      return res.json({
        success: true,
        stolen: true,
        message: 'Cet appareil est signalé volé',
        data: JSON.parse(cached)
      });
    }

    // Vérifie dans PostgreSQL
    const result = await db.query(
      `SELECT d.*, u.phone as owner_phone
       FROM devices d
       JOIN users u ON d.user_id = u.id
       WHERE d.imei = $1 AND d.status = 'stolen'`,
      [imei]
    );

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        stolen: true,
        message: 'Cet appareil est signalé volé',
        data: {
          imei,
          brand: result.rows[0].brand,
          model: result.rows[0].model,
          stolenAt: result.rows[0].stolen_at
        }
      });
    }

    res.json({
      success: true,
      stolen: false,
      message: 'Cet appareil n\'est pas signalé volé'
    });

  } catch (error) {
    console.error('Erreur checkIMEI:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Recevoir une photo du voleur
exports.uploadTheftPhoto = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { photo, location, timestamp } = req.body;

    if (!photo) {
      return res.status(400).json({
        success: false,
        message: 'Photo requise'
      });
    }

    // Sauvegarde la photo en base (base64)
    const device = await db.query(
      `UPDATE devices
       SET theft_photos = COALESCE(theft_photos, '[]'::jsonb) || $1::jsonb,
           last_location = COALESCE($2, last_location)
       WHERE id = $3
       RETURNING *`,
      [
        JSON.stringify([{ photo, location, timestamp: timestamp || new Date().toISOString() }]),
        location ? JSON.stringify(location) : null,
        deviceId
      ]
    );

    // Stocke dans Redis pour accès temps réel
    await redisClient.lPush(
      `device:photos:${deviceId}`,
      JSON.stringify({ photo, location, timestamp })
    );

    // Garde seulement les 10 dernières photos
    await redisClient.lTrim(`device:photos:${deviceId}`, 0, 9);

    res.json({
      success: true,
      message: 'Photo reçue',
      data: { deviceId, timestamp }
    });

  } catch (error) {
    console.error('Erreur uploadTheftPhoto:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Récupérer les photos du voleur
exports.getTheftPhotos = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    // Vérifie que l'appareil appartient à l'utilisateur
    const device = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (device.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appareil introuvable'
      });
    }

    // Récupère depuis Redis
    const photos = await redisClient.lRange(
      `device:photos:${deviceId}`, 0, -1
    );

    res.json({
      success: true,
      data: {
        device: {
          id: device.rows[0].id,
          brand: device.rows[0].brand,
          model: device.rows[0].model,
          status: device.rows[0].status,
          stolenAt: device.rows[0].stolen_at,
          lastLocation: device.rows[0].last_location
        },
        photos: photos.map(p => JSON.parse(p))
      }
    });

  } catch (error) {
    console.error('Erreur getTheftPhotos:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Envoyer une commande à distance
exports.sendCommand = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command } = req.body;
    const userId = req.user.id;

    const validCommands = ['lock', 'unlock', 'wipe', 'photo', 'locate', 'alarm'];

    if (!validCommands.includes(command)) {
      return res.status(400).json({
        success: false,
        message: `Commande invalide. Commandes valides : ${validCommands.join(', ')}`
      });
    }

    // Vérifie que l'appareil appartient à l'utilisateur
    const device = await db.query(
      'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (device.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appareil introuvable'
      });
    }

    // Publie la commande dans Redis
    // L'app mobile écoute ce canal et exécute la commande
    await redisClient.setEx(
      `device:command:${device.rows[0].imei}`,
      300, // 5 minutes pour exécuter
      JSON.stringify({
        command,
        deviceId,
        issuedAt: new Date().toISOString(),
        issuedBy: userId
      })
    );

    const commandLabels = {
      lock:   'Verrouillage activé',
      unlock: 'Déverrouillage envoyé',
      wipe:   'Effacement des données envoyé',
      photo:  'Demande de photo envoyée',
      locate: 'Demande de localisation envoyée',
      alarm:  'Alarme activée'
    };

    res.json({
      success: true,
      message: commandLabels[command],
      data: { deviceId, command, status: 'pending' }
    });

  } catch (error) {
    console.error('Erreur sendCommand:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// L'app mobile vérifie s'il y a une commande en attente
exports.checkCommand = async (req, res) => {
  try {
    const { imei } = req.params;

    const command = await redisClient.get(`device:command:${imei}`);

    if (!command) {
      return res.json({
        success: true,
        hasCommand: false
      });
    }

    // Supprime la commande après lecture
    await redisClient.del(`device:command:${imei}`);

    res.json({
      success: true,
      hasCommand: true,
      data: JSON.parse(command)
    });

  } catch (error) {
    console.error('Erreur checkCommand:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Récupérer mes appareils
exports.getMyDevices = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY registered_at DESC',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Erreur getMyDevices:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
