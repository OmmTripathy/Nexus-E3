const express = require('express');
const http = require('http');
const app = express();

const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const { getAllRoutes, getRouteByBus } = require('./controllers/routeController');
const { initSocket } = require('./config/socket');
const connectDB = require('./config/connectDB');

// ====== CONFIG ======
// Render injects PORT automatically; BACKEND_PORT used as local fallback
const port = process.env.PORT || process.env.BACKEND_PORT || 8000;

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:8080', 'http://localhost:5173'];

// ====== CREATE HTTP SERVER ======
const server = http.createServer(app);

// ====== MIDDLEWARE ======
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ====== DATABASE ======
connectDB()
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
  });

// ====== HEALTH CHECK (used by Render) ======
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ====== ROUTES ======
app.get('/', (req, res) => {
  res.json({ message: 'Campus Commute API is running 🚀' });
});

const userRoutes = require('./routes/userRouter');
app.use('/user', userRoutes);

const otpRoutes = require('./routes/otpRouter');
app.use('/api/otp', otpRoutes);

app.get('/routes', getAllRoutes);
app.get('/routes/:busId', getRouteByBus);

// ====== SOCKET.IO INIT ======
initSocket(server, allowedOrigins);

// ====== START SERVER ======
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`);
});
