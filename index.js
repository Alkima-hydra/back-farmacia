require('dotenv').config();
const express = require('express');
const errorHandler = require('./middleware/errorHandler');
const prescriptionRouter = require('./routers/prescriptionRouter');
const labRouter = require('./routers/labRouter');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'prescription-lab-service', timestamp: new Date() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/prescriptions', prescriptionRouter);
app.use('/labs', labRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prescription & Lab Service running on port ${PORT}`);
  console.log(`    Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
