const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Sécurité
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// ── Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez dans 15 minutes.'
});
app.use(limiter);

// ── Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SafeCI API v1.0 - Bienvenue !',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SafeCI API opérationnelle',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// ── Routes API
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/incidents', require('./routes/incidents'));
app.use('/api/v1/devices', require('./routes/devices'));

// ── 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route introuvable'
  });
});

// ── Erreurs globales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SafeCI API démarrée sur le port ${PORT}`);
  console.log(`Environnement : ${process.env.NODE_ENV}`);
  console.log(`URL : http://187.124.208.94:${PORT}`);
});

module.exports = app;
