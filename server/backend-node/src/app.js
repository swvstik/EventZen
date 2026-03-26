import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import Database from './config/database.js';
import authRoutes         from './routes/authRoutes.js';
import userRoutes         from './routes/userRoutes.js';
import attendeeRoutes     from './routes/attendeeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import internalRoutes     from './routes/internalRoutes.js';
import vendorApplicationRoutes from './routes/vendorApplicationRoutes.js';
import adminVendorApplicationRoutes from './routes/adminVendorApplicationRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import AppError from './utils/AppError.js';
import { startNotificationEventConsumer, stopNotificationEventConsumer } from './messaging/notificationEventConsumer.js';
import { getKafkaRuntimeState, stopKafka } from './messaging/kafkaBus.js';

// Load env vars from the service folder first, then shared repo-level .env files.
const dotenvCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
];
const dotenvPath = dotenvCandidates.find((candidatePath) => fs.existsSync(candidatePath));
if (dotenvPath) {
  dotenv.config({ path: dotenvPath, override: false });
}

// -- Validate required env vars ------------------------------------------------
const required = ['MONGO_URI', 'JWT_SECRET', 'TOKEN_HASH_SECRET', 'INTERNAL_SERVICE_SECRET'];
required.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const PORT      = process.env.PORT     || 8081;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:8080').trim();

if (!process.env.CLIENT_URL) {
  console.warn('CLIENT_URL is not set. Falling back to http://localhost:8080 for email links.');
}

process.env.CLIENT_URL = CLIENT_URL;

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const db  = new Database(MONGO_URI);
const app = express();
let server = null;

// -- Global middleware ---------------------------------------------------------
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// -- Health check --------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'eventzen-node',
    modules:   ['auth', 'attendees', 'notifications', 'vendor-applications'],
    kafka: getKafkaRuntimeState(),
    timestamp: new Date().toISOString(),
  });
});

// -- Routes --------------------------------------------------------------------
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/attendees',     attendeeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal',      internalRoutes);
app.use('/api/vendor-applications', vendorApplicationRoutes);
app.use('/api/admin/vendor-applications', adminVendorApplicationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);

// -- 404 handler ---------------------------------------------------------------
app.use((req, res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// -- Global error handler (must be last) ---------------------------------------
app.use(globalErrorHandler);

// -- Start ---------------------------------------------------------------------
const start = async () => {
  await db.connect();
  try {
    await startNotificationEventConsumer();
  } catch (err) {
    // Keep core APIs available even when broker is temporarily unreachable.
    console.warn(`Kafka consumer startup skipped: ${err?.message || err}`);
  }

  server = app.listen(PORT, () => {
    console.log(`Node service running on http://localhost:${PORT}`);
    console.log(`    Auth:          /api/auth`);
    console.log(`    Attendees:     /api/attendees`);
    console.log(`    Notifications: /api/notifications`);
  });
};

start();

const shutdown = async () => {
  try {
    await stopNotificationEventConsumer();
    await stopKafka();
  } finally {
    if (server) {
      server.close(() => process.exit(0));
      return;
    }
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
