const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

const app = require('./app');
const connectDB = require('./config/database');
const { initFirebase } = require('./config/firebase');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  // Init Firebase Admin SDK
  initFirebase();

  // Connect to MongoDB
  await connectDB();

  // Seed static vibe tags IF empty!
  const { seedVibes } = require('./config/seed');
  await seedVibes();

  app.listen(PORT, HOST, () => {
    const host = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`🚀 Server running on http://${host}:${PORT}`);
    console.log(`✅ Health check: http://${host}:${PORT}/api/health`);
  });
};

startServer();
