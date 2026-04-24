const db = require('../utils/database');
const redisClient = require('../utils/redis');
const jwt = require('jsonwebtoken');
const admin = require('../services/firebase');
require('dotenv').config();

// ─── Génère un OTP 6 chiffres (dev uniquement) ─────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Demande d'OTP ─────────────────────────────────────────────
exports.requestOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Numéro de téléphone requis'
      });
    }

    if (process.env.NODE_ENV === 'production') {
      // En production : Firebase envoie le SMS directement
      // L'app mobile utilise Firebase SDK pour gérer l'OTP
      // Le backend génère juste un custom token après vérification
      return res.json({
        success: true,
        message: `Utilise Firebase Auth dans l'app pour recevoir le SMS`,
        useFirebase: true
      });
    }

    // En développement : OTP dans les logs
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
    await db.query(
      'INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)',
      [phone, otp, expiresAt]
    );
    await redisClient.setEx(`otp:${phone}`, 600, otp);

    console.log(`OTP pour ${phone}: ${otp}`);

    res.json({
      success: true,
      message: `Code OTP envoyé au ${phone}`,
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('Erreur requestOTP:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── Vérification OTP classique (dev) ─────────────────────────
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Téléphone et code requis'
      });
    }

    const cachedOTP = await redisClient.get(`otp:${phone}`);

    if (!cachedOTP || cachedOTP !== code) {
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

      await db.query(
        'UPDATE otp_codes SET used = true WHERE phone = $1',
        [phone]
      );
    }

    await redisClient.del(`otp:${phone}`);
    const user = await findOrCreateUser(phone);
    const token = generateJWT(user);

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id:    user.id,
        phone: user.phone,
        name:  user.name,
        plan:  user.plan
      }
    });

  } catch (error) {
    console.error('Erreur verifyOTP:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── Vérification Firebase Token (production) ─────────────────
// L'app mobile envoie le token Firebase après vérification SMS
exports.verifyFirebaseToken = async (req, res) => {
  try {
    const { firebaseToken, phone } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        message: 'Token Firebase requis'
      });
    }

    // Vérifie le token Firebase
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);

    // Vérifie que le numéro correspond
    const firebasePhone = decodedToken.phone_number;
    if (phone && firebasePhone !== phone) {
      return res.status(401).json({
        success: false,
        message: 'Numéro de téléphone non correspondant'
      });
    }

    const user = await findOrCreateUser(firebasePhone || phone);
    const token = generateJWT(user);

    res.json({
      success: true,
      message: 'Connexion Firebase réussie',
      token,
      user: {
        id:    user.id,
        phone: user.phone,
        name:  user.name,
        plan:  user.plan
      }
    });

  } catch (error) {
    console.error('Erreur verifyFirebaseToken:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ success: false, message: 'Token Firebase expiré' });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ─── Helpers ───────────────────────────────────────────────────
async function findOrCreateUser(phone) {
  const existing = await db.query(
    'SELECT * FROM users WHERE phone = $1', [phone]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const newUser = await db.query(
    'INSERT INTO users (phone) VALUES ($1) RETURNING *', [phone]
  );
  return newUser.rows[0];
}

function generateJWT(user) {
  return jwt.sign(
    { userId: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}
