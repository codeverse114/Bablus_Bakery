const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const store = require('../models/store');

// Middleware to extract wholesale session/token if present
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

router.get('/products', customerController.getProducts);
router.get('/products/:id', customerController.getProductById);
router.post('/cart/validate', customerController.validateCart);
router.post('/checkout/start', customerController.startCheckout);
router.post('/checkout/cancel', customerController.cancelCheckout);
router.post('/payments/webhook', customerController.paymentWebhook);
router.get('/orders/:orderNo', customerController.trackOrder);
router.get('/invoices/:id', customerController.downloadInvoice);

module.exports = router;
