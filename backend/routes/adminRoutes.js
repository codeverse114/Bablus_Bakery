const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const store = require('../models/store');

// Admin Authentication Middleware (Blueprint Section 1 & Test X2, Test W8)
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  let token = authHeader;
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7).trim();
  }

  // If wholesale or customer token is passed to admin endpoint, deny 403 (Test W8)
  if (req.headers['x-wholesale-token'] || req.headers['x-customer-token'] || (token && token.startsWith('token-'))) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Customer or wholesaler cannot access the admin URL.'
    });
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required. Please login.'
    });
  }

  const userId = token.startsWith('adm-') ? token.slice(4) : token;
  const user = store.adminUsers.find(u => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired admin session token.'
    });
  }

  req.adminUser = user;
  next();
}

// Role-Based Authorization: Owner Only (Security Rule 2 & Test X7)
function requireOwnerRole(req, res, next) {
  if (!req.adminUser || req.adminUser.role !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Restricted to Owner role only. Staff members cannot access this section.'
    });
  }
  next();
}

// Public Admin Login
router.post('/login', adminController.login);

// Protected Routes (Require Admin Auth)
router.use(requireAdminAuth);

// 1. Dashboard
router.get('/dashboard', adminController.getDashboard);

// 2. Products
router.get('/products', adminController.getProducts);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.patch('/products/:id/status', adminController.toggleProductStatus);

// 3. Inventory
router.get('/inventory', adminController.getInventory);
router.post('/inventory/opening', adminController.setOpeningStock);
router.post('/inventory/restock', adminController.restock);
router.post('/inventory/adjust', adminController.adjustStock);
router.get('/inventory/log', adminController.getInventoryLog);

// 4. Orders & POS Offline Sales
router.get('/orders', adminController.getOrders);
router.get('/orders/:orderNo', adminController.getOrderById);
router.patch('/orders/:orderNo/status', adminController.updateOrderStatus);
router.get('/orders/:orderNo/packing-slip', adminController.printPackingSlip);
router.post('/orders/offline', adminController.createOfflineOrder);

// 5. Invoices (Blueprint 3.12 & Test I3, I5)
router.get('/invoices', adminController.getInvoices);
router.post('/invoices/:orderNo/resend', adminController.resendInvoice);

// 6. QR Code Standee Poster (Blueprint 3.14)
router.get('/qr/poster', adminController.getQrPoster);

// 7. Notification Diagnostics (Blueprint 3.13 & Tests O3-O6)
router.post('/notifications/test', adminController.testNotification);
router.get('/notifications/failures', adminController.getNotificationFailures);

// 8. Wholesale Customer Overview (Owner-Only per Section 15.9)
router.get('/wholesale/customers', requireOwnerRole, adminController.getWholesaleCustomers);

// 8.1 Customer Sections & Whitelist Registry (Blueprint Addendum Section 7.3, 11 & 15.9: Owner Only)
router.get('/sections/:section/customers', requireOwnerRole, adminController.getSectionCustomers);
router.post('/sections/:section/customers', requireOwnerRole, adminController.addSectionCustomer);
router.patch('/customers/:id', requireOwnerRole, adminController.updateCustomer);
router.post('/customers/:id/special-prices', requireOwnerRole, adminController.setCustomerSpecialPrices);

// 8.2 Standard & Special Price Lists & Price Log (Blueprint Addendum Section 7.1, 7.2, 7.4 & 15.9: Owner Only)
router.get('/price-lists/:id', requireOwnerRole, adminController.getPriceList);
router.put('/price-lists/:id', requireOwnerRole, adminController.updatePriceList);
router.post('/price-lists', requireOwnerRole, adminController.createPriceList);
router.get('/price-log', requireOwnerRole, adminController.getPriceLog);

// 8.3 Dual Location Stock Transfers (Blueprint Addendum Section 8, 11 & 15.9)
router.post('/stock/transfer', requireOwnerRole, adminController.transferStock);
router.get('/stock/locations', (req, res) => {
  const isStaff = req.adminUser && req.adminUser.role === 'staff';
  const locs = isStaff
    ? store.stock_locations.filter(loc => loc.id === 'loc-shop')
    : store.stock_locations;
  const locations = locs.map(loc => ({
    ...loc,
    stock: store.location_stock.filter(ls => ls.location_id === loc.id).map(ls => ({
      product_id: ls.product_id,
      qty: ls.qty,
      product_name: (store.products.find(p => p.id === ls.product_id) || {}).name || ls.product_id
    }))
  }));
  res.json({ success: true, locations });
});
router.get('/stock/transfers', requireOwnerRole, (req, res) => {
  res.json({ success: true, transfers: store.stock_transfers });
});

// 8.4 Sectioned Reports & Customer Statements (Blueprint Addendum Section 9.2 & Tests B2-B8)
router.get('/reports/section/:section', requireOwnerRole, adminController.getSectionReport);
router.get('/reports/section/:section/statement', requireOwnerRole, adminController.getSectionCustomerStatement);

// 9. Owner-Only Protected Sections (Test X7: Staff denied 403)
router.post('/wholesale/price-override', requireOwnerRole, adminController.setWholesalePriceOverride);
router.get('/reports', requireOwnerRole, adminController.getMonthlyReport);
router.get('/reports/monthly', requireOwnerRole, adminController.getMonthlyReport);
router.get('/reports/statement', requireOwnerRole, adminController.getCustomerStatement);
router.get('/reports/invoices.zip', requireOwnerRole, adminController.getInvoicesZip);
router.get('/reports/reconciliation', requireOwnerRole, adminController.getGatewayReconciliation);
router.get('/settings', requireOwnerRole, adminController.getSettings);
router.put('/settings', requireOwnerRole, adminController.updateSettings);
router.get('/staff', requireOwnerRole, adminController.getStaff);
router.post('/staff', requireOwnerRole, adminController.addStaff);

module.exports = router;
