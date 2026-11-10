const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const store = require('../models/store');

// Middleware to extract customer or wholesale session/token if present
router.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = req.headers['x-customer-token'] || req.headers['x-wholesale-token'] || authHeader;
  
  if (token) {
    let cleanToken = token;
    if (cleanToken.startsWith('Bearer ')) cleanToken = cleanToken.slice(7).trim();

    // Check in registered customer list (Blueprint Addendum Section 5)
    const customer = store.customers.find(c => 
      c.id === cleanToken || 
      cleanToken.includes(c.id) || 
      c.mobile === cleanToken || 
      c.email === cleanToken
    );

    if (customer) {
      req.customer = customer;
      req.user = { 
        ...customer, 
        is_wholesale: customer.section !== 'regular',
        is_customer: true
      };
    } else {
      // Legacy wholesaler fallback
      const wholesaler = store.wholesalers.find(w => w.id === cleanToken || w.email === cleanToken || w.mobile === cleanToken);
      if (wholesaler) {
        req.user = { ...wholesaler, is_wholesale: true };
      }
    }
  }
  next();
});

router.get('/prices', customerController.getResolvedPrices);
router.get('/me/statement', customerController.getOwnStatement);
router.get('/products', customerController.getProducts);
router.get('/products/:id', customerController.getProductById);
router.post('/cart/validate', customerController.validateCart);
router.post('/checkout/start', customerController.startCheckout);
router.post('/checkout/cancel', customerController.cancelCheckout);
router.post('/payments/webhook', customerController.paymentWebhook);
router.get('/orders/:orderNo', customerController.trackOrder);
router.post('/orders/:orderNo/reorder', customerController.reorderOrder);
router.get('/invoices/:id', customerController.downloadInvoice);

module.exports = router;
