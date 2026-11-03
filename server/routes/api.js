const express = require('express');
const router = express.Router();
const store = require('../store');
const invoice = require('../invoice');

// Middleware to extract wholesale session/token if present
function authMiddleware(req, res, next) {
  const token = req.headers['x-wholesale-token'];
  if (token) {
    const wholesaler = store.wholesalers.find(w => w.id === token || w.email === token || w.mobile === token);
    if (wholesaler) {
      req.user = { ...wholesaler, is_wholesale: true };
    }
  }
  next();
}

router.use(authMiddleware);

/**
 * GET /api/products
 * Live products with verified price and live stock status.
 * Filtered by optional category.
 */
router.get('/products', (req, res) => {
  try {
    const { category, search } = req.query;
    let products = store.getLiveProducts(req.user);

    if (category && category !== 'All') {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: products.length,
      categories: ["All", "Pizza bases", "Burger bases", "Bread"],
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/products/:id
 * Product detail with pack size, stock, description.
 */
router.get('/products/:id', (req, res) => {
  try {
    const product = store.getProductById(req.params.id, req.user);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found or currently offline.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cart/validate
 * Server enforces true prices and verifies stock availability.
 * Browser never dictates prices.
 */
router.post('/cart/validate', (req, res) => {
  try {
    const { items = [] } = req.body;
    const cartAnalysis = store.validateCart(items, req.user);
    res.json({
      success: true,
      ...cartAnalysis
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/checkout/start
 * Validates address and cart, locks stock for 10 minutes, generates reservation (Blueprint 3.5 & Rule 3)
 */
router.post('/checkout/start', (req, res) => {
  try {
    const { items = [], customer = {}, inShop = false } = req.body;
    
    // Validate phone number (mandatory 10 digits as per Section 3.5 & Rule 7; Test G3)
    const phoneClean = (customer.mobile || '').replace(/\D/g, '');
    if (!phoneClean || phoneClean.length !== 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Enter a 10-digit mobile number.' 
      });
    }

    if (!customer.name || customer.name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter your full name.' 
      });
    }

    if (!customer.address || customer.address.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter a complete delivery address.' 
      });
    }

    // Call store atomic reservation
    const reservationResult = store.createReservation({
      items,
      customer: {
        ...customer,
        mobile: phoneClean
      },
      user: req.user,
      inShop
    });

    if (!reservationResult.success) {
      return res.status(400).json({
        success: false,
        error: reservationResult.error,
        validation: reservationResult.validation
      });
    }

    res.json({
      success: true,
      ...reservationResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/checkout/cancel
 * Release stock hold immediately when user cancels payment or closes checkout (Test G5)
 */
router.post('/checkout/cancel', (req, res) => {
  try {
    const { reservationId } = req.body;
    if (!reservationId) {
      return res.status(400).json({ success: false, error: 'Missing reservationId' });
    }
    const result = store.cancelReservation(reservationId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/payments/webhook
 * Verifies payment, deducts stock permanently, confirms order (Blueprint 3.6 & Tests G4, G5, G7, G9)
 */
router.post('/payments/webhook', (req, res) => {
  try {
    const { reservationId, paymentId, paymentSignature, simulatedStatus = 'success' } = req.body;

    if (!reservationId) {
      return res.status(400).json({ success: false, error: 'Missing reservationId' });
    }

    const effectivePaymentId = paymentId || ('pay_' + Date.now() + '_' + Math.floor(Math.random() * 1000));

    const result = store.confirmPayment({
      reservationId,
      paymentId: effectivePaymentId,
      paymentSignature,
      simulatedStatus
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/orders/:orderNo?phone=
 * Track order status steps: Paid, Packed, Out for delivery, Delivered (Blueprint 3.7 & Test G3)
 */
router.get('/orders/:orderNo', (req, res) => {
  const { orderNo } = req.params;
  const { phone } = req.query;

  const result = store.getOrder(orderNo, phone);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }

  if (result.error) {
    return res.status(403).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    order: result
  });
});

// Login rate limiting store (Blueprint 3.8: Wrong attempts are rate limited)
const loginAttempts = new Map();

/**
 * Wholesale Auth endpoints (Blueprint 3.8 & Test W1)
 */
router.post('/wholesale/register', (req, res) => {
  const { shop_name, owner_name, mobile, email, address, state, gstin, password } = req.body;
  
  if (!shop_name || !owner_name || !mobile || !email || !password) {
    return res.status(400).json({ success: false, error: 'Missing mandatory registration fields.' });
  }

  const cleanPhone = (mobile || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ success: false, error: 'Enter a valid 10-digit mobile number.' });
  }

  const existing = store.wholesalers.find(w => w.email === email || w.mobile === cleanPhone);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Account with this email or mobile already exists.' });
  }

  // Account is active immediately without any manual approval (Blueprint 3.8 & Test W1)
  const newWholesaler = {
    id: 'wh-' + (store.wholesalers.length + 1),
    shop_name,
    owner_name,
    mobile: cleanPhone,
    email: email.trim().toLowerCase(),
    address: address || '',
    state: state || 'Karnataka',
    gstin: gstin || '',
    password,
    price_overrides: {}
  };

  store.wholesalers.push(newWholesaler);

  res.json({
    success: true,
    message: 'Wholesale account activated immediately. Welcome to Backrey Bases!',
    token: newWholesaler.id,
    wholesaler: {
      id: newWholesaler.id,
      shop_name: newWholesaler.shop_name,
      owner_name: newWholesaler.owner_name,
      email: newWholesaler.email,
      mobile: newWholesaler.mobile,
      address: newWholesaler.address,
      state: newWholesaler.state,
      gstin: newWholesaler.gstin,
      is_active: true
    }
  });
});

router.post('/wholesale/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Enter your registered email/phone and password.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const now = Date.now();
  const attemptInfo = loginAttempts.get(cleanId) || { count: 0, lastAttempt: now };

  // Check rate limit: 5 failed attempts locks for 5 minutes (Blueprint 3.8)
  if (attemptInfo.count >= 5 && now - attemptInfo.lastAttempt < 5 * 60 * 1000) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many wrong login attempts. Please wait 5 minutes before trying again.' 
    });
  }

  const wholesaler = store.wholesalers.find(w => 
    (w.email.toLowerCase() === cleanId || w.mobile === cleanId) && w.password === password
  );

  if (!wholesaler) {
    loginAttempts.set(cleanId, {
      count: (attemptInfo.count || 0) + 1,
      lastAttempt: now
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials. Please try again.' });
  }

  // Reset login attempts on success
  loginAttempts.delete(cleanId);

  res.json({
    success: true,
    token: wholesaler.id,
    wholesaler: {
      id: wholesaler.id,
      shop_name: wholesaler.shop_name,
      owner_name: wholesaler.owner_name,
      email: wholesaler.email,
      mobile: wholesaler.mobile,
      address: wholesaler.address,
      state: wholesaler.state,
      gstin: wholesaler.gstin
    }
  });
});

/**
 * GET /api/wholesale/dashboard (Blueprint 3.9)
 */
router.get('/wholesale/dashboard', (req, res) => {
  if (!req.user || !req.user.is_wholesale) {
    return res.status(401).json({ success: false, error: 'Wholesale authentication required.' });
  }

  const ownOrders = store.getWholesaleOrders(req.user.id);
  const lastOrder = ownOrders.length > 0 ? ownOrders[ownOrders.length - 1] : null;

  res.json({
    success: true,
    profile: {
      id: req.user.id,
      shop_name: req.user.shop_name,
      owner_name: req.user.owner_name,
      email: req.user.email,
      mobile: req.user.mobile,
      address: req.user.address,
      state: req.user.state
    },
    stats: {
      total_orders: ownOrders.length,
      last_order_date: lastOrder ? lastOrder.createdAt : null
    },
    last_order: lastOrder,
    recent_orders: ownOrders.slice(-5).reverse()
  });
});

/**
 * GET /api/wholesale/orders (Blueprint 3.11)
 */
router.get('/wholesale/orders', (req, res) => {
  if (!req.user || !req.user.is_wholesale) {
    return res.status(401).json({ success: false, error: 'Wholesale authentication required.' });
  }

  const orders = store.getWholesaleOrders(req.user.id);
  res.json({
    success: true,
    orders
  });
});

/**
 * POST /api/wholesale/reorder/:orderId (Blueprint 3.9 & Test W7)
 */
router.post('/wholesale/reorder/:orderId', (req, res) => {
  if (!req.user || !req.user.is_wholesale) {
    return res.status(401).json({ success: false, error: 'Wholesale authentication required.' });
  }

  const result = store.reorderPastOrder(req.params.orderId, req.user.id);
  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

/**
 * GET /api/invoices/:id (Blueprint 3.12 & Test I6: Download invoice from confirmation -> PDF downloads)
 */
router.get('/invoices/:id', (req, res) => {
  const { id } = req.params;
  const order = store.orders.find(o => o.orderNo === id || o.reservationId === id || o.paymentId === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Invoice not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.orderNo}.pdf"`);
  invoice.generateInvoicePDF(order, res);
});

/**
 * GET /api/wholesale/statement?month=&format= (Blueprint 3.12 & Test R5: Wholesaler downloads statement -> Only own data)
 */
router.get('/wholesale/statement', (req, res) => {
  if (!req.user || !req.user.is_wholesale) {
    return res.status(401).json({ success: false, error: 'Wholesale authentication required.' });
  }

  const { month, format = 'pdf' } = req.query;
  // Blueprint Test R5 rule: A wholesaler can only see their own data
  const ownOrders = store.getWholesaleOrders(req.user.id);

  if (format === 'csv') {
    const csvContent = invoice.generateMonthlyStatementCSV(req.user, month, ownOrders);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${month || 'All'}.csv"`);
    return res.send(csvContent);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Statement-${month || 'All'}.pdf"`);
  invoice.generateMonthlyStatementPDF(req.user, month, ownOrders, res);
});

/**
 * Admin Access Denial (Blueprint Test W8: Wholesaler opens admin URL -> Denied)
 */
router.all('/admin*', (req, res) => {
  res.status(403).json({ 
    success: false, 
    error: 'Access Denied: Wholesaler or unauthorized user cannot access the admin URL.' 
  });
});


// Test helpers to support automated testing of S1, S2, G1, G2, etc.
router.post('/test/reset', (req, res) => {
  store.reset();
  res.json({ success: true, message: 'Store reset to clean state.' });
});

router.post('/test/set-stock', (req, res) => {
  const { productId, stock } = req.body;
  const p = store.products.find(item => item.id === productId);
  if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
  p.stock = stock;
  res.json({ success: true, product: p });
});

router.post('/test/set-product-status', (req, res) => {
  const { productId, is_live } = req.body;
  const p = store.products.find(item => item.id === productId);
  if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
  p.is_live = is_live;
  res.json({ success: true, product: p });
});

router.post('/test/expire-reservation', (req, res) => {
  const { reservationId } = req.body;
  const reservation = store.reservations.get(reservationId);
  if (!reservation) return res.status(404).json({ success: false, error: 'Reservation not found' });
  reservation.expiresAt = Date.now() - 1000; // set to 1 sec in the past
  store.cleanupExpiredReservations();
  res.json({ success: true, status: reservation.status });
});

module.exports = router;

