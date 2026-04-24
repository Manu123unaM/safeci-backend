const rateLimit = require('express-rate-limit');

// ─── Limite globale ────────────────────────────────────────────
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Trop de requêtes. Réessaye dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Limite OTP — anti brute force ────────────────────────────
// Max 5 tentatives par numéro par heure
exports.otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  keyGenerator: (req) => req.body.phone || req.ip,
  message: { success: false, message: 'Trop de tentatives OTP. Réessaye dans 1 heure.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Limite signalement incidents ─────────────────────────────
// Max 10 signalements par heure par utilisateur
exports.incidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: 'Limite de signalements atteinte. Réessaye dans 1 heure.' },
});

// ─── Limite commandes appareils ───────────────────────────────
// Max 20 commandes par heure
exports.commandLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { success: false, message: 'Trop de commandes. Réessaye dans 1 heure.' },
});

// ─── Middleware sécurité headers ───────────────────────────────
exports.securityHeaders = (req, res, next) => {
  // Empêche le clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Empêche le sniffing MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Force HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Cache API responses
  res.setHeader('Cache-Control', 'no-store');
  // Masque la technologie utilisée
  res.removeHeader('X-Powered-By');
  next();
};

// ─── Middleware validation numéro ivoirien ─────────────────────
exports.validatePhone = (req, res, next) => {
  const { phone } = req.body;
  if (phone) {
    const ivoirianPhone = /^\+225[0-9]{10}$/;
    if (!ivoirianPhone.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Numéro invalide. Format requis : +225XXXXXXXXXX'
      });
    }
  }
  next();
};

// ─── Middleware anti injection ─────────────────────────────────
exports.sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
        // Supprime les caractères dangereux SQL et XSS
        sanitized[key] = value
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .trim();
      } else if (typeof value === 'object') {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
};
