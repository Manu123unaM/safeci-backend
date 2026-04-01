const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  const { imei, brand, model } = req.body;
  if (!imei || !brand || !model) {
    return res.status(400).json({ success: false, message: 'IMEI, marque et modèle requis' });
  }
  res.status(201).json({ success: true, message: 'Appareil enregistré avec succès' });
});

router.get('/mine', (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
