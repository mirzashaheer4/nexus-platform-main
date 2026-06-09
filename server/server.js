// ─── IMPORTANT: express-async-errors MUST be the very first import ───────────
require('express-async-errors');

const express      = require('express');
const http         = require('http');
const mongoose     = require('mongoose');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const path         = require('path');
const dotenv       = require('dotenv');

// Security & utility packages (Week 3 additions)
const mongoSanitize = require('express-mongo-sanitize');
const xss           = require('xss-clean');
const hpp           = require('hpp');
const rateLimit     = require('express-rate-limit');
const swaggerJsdoc  = require('swagger-jsdoc');
const swaggerUi     = require('swagger-ui-express');

dotenv.config();

// Initialize nodemailer mailer (Fix 3)
const { initializeMailer } = require('./utils/email');
initializeMailer().catch(err => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Nodemailer] Initialization failed:', err.message);
  }
});

const authRoutes      = require('./routes/auth');
const profileRoutes   = require('./routes/profile');
const dashboardRoutes = require('./routes/dashboard');
const meetingRoutes   = require('./routes/meetings');
const documentRoutes  = require('./routes/documents');
const { router: paymentRoutes, stripeWebhookHandler } = require('./routes/payments'); // Fix 2
const errorHandler    = require('./middleware/errorHandler');
const { initVideoSignaling } = require('./socket/videoSignaling');

const app = express();

// ─── Security: HTTPS Redirect (Fix 9) ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    }
    next();
  });
}

// ─── Security: Helmet with Custom Stripe CSP (Fix 10) ─────────────────────────
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://js.stripe.com"],
    frameSrc: ["https://js.stripe.com"],
    connectSrc: ["'self'", "https://api.stripe.com"],
    imgSrc: ["'self'", "data:", "https:"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
}));

// ─── CORS: allow frontend origin with credentials ─────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// ─── Cookie parser ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Rate Limiters (Fix 8) ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { message: 'Too many requests, please try again after 15 minutes.' }
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many login attempts, please try again after 15 minutes.' }
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  skip: (req) => req.path.includes('webhook') || req.originalUrl.includes('webhook'),
  message: { message: 'Too many payment requests, please try again later.' }
});

// ─── Stripe Webhook route (Fix 2) ─────────────────────────────────────────────
// Mounted BEFORE global express.json() body parser so signature can be verified.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// ─── Global Body Parsers ──────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Security: NoSQL injection & XSS sanitization & parameter pollution ─────────
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health check (no auth required) ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── User search (used by meetings form) ──────────────────────────────────────
const verifyToken = require('./middleware/auth');
const User = require('./models/User');
app.get('/api/users', verifyToken, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.json([]);
  const users = await User.find({ email: { $regex: email, $options: 'i' } })
    .select('name email role')
    .limit(5);
  res.json(users);
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/profile',  profileRoutes);
app.use('/api',          dashboardRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/documents',documentRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);

// ─── Swagger API Documentation (Fix 11) ───────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Nexus API Documentation', version: '1.0.0' },
    servers: [
      { url: 'http://localhost:5000', description: 'Local Server' },
      { url: '/' }
    ],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
      },
    },
  },
  apis: [path.join(__dirname, 'routes/*.js')],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Centralized error handler (must be LAST) ─────────────────────────────────
app.use(errorHandler);

// ─── MongoDB + Server start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[MongoDB] Connected successfully');
    }

    const server = http.createServer(app);
    initVideoSignaling(server);

    server.listen(PORT, () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      }
    });
  })
  .catch((err) => {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  });
