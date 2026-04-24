const rateLimit = require('express-rate-limit');

// ─── Limite globale ────────────────────────────────────────────
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Trop de requêtes. Réessaye dans 15 minutes.' },
});

// ─── Limite OTP ────────────────────────────────────────────────
exports.otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Trop de tentatives OTP. Réessaye dans 1 heure.' },
});

// ─── Limite incidents ──────────────────────────────────────────
exports.incidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Limite de signalements atteinte.' },
});

// ─── Limite commandes ──────────────────────────────────────────
exports.commandLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Trop de commandes.' },
});

// ─── Headers sécurité ──────────────────────────────────────────
exports.securityHeaders = (req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Powered-By');
  next();
};

// ─── Validation numéro ivoirien ────────────────────────────────
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

// ─── Sanitisation input ────────────────────────────────────────
exports.sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'string') {
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
  if (req.body)  req.body  = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
};
