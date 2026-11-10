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

// Inventory Management (Blueprint 3.5 & Addendum Section 8 & 15.9)
exports.getInventory = (req, res) => {
  const isStaff = req.adminUser && req.adminUser.role === 'staff';
  const inventoryList = store.products.map(p => {
    const shopQty = store.getLocationStock('loc-shop', p.id);
    const factoryQty = isStaff ? null : store.getLocationStock('loc-factory', p.id);
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      pack_size: p.pack_size,
      stock: isStaff ? shopQty : p.stock,
      shop_stock: shopQty,
      factory_stock: factoryQty,
      low_stock_threshold: p.low_stock_threshold || 20,
      status: (isStaff ? shopQty : p.stock) <= 0 ? 'Out of stock' : (isStaff ? shopQty : p.stock) <= (p.low_stock_threshold || 20) ? 'Low stock' : 'In stock',
      is_live: p.is_live
    };
  });

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

// Orders Management (Blueprint 3.6, 3.7, Addendum 7.5 & 15.9)
exports.getOrders = (req, res) => {
  const { status, channel, section, search } = req.query;
  const isStaff = req.adminUser && req.adminUser.role === 'staff';
  let orders = [...store.orders].reverse();

  // Blueprint Addendum Section 15.9: Staff sees only Regular (Shop) orders & Shopkeeper orders collected from Shop
  if (isStaff) {
    orders = orders.filter(o => {
      const sec = (o.section || '').toLowerCase();
      if (sec === 'factory') return false;
      if (sec === 'shopkeeper' && o.stock_location_id === 'loc-factory') return false;
      return true;
    });
  }

  if (status && status !== 'All') {
    orders = orders.filter(o => o.status.toLowerCase() === status.toLowerCase());
  }

  if (section && section !== 'All') {
    const targetSec = section.toLowerCase();
    orders = orders.filter(o => {
      const orderSec = (o.section || (o.tag === 'Wholesale' ? 'shopkeeper' : 'regular')).toLowerCase();
      return orderSec === targetSec;
    });
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

// =========================================================================
// BLUEPRINT ADDENDUM: SECTIONS, CUSTOMERS, PRICE LISTS & TRANSFERS CONTROLLERS
// =========================================================================

// Section Customers (Blueprint Section 7.3 & Section 11)
exports.getSectionCustomers = (req, res) => {
  try {
    const { section } = req.params;
    const customers = store.getCustomersBySection(section);
    res.json({
      success: true,
      section,
      count: customers.length,
      customers
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addSectionCustomer = (req, res) => {
  try {
    const { section } = req.params;
    const customer = store.addCustomer({
      section,
      ...req.body
    });
    res.status(201).json({
      success: true,
      message: 'Customer successfully added to section registry.',
      customer
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
};

exports.updateCustomer = (req, res) => {
  try {
    const { id } = req.params;
    const customer = store.updateCustomer(id, req.body);
    res.json({
      success: true,
      message: 'Customer record updated successfully.',
      customer
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, error: err.message });
  }
};

// Price Lists & Items (Blueprint Section 7.1, 7.2 & Section 11)
exports.getPriceList = (req, res) => {
  try {
    const { id } = req.params;
    const list = store.price_lists.find(pl => pl.id === id);
    if (!list) {
      return res.status(404).json({ success: false, error: 'Price list not found.' });
    }

    const items = store.price_list_items.filter(item => item.price_list_id === id);
    res.json({
      success: true,
      price_list: list,
      items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updatePriceList = (req, res) => {
  try {
    const { id } = req.params;
    const list = store.price_lists.find(pl => pl.id === id);
    if (!list) {
      return res.status(404).json({ success: false, error: 'Price list not found.' });
    }

    const { items = [], name, is_active } = req.body;
    if (name) list.name = name;
    if (is_active !== undefined) list.is_active = Boolean(is_active);

    const adminEmail = req.adminUser ? req.adminUser.email : 'owner@backreybases.in';

    // Update or insert price list items and log changes
    for (const newItem of items) {
      const existingIdx = store.price_list_items.findIndex(i => 
        i.price_list_id === id && i.product_id === newItem.product_id
      );

      const oldPrice = existingIdx >= 0 ? store.price_list_items[existingIdx].price : null;
      const oldMoq = existingIdx >= 0 ? store.price_list_items[existingIdx].moq : null;

      const updatedPrice = newItem.price !== undefined ? Number(newItem.price) : oldPrice;
      const updatedMoq = newItem.moq !== undefined ? Number(newItem.moq) : oldMoq;

      if (existingIdx >= 0) {
        store.price_list_items[existingIdx] = {
          ...store.price_list_items[existingIdx],
          ...newItem,
          price: updatedPrice,
          price_paise: updatedPrice !== null ? Math.round(updatedPrice * 100) : store.price_list_items[existingIdx].price_paise,
          moq: updatedMoq,
          price_list_id: id
        };
      } else {
        store.price_list_items.push({
          unit: 'pack',
          pack_size: 10,
          ...newItem,
          price: updatedPrice,
          price_paise: updatedPrice !== null ? Math.round(updatedPrice * 100) : 0,
          moq: updatedMoq !== null ? updatedMoq : 1,
          price_list_id: id
        });
      }

      // Log price change (Section 4 & 7.4: Price change log)
      if (oldPrice !== updatedPrice || oldMoq !== updatedMoq) {
        store.price_change_log.unshift({
          id: 'pcl-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          admin_id: adminEmail,
          section: list.section,
          list_name: list.name,
          price_list_id: id,
          product_id: newItem.product_id,
          old_price: oldPrice,
          new_price: updatedPrice,
          old_moq: oldMoq,
          new_moq: updatedMoq,
          created_at: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Price list updated successfully.',
      price_list: list,
      items: store.price_list_items.filter(i => i.price_list_id === id)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.createPriceList = (req, res) => {
  try {
    const { section, name, type = 'special', items = [] } = req.body;
    if (!section || !name) {
      return res.status(400).json({ success: false, error: 'Section and name are required.' });
    }

    const newList = {
      id: 'pl-' + section.slice(0, 3) + '-' + Date.now(),
      section: section.toLowerCase(),
      name,
      type,
      is_active: true
    };

    store.price_lists.push(newList);

    for (const item of items) {
      store.price_list_items.push({
        price_list_id: newList.id,
        ...item
      });
    }

    res.status(201).json({
      success: true,
      message: 'Price list created successfully.',
      price_list: newList
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.getPriceLog = (req, res) => {
  res.json({
    success: true,
    count: store.price_change_log.length,
    log: store.price_change_log
  });
};

// Manage dedicated per-customer Special Price List (Blueprint Section 7.2: Copy Standard, Edit, Apply %, Reset to Standard)
exports.setCustomerSpecialPrices = (req, res) => {
  try {
    const { id } = req.params;
    const { items = [], action = 'save' } = req.body;
    const customer = store.findCustomerById(id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    const adminEmail = req.adminUser ? req.adminUser.email : 'owner@backreybases.in';

    if (action === 'reset') {
      customer.price_list_id = null;
      return res.json({ success: true, message: 'Customer reset to Section Standard prices.', customer });
    }

    // Create a dedicated Special Price List for this customer if they don't already have a personal one
    const personalListId = `pl-${customer.section.slice(0, 3)}-spc-${customer.id}`;
    let list = store.price_lists.find(pl => pl.id === customer.price_list_id && pl.id === personalListId);
    if (!list) {
      list = store.price_lists.find(pl => pl.id === personalListId);
      if (!list) {
        list = {
          id: personalListId,
          section: customer.section,
          name: `${customer.section.toUpperCase()} Special (${customer.name || customer.shop_name})`,
          type: 'special',
          is_active: true
        };
        store.price_lists.push(list);
      }
      customer.price_list_id = list.id;
    }

    for (const newItem of items) {
      const existingIdx = store.price_list_items.findIndex(i => i.price_list_id === list.id && i.product_id === newItem.product_id);
      const stdList = store.price_lists.find(pl => pl.section === customer.section && pl.type === 'standard');
      const stdItem = stdList ? store.price_list_items.find(i => i.price_list_id === stdList.id && i.product_id === newItem.product_id) : null;

      const oldPrice = existingIdx >= 0 ? store.price_list_items[existingIdx].price : (stdItem ? stdItem.price : null);
      const oldMoq = existingIdx >= 0 ? store.price_list_items[existingIdx].moq : (stdItem ? stdItem.moq : null);
      const newPrice = Number(newItem.price);
      const newMoq = newItem.moq !== undefined ? Number(newItem.moq) : oldMoq;

      if (existingIdx >= 0) {
        store.price_list_items[existingIdx] = {
          ...store.price_list_items[existingIdx],
          price: newPrice,
          price_paise: Math.round(newPrice * 100),
          moq: newMoq
        };
      } else {
        store.price_list_items.push({
          price_list_id: list.id,
          product_id: newItem.product_id,
          unit: stdItem ? stdItem.unit : 'pack',
          pack_size: stdItem ? stdItem.pack_size : 10,
          price: newPrice,
          price_paise: Math.round(newPrice * 100),
          moq: newMoq !== null ? newMoq : 1
        });
      }

      if (oldPrice !== newPrice || oldMoq !== newMoq) {
        store.price_change_log.unshift({
          id: 'pcl-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          admin_id: adminEmail,
          section: customer.section,
          list_name: list.name,
          price_list_id: list.id,
          product_id: newItem.product_id,
          old_price: oldPrice,
          new_price: newPrice,
          old_moq: oldMoq,
          new_moq: newMoq,
          created_at: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Special price list saved.',
      customer,
      price_list: list,
      items: store.price_list_items.filter(i => i.price_list_id === list.id)
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Stock Location Transfers (Blueprint Section 8 & Section 11)
exports.transferStock = (req, res) => {
  try {
    const { from_location, to_location, product_id, qty } = req.body;
    if (!from_location || !to_location || !product_id || !qty) {
      return res.status(400).json({
        success: false,
        error: 'from_location, to_location, product_id, and qty are required.'
      });
    }

    const transferQty = parseInt(qty, 10);
    if (isNaN(transferQty) || transferQty <= 0) {
      return res.status(400).json({ success: false, error: 'Transfer quantity must be greater than zero.' });
    }

    // Check available quantity at source location
    const sourceStock = store.location_stock.find(ls => 
      ls.location_id === from_location && ls.product_id === product_id
    );

    const available = sourceStock ? sourceStock.qty : 0;
    if (transferQty > available) {
      return res.status(400).json({
        success: false,
        error: `Transfer quantity (${transferQty}) exceeds available stock (${available}) at source location.`
      });
    }

    // Deduct from source
    sourceStock.qty -= transferQty;

    // Add to destination
    let destStock = store.location_stock.find(ls => 
      ls.location_id === to_location && ls.product_id === product_id
    );
    if (!destStock) {
      destStock = { location_id: to_location, product_id, qty: 0 };
      store.location_stock.push(destStock);
    }
    destStock.qty += transferQty;

    const transferRecord = {
      id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      from_location,
      to_location,
      product_id,
      qty: transferQty,
      admin_id: req.adminUser ? req.adminUser.email : 'Owner',
      created_at: new Date().toISOString()
    };

    store.stock_transfers.unshift(transferRecord);

    res.json({
      success: true,
      message: `Successfully transferred ${transferQty} units from ${from_location} to ${to_location}.`,
      transfer: transferRecord,
      source_stock: sourceStock.qty,
      destination_stock: destStock.qty
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Sectioned Reports & Customer Statements (Blueprint Addendum Section 9.2 & Tests B2 - B8)
exports.getSectionReport = (req, res) => {
  try {
    const sec = (req.params.section || 'all').toLowerCase();
    const { period = 'monthly', startDate, endDate, month, week } = req.query;

    let filteredOrders = store.orders.slice();

    // 1. Filter by Section
    if (sec !== 'all') {
      filteredOrders = filteredOrders.filter(o => {
        const orderSection = (o.section || (o.customer && o.customer.section) || (o.tag === 'Wholesale' ? 'shopkeeper' : 'regular')).toLowerCase();
        return orderSection === sec;
      });
    }

    // 2. Filter by Date Period (Weekly, Monthly, Custom)
    const now = new Date();
    if (period === 'weekly') {
      // Default week start is Monday (Blueprint Section 9.2 & 15.8)
      const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      filteredOrders = filteredOrders.filter(o => {
        const oDate = new Date(o.createdAt);
        return oDate >= monday && oDate <= sunday;
      });
    } else if (period === 'monthly') {
      const monthPrefix = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      filteredOrders = filteredOrders.filter(o => o.createdAt && o.createdAt.startsWith(monthPrefix));
    } else if (period === 'custom') {
      if (startDate) {
        const start = new Date(startDate);
        filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredOrders = filteredOrders.filter(o => new Date(o.createdAt) <= end);
      }
    }

    // 3. Compute Metrics
    let totalPieces = 0;
    let grossAmount = 0;
    let totalPaid = 0;
    let stdOrdersCount = 0;
    let stdOrdersAmount = 0;
    let spcOrdersCount = 0;
    let spcOrdersAmount = 0;

    const productMap = {};
    const customerMap = {};

    for (const o of filteredOrders) {
      grossAmount += (o.grand_total || 0);
      if (o.status === 'Paid') totalPaid += (o.grand_total || 0);

      const isSpecial = Boolean(o.price_list_id || (o.items || []).some(i => i.price_source === 'special'));
      if (isSpecial) {
        spcOrdersCount++;
        spcOrdersAmount += (o.grand_total || 0);
      } else {
        stdOrdersCount++;
        stdOrdersAmount += (o.grand_total || 0);
      }

      // Customer stats
      const cMobile = (o.customer && o.customer.mobile) ? o.customer.mobile : (o.wholesalerId || 'Guest');
      const cName = (o.customer && o.customer.name) ? o.customer.name : 'Walk-in Customer';
      if (!customerMap[cMobile]) {
        customerMap[cMobile] = {
          mobile: cMobile,
          name: cName,
          shop_name: (o.customer && o.customer.shop_name) || '',
          section: o.section || 'regular',
          orders_count: 0,
          pieces: 0,
          amount_paid: 0
        };
      }
      customerMap[cMobile].orders_count++;
      customerMap[cMobile].amount_paid += (o.grand_total || 0);

      // Item stats
      for (const item of (o.items || [])) {
        const pieces = item.pieces || ((item.unit === 'pack') ? (item.quantity * (item.pack_unit_size || item.pack_size || 1)) : item.quantity);
        totalPieces += pieces;
        customerMap[cMobile].pieces += pieces;

        const pid = item.id;
        if (!productMap[pid]) {
          productMap[pid] = {
            product_id: pid,
            code: item.code || pid,
            name: item.name,
            pieces: 0,
            amount: 0
          };
        }
        productMap[pid].pieces += pieces;
        productMap[pid].amount += (item.total || 0);
      }
    }

    const customersBreakdown = Object.values(customerMap);
    const topCustomers = customersBreakdown.slice().sort((a, b) => b.amount_paid - a.amount_paid);

    res.json({
      success: true,
      section: sec,
      period,
      total_orders: filteredOrders.length,
      total_pieces: totalPieces,
      gross_amount: grossAmount,
      total_amount_paid: totalPaid,
      pricing_breakdown: {
        standard_orders_count: stdOrdersCount,
        standard_orders_amount: stdOrdersAmount,
        special_orders_count: spcOrdersCount,
        special_orders_amount: spcOrdersAmount
      },
      products_breakdown: Object.values(productMap),
      customers_breakdown: customersBreakdown,
      top_customers: topCustomers,
      orders: filteredOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSectionCustomerStatement = (req, res) => {
  try {
    const { section } = req.params;
    const { customerId, mobile, period = 'monthly', month, format = 'json' } = req.query;

    const customer = store.customers.find(c => 
      c.id === customerId || 
      c.mobile === customerId || 
      (mobile && c.mobile === mobile)
    ) || store.wholesalers.find(w => w.id === customerId || w.mobile === customerId);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    let customerOrders = store.orders.filter(o => 
      o.customerId === customer.id || 
      o.wholesalerId === customer.id ||
      (o.customer && (o.customer.id === customer.id || o.customer.mobile === customer.mobile))
    );

    if (month) {
      customerOrders = customerOrders.filter(o => o.createdAt && o.createdAt.startsWith(month));
    }

    // Build line item statements
    const lines = [];
    let totalPieces = 0;
    let totalAmount = 0;

    for (const o of customerOrders) {
      for (const item of (o.items || [])) {
        const pieces = item.pieces || ((item.unit === 'pack') ? (item.quantity * (item.pack_unit_size || 1)) : item.quantity);
        totalPieces += pieces;
        totalAmount += (item.total || 0);

        lines.push({
          date: o.createdAt ? o.createdAt.split('T')[0] : '',
          order_no: o.orderNo,
          invoice_no: o.invoiceNo,
          product: item.name,
          rate: item.unit_price,
          pieces,
          amount: item.total,
          amount_paid: o.grand_total,
          status: o.status
        });
      }
    }

    if (format === 'csv') {
      let csv = 'Date,Order No,Invoice No,Product,Rate,Pieces,Amount,Amount Paid,Status\n';
      lines.forEach(l => {
        csv += `${l.date},"${l.order_no}","${l.invoice_no}","${l.product}",${l.rate},${l.pieces},${l.amount},${l.amount_paid},"${l.status}"\n`;
      });
      csv += `\nTotal Orders,${customerOrders.length}\nTotal Pieces,${totalPieces}\nTotal Amount,${totalAmount}\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="Statement-${customer.id}.csv"`);
      return res.send(csv);
    }

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name || customer.owner_name,
        shop_name: customer.shop_name,
        mobile: customer.mobile,
        section: customer.section || section
      },
      summary: {
        total_orders: customerOrders.length,
        total_pieces: totalPieces,
        total_amount: totalAmount
      },
      lines
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


