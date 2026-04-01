const db = require('../utils/database');
const redisClient = require('../utils/redis');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Génère un code OTP à 6 chiffres
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Demande d'OTP
exports.requestOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone requis'
      });
    }

    // Validation format +225XXXXXXXXXX
    const phoneRegex = /^\+225[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Format invalide. Utilisez +225XXXXXXXXXX'
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Supprime les anciens OTP pour ce numéro
    await db.query(
      'DELETE FROM otp_codes WHERE phone = $1',
      [phone]
    );

    // Sauvegarde le nouvel OTP
    await db.query(
      'INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
      [phone, otp, expiresAt]
    );

    // Stocke aussi dans Redis pour accès rapide
    await redisClient.setEx(`otp:${phone}`, 600, otp);

    // En production : envoyer via Twilio
    // Pour le dev : on retourne le code directement
    console.log(`OTP pour ${phone}: ${otp}`);

    res.json({
      success: true,
      message: `Code OTP envoyé au ${phone}`,
      // Retirer en production !
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('Erreur requestOTP:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Vérification OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Téléphone et code requis'
      });
    }

    // Vérifie dans Redis d'abord (plus rapide)
    const cachedOTP = await redisClient.get(`otp:${phone}`);

    if (!cachedOTP || cachedOTP !== code) {
      // Vérifie dans PostgreSQL
      const result = await db.query(
        `SELECT * FROM otp_codes 
         WHERE phone = $1 AND code = $2 
         AND expires_at > NOW() AND used = false`,
        [phone, code]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Code invalide ou expiré'
        });
      }

      // Marque l'OTP comme utilisé
      await db.query(
        'UPDATE otp_codes SET used = true WHERE phone = $1',
        [phone]
      );
    }

    // Supprime de Redis
    await redisClient.del(`otp:${phone}`);

    // Cherche ou crée l'utilisateur
    let user;
    const existing = await db.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const newUser = await db.query(
        `INSERT INTO users (phone) VALUES ($1) RETURNING *`,
        [phone]
      );
      user = newUser.rows[0];
    }

    // Génère le JWT
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        plan: user.plan
      }
    });

  } catch (error) {
    console.error('Erreur verifyOTP:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
