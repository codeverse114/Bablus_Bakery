const express = require('express');
const router = express.Router();
const wholesaleController = require('../controllers/wholesaleController');
const store = require('../models/store');

// Auth middleware for wholesale or section customer token
router.use((req, res, next) => {
  const token = req.headers['x-customer-token'] || req.headers['x-wholesale-token'] || req.headers['authorization'];
  if (token) {
    let cleanToken = token;
    if (cleanToken.startsWith('Bearer ')) cleanToken = cleanToken.slice(7).trim();

    const customer = store.customers.find(c =>
      c.id === cleanToken ||
      cleanToken.includes(c.id) ||
      c.mobile === cleanToken ||
      c.email === cleanToken
    );
    if (customer) {
      req.customer = customer;
      req.user = { ...customer, is_wholesale: customer.section !== 'regular', is_customer: true };
    } else {
      const wholesaler = store.wholesalers.find(w => w.id === cleanToken || w.email === cleanToken || w.mobile === cleanToken);
      if (wholesaler) {
        req.user = { ...wholesaler, is_wholesale: true };
      }
    }
  }
  next();
});

// Blueprint Addendum Section 11: Public wholesale self-registration is removed
router.post('/register', (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Public wholesale sign-up is removed. Please request access via WhatsApp.',
    whatsapp_url: 'https://wa.me/918219775396'
  });
});
router.post('/login', wholesaleController.login);
router.get('/dashboard', wholesaleController.getDashboard);
router.get('/orders', wholesaleController.getOrders);
router.post('/reorder/:orderId', wholesaleController.reorder);
router.get('/statement', wholesaleController.getStatement);

module.exports = router;
