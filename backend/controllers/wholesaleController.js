/**
 * BACKREY BASES - WHOLESALE CONTROLLER
 * Self-serve registration, rate-limited login, dashboard, reorder, statements.
 */

const store = require('../models/store');
const invoiceService = require('../services/invoiceService');

// Login rate limiting map
const loginAttempts = new Map();

exports.register = (req, res) => {
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
};

exports.login = (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Enter your registered email/phone and password.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const now = Date.now();
  const attemptInfo = loginAttempts.get(cleanId) || { count: 0, lastAttempt: now };

  // 5 failed attempts locks for 5 minutes (Blueprint 3.8)
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
};

exports.getDashboard = (req, res) => {
  const account = req.customer || req.user;
  if (!account) {
    return res.status(401).json({ success: false, error: 'Partner authentication required.' });
  }

  const ownOrders = store.getWholesaleOrders(account.id);
  const lastOrder = ownOrders.length > 0 ? ownOrders[ownOrders.length - 1] : null;
  const resolvedPrices = account.section ? store.resolveAllPricesForCustomer(account) : null;

  res.json({
    success: true,
    profile: {
      id: account.id,
      shop_name: account.shop_name || account.name,
      owner_name: account.owner_name || account.name,
      section: account.section || 'shopkeeper',
      price_list_id: account.price_list_id || null,
      email: account.email || '',
      mobile: account.mobile,
      address: account.address || '',
      state: account.state || 'Karnataka'
    },
    stats: {
      total_orders: ownOrders.length,
      last_order_date: lastOrder ? lastOrder.createdAt : null
    },
    resolved_prices: resolvedPrices,
    last_order: lastOrder,
    recent_orders: ownOrders.slice(-5).reverse()
  });
};

exports.getOrders = (req, res) => {
  const account = req.customer || req.user;
  if (!account) {
    return res.status(401).json({ success: false, error: 'Partner authentication required.' });
  }

  const orders = store.getWholesaleOrders(account.id);
  res.json({
    success: true,
    orders
  });
};

exports.reorder = (req, res) => {
  const account = req.customer || req.user;
  if (!account) {
    return res.status(401).json({ success: false, error: 'Partner authentication required.' });
  }

  const result = store.reorderPastOrder(req.params.orderId, account.id);
  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
};

exports.getStatement = (req, res) => {
  const account = req.customer || req.user;
  if (!account) {
    return res.status(401).json({ success: false, error: 'Partner authentication required.' });
  }

  const { month, format = 'pdf' } = req.query;
  let ownOrders = store.getWholesaleOrders(account.id);
  if (month && month !== 'All') {
    ownOrders = ownOrders.filter(o => o.createdAt && o.createdAt.startsWith(month));
  }

  if (format === 'csv') {
    const csvContent = invoiceService.generateMonthlyStatementCSV(account, month, ownOrders);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${month || 'All'}.csv"`);
    return res.send(csvContent);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Statement-${month || 'All'}.pdf"`);
  invoiceService.generateMonthlyStatementPDF(account, month, ownOrders, res);
};
