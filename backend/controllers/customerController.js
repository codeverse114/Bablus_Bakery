/**
 * BACKREY BASES - CUSTOMER CONTROLLER
 * Zero-trust pricing, 10-minute hold reservation, payment simulation, and tracking.
 */

const store = require('../models/store');
const invoiceService = require('../services/invoiceService');

exports.getProducts = (req, res) => {
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
};

exports.getProductById = (req, res) => {
  try {
    const product = store.getProductById(req.params.id, req.user);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found or currently offline.' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.validateCart = (req, res) => {
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
};

exports.startCheckout = (req, res) => {
  try {
    const { items = [], customer = {}, inShop = false } = req.body;

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
};

exports.cancelCheckout = (req, res) => {
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
};

exports.paymentWebhook = (req, res) => {
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

    res.json({
      success: true,
      orderNo: result.order.orderNo,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.trackOrder = (req, res) => {
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
};

exports.downloadInvoice = (req, res) => {
  const { id } = req.params;
  const order = store.orders.find(o => o.orderNo === id || o.invoiceNo === id || o.reservationId === id || o.paymentId === id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Invoice not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.orderNo}.pdf"`);
  invoiceService.generateInvoicePDF(order, res);
};

// Blueprint Addendum Section 11 & Test L7: GET /api/prices
exports.getResolvedPrices = (req, res) => {
  try {
    const customer = req.customer || req.user || null;
    const products = store.resolveAllPricesForCustomer(customer);
    res.json({
      success: true,
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        section: customer.section,
        price_list_id: customer.price_list_id
      } : null,
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Blueprint Addendum Section 9.2, 11 & Test B6: GET /api/me/statement
exports.getOwnStatement = (req, res) => {
  const customer = req.customer || req.user;
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Authentication required to view statement.' });
  }

  const { period = 'monthly', month, startDate, endDate, format = 'json' } = req.query;

  // Customer can see ONLY their own orders (Test B6)
  let ownOrders = store.orders.filter(o =>
    (customer.id && (o.customerId === customer.id || o.wholesalerId === customer.id)) ||
    (customer.mobile && o.customer && store.cleanMobile(o.customer.mobile) === store.cleanMobile(customer.mobile))
  );

  if (month) {
    ownOrders = ownOrders.filter(o => o.createdAt && o.createdAt.startsWith(month));
  }
  if (period === 'custom') {
    if (startDate) ownOrders = ownOrders.filter(o => new Date(o.createdAt) >= new Date(startDate));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      ownOrders = ownOrders.filter(o => new Date(o.createdAt) <= end);
    }
  }

  if (format === 'csv') {
    let csv = 'Date,Order No,Invoice No,Product,Rate,Pieces,Amount,Amount Paid,Status\n';
    let totalPieces = 0;
    let totalAmount = 0;
    for (const o of ownOrders) {
      for (const item of (o.items || [])) {
        const pieces = item.pieces || ((item.unit === 'pack') ? (item.quantity * (item.pack_unit_size || 1)) : item.quantity);
        totalPieces += pieces;
        totalAmount += (item.total || 0);
        csv += `${o.createdAt ? o.createdAt.split('T')[0] : ''},"${o.orderNo}","${o.invoiceNo}","${item.name}",${item.unit_price},${pieces},${item.total},${o.grand_total},"${o.status}"\n`;
      }
    }
    csv += `\nTotal Orders,${ownOrders.length}\nTotal Pieces,${totalPieces}\nTotal Amount,${totalAmount}\n`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${customer.id}-${month || 'All'}.csv"`);
    return res.send(csv);
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${customer.id}-${month || 'All'}.pdf"`);
    return invoiceService.generateMonthlyStatementPDF(customer, month, ownOrders, res);
  }

  const lines = [];
  let totalPieces = 0;
  let totalAmount = 0;
  for (const o of ownOrders) {
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

  res.json({
    success: true,
    customer: {
      id: customer.id,
      name: customer.name || customer.owner_name,
      shop_name: customer.shop_name,
      mobile: customer.mobile,
      section: customer.section
    },
    summary: {
      total_orders: ownOrders.length,
      total_pieces: totalPieces,
      total_amount: totalAmount
    },
    lines
  });
};

// Re-order past order using resolved prices (Milestone M5C & Test W7)
exports.reorderOrder = (req, res) => {
  const customer = req.customer || req.user;
  if (!customer) {
    return res.status(401).json({ success: false, error: 'Authentication required to reorder.' });
  }
  const result = store.reorderPastOrder(req.params.orderNo, customer.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
};
