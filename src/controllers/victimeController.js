require('dotenv').config();

// Guide étape par étape après un vol
exports.getGuide = async (req, res) => {
  try {
    const guide = {
      title: "Que faire après un vol ?",
      subtitle: "Suis ces étapes dans l'ordre pour maximiser tes chances de récupérer tes affaires",
      steps: [
        {
          step: 1,
          icon: "🚨",
          title: "Signale immédiatement sur SafeCI",
          priority: "urgent",
          duration: "2 minutes",
          actions: [
            "Ouvre SafeCI → SecurePhone → Signaler comme volé",
            "Active la surveillance GPS et photo automatique",
            "Envoie une alerte à tes contacts de confiance"
          ],
          tip: "Plus tu agis vite, plus tu as de chances de localiser l'appareil"
        },
        {
          step: 2,
          icon: "📞",
          title: "Bloque ta carte SIM",
          priority: "urgent",
          duration: "5 minutes",
          actions: [
            "Orange CI : appelle le 700 depuis un autre téléphone",
            "MTN CI : appelle le 180 depuis un autre téléphone",
            "Moov CI : appelle le 109 depuis un autre téléphone",
            "Demande le blocage de la SIM et la conservation du numéro"
          ],
          tip: "Le voleur peut utiliser ton numéro pour recevoir des OTP bancaires — bloque rapidement"
        },
        {
          step: 3,
          icon: "💰",
          title: "Sécurise tes comptes mobile money",
          priority: "urgent",
          duration: "10 minutes",
          actions: [
            "Orange Money : appelle le 144 ou *144#",
            "Wave : contacte le support Wave via l'app sur un autre téléphone",
            "MTN MoMo : appelle le 155",
            "Modifie ton code PIN si possible"
          ],
          tip: "Le voleur peut tenter d'accéder à ton argent mobile — agis avant lui"
        },
        {
          step: 4,
          icon: "🏛",
          title: "Porte plainte à la police",
          priority: "important",
          duration: "1-2 heures",
          actions: [
            "Rends-toi au commissariat le plus proche avec ta pièce d'identité",
            "Fournis l'IMEI de ton téléphone (visible sur SafeCI)",
            "Demande un récépissé de dépôt de plainte",
            "Garde ce document — il est nécessaire pour l'assurance"
          ],
          contacts: [
            { name: "Police Nationale CI", number: "111" },
            { name: "Gendarmerie CI", number: "170" },
            { name: "SAMU", number: "185" }
          ],
          tip: "Le récépissé de plainte est indispensable pour tout remboursement assurance"
        },
        {
          step: 5,
          icon: "📱",
          title: "Signale l'IMEI volé",
          priority: "important",
          duration: "15 minutes",
          actions: [
            "Contacte l'ARTCI pour signaler l'IMEI volé",
            "ARTCI : Plateau, rue des Jardins — Tel: +225 20 31 33 69",
            "Fournis le récépissé de plainte et l'IMEI",
            "L'ARTCI peut bloquer le téléphone sur tous les réseaux CI"
          ],
          tip: "Un IMEI bloqué rend le téléphone inutilisable sur tous les réseaux ivoiriens"
        },
        {
          step: 6,
          icon: "🔐",
          title: "Sécurise tes comptes en ligne",
          priority: "important",
          duration: "20 minutes",
          actions: [
            "Change les mots de passe de tes emails",
            "Déconnecte l'appareil de WhatsApp (Paramètres → Appareils liés)",
            "Déconnecte de Facebook, Instagram, TikTok",
            "Active la double authentification sur tous tes comptes"
          ],
          tip: "Priorité : email et WhatsApp — ils donnent accès à tout le reste"
        },
        {
          step: 7,
          icon: "📄",
          title: "Déclare le sinistre à ton assurance",
          priority: "normal",
          duration: "Variable",
          actions: [
            "Contacte ton assureur dans les 48h suivant le vol",
            "Fournis : récépissé de plainte, facture d'achat, IMEI",
            "SafeCI peut fournir un rapport de localisation comme preuve",
            "Demande le formulaire de déclaration de sinistre"
          ],
          tip: "SafeCI génère automatiquement un rapport de vol avec horodatage et localisation"
        }
      ],
      emergency_contacts: [
        { name: "Police Nationale", number: "111", available: "24h/24" },
        { name: "Gendarmerie", number: "170", available: "24h/24" },
        { name: "Orange CI Support", number: "700", available: "24h/24" },
        { name: "MTN CI Support", number: "180", available: "24h/24" },
        { name: "Wave Support", number: "App Wave", available: "24h/24" },
        { name: "ARTCI", number: "+225 20 31 33 69", available: "Lun-Ven 8h-17h" }
      ]
    };

    res.json({
      success: true,
      data: guide
    });

  } catch (error) {
    console.error('Erreur getGuide:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Générer un rapport de vol
exports.generateReport = async (req, res) => {
  try {
    const { deviceId, incidentDescription, stolenAt, location } = req.body;
    const userId = req.user.id;

    const db = require('../utils/database');

    // Récupère les infos utilisateur
    const user = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    // Récupère les infos appareil si fourni
    let device = null;
    if (deviceId) {
      const deviceResult = await db.query(
        'SELECT * FROM devices WHERE id = $1 AND user_id = $2',
        [deviceId, userId]
      );
      if (deviceResult.rows.length > 0) {
        device = deviceResult.rows[0];
      }
    }

    const report = {
      reportId: `SAFECI-RPT-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      generatedBy: 'SafeCI Platform',
      victim: {
        phone: user.rows[0]?.phone,
        reportDate: new Date().toLocaleDateString('fr-FR')
      },
      device: device ? {
        brand:    device.brand,
        model:    device.model,
        imei:     device.imei,
        status:   device.status,
        stolenAt: device.stolen_at,
        lastLocation: device.last_location
      } : null,
      incident: {
        description:  incidentDescription || 'Vol déclaré via SafeCI',
        declaredAt:   stolenAt || new Date().toISOString(),
        location:     location || null
      },
      nextSteps: [
        "Porter plainte au commissariat avec ce rapport",
        "Contacter l'opérateur télécom pour bloquer la SIM",
        "Signaler l'IMEI à l'ARTCI",
        "Déclarer le sinistre à l'assurance"
      ],
      certification: "Ce rapport a été généré automatiquement par la plateforme SafeCI. Il peut être utilisé comme preuve complémentaire lors du dépôt de plainte."
    };

    res.json({
      success: true,
      message: 'Rapport de vol généré',
      data: report
    });

  } catch (error) {
    console.error('Erreur generateReport:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Contacts d'urgence
exports.getEmergencyContacts = async (req, res) => {
  res.json({
    success: true,
    data: [
      { name: "Police Nationale CI",  number: "111",               category: "police",    available: "24h/24" },
      { name: "Gendarmerie CI",        number: "170",               category: "police",    available: "24h/24" },
      { name: "SAMU",                  number: "185",               category: "urgence",   available: "24h/24" },
      { name: "Pompiers CI",           number: "180",               category: "urgence",   available: "24h/24" },
      { name: "Orange CI",             number: "700",               category: "telecom",   available: "24h/24" },
      { name: "MTN CI",                number: "180",               category: "telecom",   available: "24h/24" },
      { name: "Moov CI",               number: "109",               category: "telecom",   available: "24h/24" },
      { name: "Wave Support",          number: "Via app Wave",      category: "mobile_money", available: "24h/24" },
      { name: "Orange Money",          number: "144",               category: "mobile_money", available: "24h/24" },
      { name: "MTN MoMo",             number: "155",               category: "mobile_money", available: "24h/24" },
      { name: "ARTCI",                 number: "+225 20 31 33 69",  category: "regulateur",available: "Lun-Ven 8h-17h" }
    ]
  });
};
