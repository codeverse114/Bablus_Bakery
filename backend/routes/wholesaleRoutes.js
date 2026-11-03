const express = require('express');
const router = express.Router();
const wholesaleController = require('../controllers/wholesaleController');
const store = require('../models/store');

// Auth middleware for wholesale token
router.use((req, res, next) => {
  const token = req.headers['x-wholesale-token'];
  if (token) {
    const wholesaler = store.wholesalers.find(w => w.id === token || w.email === token || w.mobile === token);
    if (wholesaler) {
      req.user = { ...wholesaler, is_wholesale: true };
    }
  }
  next();
});

router.post('/register', wholesaleController.register);
router.post('/login', wholesaleController.login);
router.get('/dashboard', wholesaleController.getDashboard);
router.get('/orders', wholesaleController.getOrders);
router.post('/reorder/:orderId', wholesaleController.reorder);
router.get('/statement', wholesaleController.getStatement);

module.exports = router;
