const admin = require('firebase-admin');

let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) return;

  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn('⚠️  Firebase env vars not fully set. Firebase Admin SDK disabled.');
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized.');
  } catch (err) {
    console.warn('⚠️  Firebase Admin init failed (check FIREBASE_* env vars):', err.message);
  }
};

const getFirebaseAdmin = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin SDK is not initialized. Check your .env vars.');
  }
  return admin;
};

module.exports = { initFirebase, getFirebaseAdmin };
