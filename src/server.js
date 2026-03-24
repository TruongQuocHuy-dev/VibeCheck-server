const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const { initFirebase } = require('./config/firebase');
const { initSocket } = require('./config/socket');

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

  // Create HTTP server and attach Socket.io
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, HOST, () => {
    const host = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`🚀 Server running on http://${host}:${PORT}`);
    console.log(`✅ Health check: http://${host}:${PORT}/api/health`);
    console.log(`🔌 Socket.io ready`);
  });
};

startServer();

