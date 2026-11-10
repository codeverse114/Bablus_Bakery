const express = require('express');
const router = express.Router();
const customerRoutes = require('./customerRoutes');
const wholesaleRoutes = require('./wholesaleRoutes');
const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const store = require('../models/store');

// In-Shop QR Code Redirect (Blueprint Milestone 8 / Section 3.14 & Test Q1/Q2)
router.get('/qr', (req, res) => {
  res.redirect('/?tag=in-shop');
});

// Auth API (Blueprint Addendum Section 5 & 11)
router.use('/api/auth', authRoutes);

// Admin API
router.use('/api/admin', adminRoutes);

// Wholesale API
router.use('/api/wholesale', wholesaleRoutes);

// Customer API
router.use('/api', customerRoutes);

// Test & Simulation Helpers (Supports M2, M3, M5, Admin Automated Tests)
router.post('/api/test/reset', (req, res) => {
  store.reset();
  res.json({ success: true, message: 'Store reset to clean state.' });
});

router.post('/api/test/set-stock', (req, res) => {
  const { productId, stock, locationId } = req.body;
  const p = store.products.find(item => item.id === productId);
  if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
  p.stock = stock;
  if (locationId) {
    store.setLocationStock(locationId, productId, stock);
  } else {
    store.setLocationStock('loc-shop', productId, stock);
    store.setLocationStock('loc-factory', productId, stock);
  }
  res.json({ success: true, product: p });
});

router.post('/api/test/set-product-status', (req, res) => {
  const { productId, is_live } = req.body;
  const p = store.products.find(item => item.id === productId);
  if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
  p.is_live = is_live;
  res.json({ success: true, product: p });
});

router.post('/api/test/expire-reservation', (req, res) => {
  const { reservationId } = req.body;
  const reservation = store.reservations.get(reservationId);
  if (!reservation) return res.status(404).json({ success: false, error: 'Reservation not found' });
  reservation.expiresAt = Date.now() - 1000;
  store.cleanupExpiredReservations();
  res.json({ success: true, status: reservation.status });
});

module.exports = router;
