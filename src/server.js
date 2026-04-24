const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
require('dotenv').config();

const {
  globalLimiter,
  securityHeaders,
  sanitizeInput
} = require('./middleware/security');

const app = express();

// ─── Sécurité ──────────────────────────────────────────────────
app.use(helmet());
app.use(securityHeaders);
app.use(cors({
  origin: ['https://safeci.ddns.net', 'http://187.124.208.94'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));

// ─── Logging ───────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Rate limiting global ──────────────────────────────────────
app.use(globalLimiter);

// ─── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Sanitisation input ────────────────────────────────────────
app.use(sanitizeInput);

// ─── Routes ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success:   true,
    message:   'SafeCI API v1.0',
    version:   '1.0.0',
    status:    'running',
    modules:   ['auth', 'civAlert', 'securePhone', 'trackCI', 'victimeApp'],
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success:   true,
    uptime:    process.uptime(),
    memory:    process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/auth',      require('./routes/auth'));
app.use('/api/v1/incidents', require('./routes/incidents'));
app.use('/api/v1/devices',   require('./routes/devices'));
app.use('/api/v1/sms',       require('./routes/sms'));
app.use('/api/v1/trackci',   require('./routes/trackCI'));
app.use('/api/v1/victime',   require('./routes/victimeApp'));
app.use('/api/v1/admin',     require('./routes/admin'));

// ─── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable' });
});

// ─── Erreurs globales ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Erreur serveur interne' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SafeCI API démarrée sur le port ${PORT}`);
  console.log(`Environnement : ${process.env.NODE_ENV}`);
  console.log(`URL : https://safeci.ddns.net`);
});

module.exports = app;
