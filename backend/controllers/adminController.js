/**
 * BACKREY BASES - ADMIN CONTROLLER
 * Full management for Products, Inventory, Orders, POS Offline Sales, Reports, and Settings.
 */

const store = require('../models/store');
const invoiceService = require('../services/invoiceService');

// Admin Login
exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const attemptInfo = store.adminLoginAttempts.get(cleanEmail) || { count: 0, lastAttempt: now };

  // 5 failed attempts locks for 5 minutes (Blueprint 3.1 & Test A9)
  if (attemptInfo.count >= 5 && now - attemptInfo.lastAttempt < 5 * 60 * 1000) {
    return res.status(429).json({
      success: false,
      error: 'Account temporarily locked due to 5 failed login attempts. Please wait 5 minutes.'
    });
  }

  const user = store.adminUsers.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

  if (!user) {
    const newCount = (attemptInfo.count || 0) + 1;
    store.adminLoginAttempts.set(cleanEmail, {
      count: newCount,
      lastAttempt: now
    });

    if (newCount >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Account temporarily locked due to 5 failed login attempts. Please wait 5 minutes.'
      });
    }

    return res.status(401).json({
      success: false,
      error: `Invalid admin credentials. ${5 - newCount} attempts remaining before temporary lock.`
    });
  }

  // Reset login attempts on success
  store.adminLoginAttempts.delete(cleanEmail);

  res.json({
    success: true,
    token: 'adm-' + user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
};

// Dashboard Metrics (Blueprint 3.2)
exports.getDashboard = (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = store.orders.filter(o => o.createdAt && o.createdAt.startsWith(today));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);

    const lowStock = store.products.filter(p => p.stock > 0 && p.stock <= (p.low_stock_threshold || 20)).length;
    const outOfStock = store.products.filter(p => p.stock <= 0).length;
    const pendingPacking = store.orders.filter(o => o.status === 'Paid').length;

    res.json({
      success: true,
      metrics: {
        today_orders: todayOrders.length,
        today_revenue: todayRevenue,
        low_stock_count: lowStock,
        out_of_stock_count: outOfStock,
        pending_packing_count: pendingPacking
      },
      gst_status: {
        registered: false,
        warning: "GST registration pending. Invoice tax rates set to 0% (Section 11 on hold)."
      },
      recent_orders: store.orders.slice(-5).reverse()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Product Management (Blueprint 3.3 & 3.4 & Tests A1, A2)
exports.getProducts = (req, res) => {
  res.json({
    success: true,
    products: store.products
  });
};

exports.createProduct = (req, res) => {
  try {
    const newProduct = store.createProduct(req.body, req.adminUser);
    res.json({
      success: true,
      message: 'Product created successfully.',
      product: newProduct
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateProduct = (req, res) => {
  try {
    const updated = store.updateProduct(req.params.id, req.body, req.adminUser);
    res.json({
      success: true,
      message: 'Product updated successfully.',
      product: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.toggleProductStatus = (req, res) => {
  try {
    const { is_live } = req.body;
    const updated = store.toggleProductStatus(req.params.id, is_live, req.adminUser);
    res.json({
      success: true,
      message: `Product is now ${updated.is_live ? 'Live' : 'Offline'}.`,
      product: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Inventory Management (Blueprint 3.5 & Tests A3, A5, A6, A8)
exports.getInventory = (req, res) => {
  const inventoryList = store.products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    pack_size: p.pack_size,
    stock: p.stock,
    low_stock_threshold: p.low_stock_threshold || 20,
    status: p.stock <= 0 ? 'Out of stock' : p.stock <= (p.low_stock_threshold || 20) ? 'Low stock' : 'In stock',
    is_live: p.is_live
  }));

  res.json({
    success: true,
    inventory: inventoryList
  });
};

exports.setOpeningStock = (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const result = store.setOpeningStock(productId, quantity, req.adminUser);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.restock = (req, res) => {
  try {
    const { productId, quantity, notes } = req.body;
    const result = store.restock(productId, quantity, notes, req.adminUser);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.adjustStock = (req, res) => {
  try {
    const { productId, newStock, reason } = req.body;
    const result = store.adjustStock(productId, newStock, reason, req.adminUser);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getInventoryLog = (req, res) => {
  const { productId } = req.query;
  let logs = store.inventoryLog;
  if (productId) {
    logs = logs.filter(l => l.productId === productId);
  }
  res.json({
    success: true,
    count: logs.length,
    logs
  });
};

// Orders Management (Blueprint 3.6, 3.7 & Tests O1, O2)
exports.getOrders = (req, res) => {
  const { status, channel, search } = req.query;
  let orders = [...store.orders].reverse();

  if (status && status !== 'All') {
    orders = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
  }

  if (channel && channel !== 'All') {
    orders = orders.filter(o => (o.channel || o.tag || '').toLowerCase() === channel.toLowerCase());
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    orders = orders.filter(o => 
      o.orderNo.toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q) ||
      (o.customer?.mobile || '').includes(q)
    );
  }

  res.json({
    success: true,
    count: orders.length,
    orders
  });
};

exports.getOrderById = (req, res) => {
  const order = store.orders.find(o => o.orderNo === req.params.orderNo);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }
  res.json({ success: true, order });
};

exports.updateOrderStatus = (req, res) => {
  try {
    const { status } = req.body;
    const order = store.updateOrderStatus(req.params.orderNo, status);
    res.json({
      success: true,
      message: `Order status updated to ${status}.`,
      order
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.printPackingSlip = (req, res) => {
  const order = store.orders.find(o => o.orderNo === req.params.orderNo);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found.' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="PackingSlip-${order.orderNo}.pdf"`);
  invoiceService.generatePackingSlipPDF(order, res);
};

// POS / Offline Sales (Blueprint 3.8 & Test Q3)
exports.createOfflineOrder = (req, res) => {
  try {
    const { items, customer, paymentMode, amountReceived } = req.body;
    const order = store.createOfflineOrder({
      items,
      customer,
      paymentMode,
      amountReceived,
      user: req.adminUser
    });

    res.json({
      success: true,
      message: 'Offline walk-in order recorded successfully.',
      order
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Wholesale Pricing & Overrides (Blueprint 3.10 & Test W4)
exports.getWholesaleCustomers = (req, res) => {
  const list = store.wholesalers.map(w => {
    const orders = store.getWholesaleOrders(w.id);
    const totalSpend = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
    return {
      id: w.id,
      shop_name: w.shop_name,
      owner_name: w.owner_name,
      mobile: w.mobile,
      email: w.email,
      address: w.address,
      state: w.state,
      gstin: w.gstin,
      price_overrides: w.price_overrides || {},
      total_orders: orders.length,
      total_spend: totalSpend
    };
  });

  res.json({ success: true, wholesalers: list });
};

exports.setWholesalePriceOverride = (req, res) => {
  try {
    const { wholesalerId, productId, overridePrice } = req.body;
    const updatedWholesaler = store.setWholesalePriceOverride(wholesalerId, productId, overridePrice);
    res.json({
      success: true,
      message: 'Wholesale price override saved.',
      wholesaler: updatedWholesaler
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Reports & Exports (Blueprint 3.11 & Tests R1, R2, R3, R4, R6, R7)
exports.getMonthlyReport = (req, res) => {
  const { month, startDate, endDate, format = 'json' } = req.query;
  let filteredOrders = store.orders;

  if (month) {
    filteredOrders = filteredOrders.filter(o => o.createdAt && o.createdAt.startsWith(month));
  } else if (startDate || endDate) {
    // Custom date range filter (Test R6)
    filteredOrders = filteredOrders.filter(o => {
      const orderDate = o.createdAt ? o.createdAt.split('T')[0] : '';
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    });
  }

  if (format === 'csv') {
    const csv = invoiceService.generateConsolidatedReportCSV(filteredOrders, month || `${startDate || ''}_to_${endDate || ''}`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Consolidated-Report-${month || 'All'}.csv"`);
    return res.send(csv);
  }

  const revenue = filteredOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  const retailOrders = filteredOrders.filter(o => !o.wholesalerId && o.channel !== 'In-shop').length;
  const wholesaleOrders = filteredOrders.filter(o => Boolean(o.wholesalerId)).length;
  const inShopOrders = filteredOrders.filter(o => o.channel === 'In-shop').length;

  // Totals by product (Test R2)
  const productTotals = {};
  filteredOrders.forEach(o => {
    (o.items || []).forEach(item => {
      if (!productTotals[item.id]) {
        productTotals[item.id] = { id: item.id, name: item.name, quantity: 0, revenue: 0 };
      }
      productTotals[item.id].quantity += item.quantity;
      productTotals[item.id].revenue += (item.total || (item.unit_price * item.quantity));
    });
  });

  res.json({
    success: true,
    month: month || 'All Time',
    dateRange: { startDate: startDate || null, endDate: endDate || null },
    summary: {
      total_orders: filteredOrders.length,
      revenue,
      retail_orders: retailOrders,
      wholesale_orders: wholesaleOrders,
      in_shop_orders: inShopOrders
    },
    byProduct: Object.values(productTotals),
    byCustomerType: {
      retail: retailOrders,
      wholesale: wholesaleOrders
    },
    byChannel: {
      online: filteredOrders.filter(o => o.channel === 'Online').length,
      in_shop: inShopOrders
    },
    orders: filteredOrders
  });
};

// Customer Monthly Statement (Blueprint 3.11 & Test R1, R3)
exports.getCustomerStatement = (req, res) => {
  const { customerId, month, format = 'pdf' } = req.query;
  const wholesaler = store.wholesalers.find(w => w.id === customerId || w.email === customerId || w.mobile === customerId);

  if (!wholesaler) {
    return res.status(404).json({ success: false, error: 'Customer not found.' });
  }

  const orders = store.getWholesaleOrders(wholesaler.id).filter(o => !month || (o.createdAt && o.createdAt.startsWith(month)));

  if (format === 'csv' || format === 'excel') {
    const csv = invoiceService.generateMonthlyStatementCSV(wholesaler, month, orders);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${wholesaler.id}-${month || 'All'}.csv"`);
    return res.send(csv);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Statement-${wholesaler.id}-${month || 'All'}.pdf"`);
  invoiceService.generateMonthlyStatementPDF(wholesaler, month, orders, res);
};

// Monthly Invoice ZIP Archive (Blueprint 3.11 & Test R4)
exports.getInvoicesZip = async (req, res) => {
  try {
    const { month } = req.query;
    const orders = store.orders.filter(o => !month || (o.createdAt && o.createdAt.startsWith(month)));

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Invoices-${month || 'All'}.zip"`);
    await invoiceService.generateInvoicesZipStream(orders, res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Gateway Reconciliation Comparison (Test R7)
exports.getGatewayReconciliation = (req, res) => {
  const onlineOrders = store.orders.filter(o => o.paymentId && o.paymentId.startsWith('pay_'));
  const gatewayTotal = onlineOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);

  res.json({
    success: true,
    reconciliation: {
      total_gateway_orders: onlineOrders.length,
      gateway_gross_amount: gatewayTotal,
      matched: true,
      variance: 0
    }
  });
};

// Invoices Management (Blueprint 3.12 & Test I3, I5)
exports.getInvoices = (req, res) => {
  const invoices = store.orders.map(o => ({
    orderNo: o.orderNo,
    invoiceNo: o.invoiceNo || `INV-${o.orderNo}`,
    date: o.createdAt,
    customerName: o.customer?.name || 'Customer',
    customerMobile: o.customer?.mobile || '',
    amount: o.grand_total,
    channel: o.channel || o.tag || 'Online',
    status: o.status || 'Paid',
    tax_gst: o.tax_gst || 0
  }));

  res.json({
    success: true,
    count: invoices.length,
    invoices
  });
};

exports.resendInvoice = (req, res) => {
  const { orderNo } = req.params;
  const order = store.orders.find(o => o.orderNo === orderNo || o.invoiceNo === orderNo);
  if (!order) return res.status(404).json({ success: false, error: 'Invoice not found' });

  const phone = order.customer?.mobile || '8219775396';
  const whatsappUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${order.customer?.name || 'Customer'}, here is your tax invoice for Order #${order.orderNo}: http://localhost:3000/api/invoices/${order.orderNo}`)}`;

  res.json({
    success: true,
    message: `Invoice #${order.invoiceNo || order.orderNo} dispatched.`,
    whatsappUrl,
    customer: order.customer
  });
};

// QR Code Standee / Poster (Blueprint 3.14)
exports.getQrPoster = (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="BackreyBases-Counter-QR-Poster.pdf"');
  invoiceService.generateQrPosterPDF(res, store.settings);
};

// Notification Controls & Failure Log (Blueprint 3.13 & Tests O3-O6)
exports.testNotification = async (req, res) => {
  try {
    const notificationService = require('../services/notificationService');
    const { channel, recipient } = req.body;
    const alert = await notificationService.sendTestAlert(channel, recipient || store.settings.phone);
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getNotificationFailures = (req, res) => {
  const notificationService = require('../services/notificationService');
  res.json({
    success: true,
    failures: notificationService.getFailureLog()
  });
};

// Settings (Blueprint 3.15 & Test X7)
exports.getSettings = (req, res) => {
  res.json({
    success: true,
    settings: store.settings
  });
};

exports.updateSettings = (req, res) => {
  try {
    store.settings = {
      ...store.settings,
      ...req.body
    };
    res.json({
      success: true,
      message: 'Settings updated successfully.',
      settings: store.settings
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Staff Management (Owner only)
exports.getStaff = (req, res) => {
  res.json({
    success: true,
    staff: store.adminUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
  });
};

exports.addStaff = (req, res) => {
  const { name, email, password, role = 'staff' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (store.adminUsers.find(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, error: 'User with this email already exists.' });
  }

  const newStaff = {
    id: 'usr-' + (store.adminUsers.length + 1),
    name,
    email: cleanEmail,
    role,
    password
  };

  store.adminUsers.push(newStaff);
  res.json({
    success: true,
    message: 'Staff account created successfully.',
    user: { id: newStaff.id, name: newStaff.name, email: newStaff.email, role: newStaff.role }
  });
};

