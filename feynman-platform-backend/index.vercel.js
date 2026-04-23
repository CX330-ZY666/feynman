const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

require('dotenv').config();

const app = express();

const parseOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const configuredOrigins = [
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.CLIENT_URL),
];

if (process.env.VERCEL_URL) {
  configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
}

const originAllowList = new Set(configuredOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }

    if (originAllowList.has(origin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'production' && originAllowList.size === 0) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

let isDbConnected = false;
const connectDB = async () => {
  if (isDbConnected) return;
  await mongoose.connect(process.env.MONGO_URI);
  isDbConnected = true;
  console.log('MongoDB connected (Vercel runtime)');
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    res.status(500).json({ msg: 'Database connection failed', error: error.message });
  }
});

app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/feynman-attempts', require('./routes/feynmanAttempts'));
app.use('/api/graph', require('./routes/graph'));
app.use('/api/relations', require('./routes/knowledgeRelations'));
app.use('/api/feynman-practice', require('./routes/feynmanPractice'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Feynman Platform API is running (Vercel slim)' });
});

module.exports = app;