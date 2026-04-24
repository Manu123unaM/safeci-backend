const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'safeci.firebasestorage.app'
  });
}

module.exports = admin;
