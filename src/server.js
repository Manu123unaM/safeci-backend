const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez dans 15 minutes.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SafeCI API v1.0',
    version: '1.0.0',
    status: 'running',
    modules: ['auth', 'civAlert', 'securePhone', 'trackCI'],
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/auth',      require('./routes/auth'));
app.use('/api/v1/incidents', require('./routes/incidents'));
app.use('/api/v1/devices',   require('./routes/devices'));
app.use('/api/v1/sms',       require('./routes/sms'));

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Erreur serveur interne' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SafeCI API démarrée sur le port ${PORT}`);
  console.log(`Environnement : ${process.env.NODE_ENV}`);
  console.log(`URL : http://187.124.208.94:${PORT}`);
});

module.exports = app;
