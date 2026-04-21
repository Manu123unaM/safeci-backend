const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const redisClient = require('../utils/redis');

// Webhook Twilio — reçoit les SMS entrants
router.post('/incoming', async (req, res) => {
  try {
    const { From, Body } = req.body;
    const message = Body?.trim().toUpperCase();

    console.log(`SMS reçu de ${From}: ${message}`);

    // Format commande : SAFECI-LOCK-IMEI ou SAFECI-PHOTO-IMEI
    if (message?.startsWith('SAFECI-')) {
      const parts = message.split('-');
      if (parts.length >= 3) {
        const command = parts[1]; // LOCK, PHOTO, WIPE, LOCATE
        const imei    = parts[2]; // IMEI de l'appareil

        const validCommands = ['LOCK', 'PHOTO', 'WIPE', 'LOCATE', 'ALARM'];

        if (validCommands.includes(command)) {
          // Vérifie que l'IMEI existe
          const device = await db.query(
            'SELECT * FROM devices WHERE imei = $1',
            [imei]
          );

          if (device.rows.length > 0) {
            // Publie la commande dans Redis
            await redisClient.setEx(
              `device:command:${imei}`,
              300,
              JSON.stringify({
                command: command.toLowerCase(),
                source:  'sms',
                from:    From,
                issuedAt: new Date().toISOString()
              })
            );

            console.log(`Commande SMS ${command} envoyée à l'appareil ${imei}`);
          }
        }
      }
    }

    // Réponse TwiML vide
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    console.error('Erreur SMS incoming:', error);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

module.exports = router;
