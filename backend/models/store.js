/**
 * BACKREY BASES - CENTRAL DATA STORE & BUSINESS MODEL
 * Serves both Customer Storefront and Owner Admin Panel.
 */

class Store {
  constructor() {
    this.reset();
  }

  reset() {
    // 1. Settings (Blueprint Admin 3.15 & Customer 10)
    this.settings = {
      business_name: "Backrey Bases",
      business_address: "14/2, 100ft Road, Indiranagar, Bengaluru, Karnataka - 560038",
      phone: "8219775396",
      email: "contact@backreybases.in",
      state: "Karnataka",
      gstin: "", // Blank on hold as per Section 11
      invoice_prefix: "INV",
      next_invoice_number: 1001,
      stock_hold_minutes: 10,
      default_low_stock_threshold: 20,
      delivery_charge: 0,
      delivery_charge_threshold: 500,
      default_delivery_fee: 40,
      auto_offline_at_zero: false,
      notifications: {
        whatsapp_enabled: true,
        whatsapp_number: "8219775396",
        email_enabled: true,
        email_address: "owner@backreybases.in",
        push_enabled: true
      }
    };

    // 2. Allow-listed Admin & Staff Users (Blueprint Admin Section 1 & Security Rule 2)
    this.adminUsers = [
      {
        id: "usr-owner-1",
        email: "owner@backreybases.in",
        name: "Head Baker (Owner)",
        role: "owner", // Full access: settings, prices, staff, reports, inventory, orders
        password: "adminpassword123"
      },
      {
        id: "usr-staff-1",
        email: "staff@backreybases.in",
        name: "Bakery Floor Staff",
        role: "staff", // Restricted access: orders, stock updates, offline sales only (Test X7)
        password: "staffpassword123"
      }
    ];

    // Failed login tracking for rate limiting & 5-attempt lock (Blueprint 3.1 & Test A9)
    this.adminLoginAttempts = new Map();

    // 3. Product Catalog (Blueprint 3.3 & 3.4)
    this.products = [
      {
        id: "p1",
        code: "PB-SOURDOUGH-10",
        name: "Artisanal Sourdough Pizza Base (10\")",
        category: "Pizza bases",
        pack_size: "Pack of 2 bases",
        retail_price: 180,
        wholesale_price: 130,
        stock: 100,
        low_stock_threshold: 20,
        is_live: true,
        min_wholesale_qty: 10,
        image: "/images/sourdough-pizza-base.jpg",
        tagline: "48-hr slow fermented, airy crust with wood-fired blistering",
        description: "Our signature slow-fermented artisan sourdough pizza base. Pre-baked to perfection on stone decks with natural fermentation bubbles and an airy crust.",
        hsn_code: "",
        gst_rate: 0
      },
      {
        id: "p2",
        code: "BB-BRIOCHE-4",
        name: "Gourmet Brioche Burger Buns",
        category: "Burger bases",
        pack_size: "Pack of 4 buns",
        retail_price: 140,
        wholesale_price: 95,
        stock: 5, // Low stock test case
        low_stock_threshold: 20,
        is_live: true,
        min_wholesale_qty: 15,
        image: "/images/brioche-burger-buns.jpg",
        tagline: "Golden glazed, pillowy soft with toasted sesame",
        description: "Crafted with pure butter and rich milk dough, then crowned with golden sesame seeds. Engineered for premium gourmet burgers.",
        hsn_code: "",
        gst_rate: 0
      },
      {
        id: "p3",
        code: "BR-FARMHOUSE-500",
        name: "Rustic Farmhouse Sourdough Loaf",
        category: "Bread",
        pack_size: "500g Sliced Loaf",
        retail_price: 120,
        wholesale_price: 80,
        stock: 45,
        low_stock_threshold: 20,
        is_live: true,
        min_wholesale_qty: 8,
        image: "/images/farmhouse-bread.jpg",
        tagline: "Hearty golden crust with tender open crumb",
        description: "Traditional European-style country bread baked from stoneground flour and levain starter. Sliced for sandwich convenience.",
        hsn_code: "",
        gst_rate: 0
      },
      {
        id: "p4",
        code: "PB-THINCRUST-8",
        name: "Classic Italian Thin Crust Base (8\")",
        category: "Pizza bases",
        pack_size: "Pack of 2 bases",
        retail_price: 150,
        wholesale_price: 100,
        stock: 0, // Out of stock test case
        low_stock_threshold: 20,
        is_live: true,
        min_wholesale_qty: 10,
        image: "/images/sourdough-pizza-base.jpg",
        tagline: "Ultra-crisp Roman style pre-baked base",
        description: "Crispy, crackery thin Italian crust base infused with extra virgin olive oil and oregano.",
        hsn_code: "",
        gst_rate: 0
      },
      {
        id: "p5",
        code: "PB-OFFLINE-TEST",
        name: "Secret Recipe Truffle Herb Base",
        category: "Pizza bases",
        pack_size: "Pack of 2 bases",
        retail_price: 260,
        wholesale_price: 190,
        stock: 50,
        low_stock_threshold: 20,
        is_live: false, // Offline product
        min_wholesale_qty: 5,
        image: "/images/sourdough-pizza-base.jpg",
        tagline: "Internal QA recipe",
        description: "Draft product for testing offline filtering.",
        hsn_code: "",
        gst_rate: 0
      }
    ];

    // 4. Wholesalers Registry (Blueprint User 3.8 & Admin 3.10)
    this.wholesalers = [
      {
        id: "wh-1",
        shop_name: "Bella Napoli Pizzeria",
        owner_name: "Marco Rossi",
        mobile: "9876543210",
        email: "marco@bellanapoli.in",
        address: "Shop 14, High Street Mall, Indiranagar",
        state: "Karnataka",
        gstin: "29AAAAA0000A1Z5",
        password: "password123",
        price_overrides: {
          "p1": 120 // special shopkeeper discount (Test W3, W4)
        }
      },
      {
        id: "wh-2",
        shop_name: "Roma Trattoria & Cafe",
        owner_name: "Antonio Silva",
        mobile: "9812345678",
        email: "antonio@romatrattoria.in",
        address: "12, Koramangala 5th Block",
        state: "Karnataka",
        gstin: "29BBBBB1111B2Z6",
        password: "password123",
        price_overrides: {} // Standard wholesale prices
      }
    ];

    // 5. Orders Database (Blueprint User 3.6 & Admin 3.6)
    this.orders = [
      {
        orderNo: "BB-900123",
        invoiceNo: "INV-1000",
        reservationId: "RES-SEED-01",
        paymentId: "pay_seed_01",
        wholesalerId: "wh-1",
        customer: {
          name: "Marco Rossi",
          mobile: "9876543210",
          email: "marco@bellanapoli.in",
          address: "Shop 14, High Street Mall, Indiranagar",
          state: "Karnataka"
        },
        items: [
          {
            id: "p1",
            code: "PB-SOURDOUGH-10",
            name: "Artisanal Sourdough Pizza Base (10\")",
            pack_size: "Pack of 2 bases",
            unit_price: 120,
            quantity: 10,
            total: 1200,
            image: "/images/sourdough-pizza-base.jpg"
          }
        ],
        subtotal: 1200,
        delivery_charge: 0,
        tax_gst: 0,
        grand_total: 1200,
        status: "Paid",
        statusSteps: [
          { label: "Paid", done: true, time: "10:00 AM" },
          { label: "Packed", done: true },
          { label: "Out for delivery", done: true },
          { label: "Delivered", done: true }
        ],
        channel: "Online",
        tag: "Wholesale",
        paymentMode: "Online UPI",
        internalNotes: "Standard weekly bulk supply",
        createdAt: "2026-10-25T10:00:00.000Z",
        expectedDelivery: "2026-10-26"
      }
    ];

    // 6. Append-only Inventory History Log (Blueprint Admin 3.5 & Security Rule 5 & Test A8)
    this.inventoryLog = [
      {
        id: "log-init-1",
        productId: "p1",
        productName: "Artisanal Sourdough Pizza Base (10\")",
        type: "OPENING",
        quantityChange: 100,
        previousStock: 0,
        newStock: 100,
        reason: "Initial oven opening stock",
        orderNo: null,
        user: "owner@backreybases.in",
        timestamp: new Date().toISOString()
      }
    ];

    // Active stock reservations map (10-minute hold)
    this.reservations = new Map();
    this.processedPayments = new Set();
  }

  // ==========================================
  // INVENTORY & STOCK LOGIC
  // ==========================================
  getReservedStock(productId) {
    const now = Date.now();
    let reserved = 0;
    for (const res of this.reservations.values()) {
      if (res.status === 'HELD' && res.expiresAt > now) {
        const item = res.items.find(i => i.id === productId);
        if (item) reserved += item.quantity;
      }
    }
    return reserved;
  }

  cleanupExpiredReservations() {
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.status === 'HELD' && res.expiresAt <= now) {
        res.status = 'EXPIRED';
      }
    }
  }

  getStockStatus(product) {
    const reserved = this.getReservedStock(product.id);
    const available = Math.max(0, product.stock - reserved);
    const threshold = product.low_stock_threshold || this.settings.default_low_stock_threshold;

    if (available <= 0) {
      return { status: "Out of stock", code: "OUT_OF_STOCK", available: 0, can_add: false };
    }
    if (available <= threshold) {
      return { status: "Low stock", code: "LOW_STOCK", available, can_add: true };
    }
    return { status: "In stock", code: "IN_STOCK", available, can_add: true };
  }

  // Set morning opening stock (Blueprint 3.5 & Test A3)
  setOpeningStock(productId, newOpeningStock, user = "Owner") {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");

    const prev = p.stock;
    p.stock = parseInt(newOpeningStock, 10);
    const diff = p.stock - prev;

    const logEntry = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      productId: p.id,
      productName: p.name,
      type: "OPENING",
      quantityChange: diff,
      previousStock: prev,
      newStock: p.stock,
      reason: "Morning opening stock count",
      orderNo: null,
      user: typeof user === 'object' ? user.email : user,
      timestamp: new Date().toISOString()
    };

    this.inventoryLog.unshift(logEntry);
    return { product: p, logEntry };
  }

  // Evening restock: +quantity (Blueprint 3.5 & Test A5)
  restockProduct(productId, addQuantity, user = "Owner") {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");

    const qty = parseInt(addQuantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error("Restock quantity must be positive");

    const prev = p.stock;
    p.stock += qty;

    const logEntry = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      productId: p.id,
      productName: p.name,
      type: "RESTOCK",
      quantityChange: qty,
      previousStock: prev,
      newStock: p.stock,
      reason: "Evening bake restock",
      orderNo: null,
      user: typeof user === 'object' ? user.email : user,
      timestamp: new Date().toISOString()
    };

    this.inventoryLog.unshift(logEntry);
    return { product: p, logEntry };
  }

  restock(productId, quantity, notes, user = "Owner") {
    return this.restockProduct(productId, quantity, user);
  }

  // Manual correction with mandatory reason (Blueprint 3.5 & Test A6)
  adjustStock(productId, newStockValue, reason, user = "Owner") {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");
    if (!reason || !reason.trim()) throw new Error("Mandatory reason required for manual adjustment");

    const targetStock = parseInt(newStockValue, 10);
    if (isNaN(targetStock) || targetStock < 0) throw new Error("Stock count must be a non-negative number");

    const prev = p.stock;
    const change = targetStock - prev;
    p.stock = targetStock;

    const logEntry = {
      id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      productId: p.id,
      productName: p.name,
      type: "MANUAL_ADJUSTMENT",
      quantityChange: change,
      previousStock: prev,
      newStock: p.stock,
      reason: reason.trim(),
      orderNo: null,
      user: typeof user === 'object' ? user.email : user,
      timestamp: new Date().toISOString()
    };

    this.inventoryLog.unshift(logEntry);
    return { product: p, logEntry };
  }

  // ==========================================
  // PRODUCT MANAGEMENT (Blueprint 3.3 & 3.4)
  // ==========================================
  getLiveProducts(user = null) {
    return this.products
      .filter(p => p.is_live === true)
      .map(p => this.formatProductForUser(p, user));
  }

  getAllProductsAdmin() {
    return this.products.map(p => {
      const stockInfo = this.getStockStatus(p);
      const reserved = this.getReservedStock(p.id);
      return {
        ...p,
        reserved_quantity: reserved,
        available_quantity: Math.max(0, p.stock - reserved),
        stock_status: stockInfo.status,
        stock_code: stockInfo.code
      };
    });
  }

  getProductById(id, user = null) {
    const product = this.products.find(p => p.id === id);
    if (!product || (!product.is_live && (!user || !user.is_admin))) return null;
    return this.formatProductForUser(product, user);
  }

  formatProductForUser(p, user = null) {
    const stockInfo = this.getStockStatus(p);
    let effectivePrice = p.retail_price;
    let moq = 1;

    if (user && user.is_wholesale) {
      moq = p.min_wholesale_qty || 1;
      if (user.price_overrides && user.price_overrides[p.id]) {
        effectivePrice = user.price_overrides[p.id];
      } else {
        effectivePrice = p.wholesale_price;
      }
    }

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      pack_size: p.pack_size,
      price: effectivePrice,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      stock: p.stock,
      stock_status: stockInfo.status,
      stock_code: stockInfo.code,
      can_add: stockInfo.can_add,
      is_in_stock: p.stock > 0,
      min_quantity: moq,
      is_live: p.is_live,
      image: p.image,
      tagline: p.tagline,
      description: p.description
    };
  }

  createProduct(data, user = "Owner") {
    return this.addProduct(data, user);
  }

  // Add new product (Blueprint 3.4 & Test A1)
  addProduct(data, user = "Owner") {
    if (!data.name || !data.category || data.retail_price === undefined) {
      throw new Error("Missing required product fields");
    }
    const retail = parseFloat(data.retail_price);
    if (isNaN(retail) || retail <= 0) {
      throw new Error("Price must be greater than zero");
    }

    const newId = "p" + (this.products.length + 1) + "_" + Math.floor(Math.random() * 100);
    const newProduct = {
      id: newId,
      code: data.code || `PB-${Date.now().toString().slice(-4)}`,
      name: data.name.trim(),
      category: data.category,
      pack_size: data.pack_size || "Standard Pack",
      retail_price: retail,
      wholesale_price: parseFloat(data.wholesale_price) || Math.round(retail * 0.75),
      stock: parseInt(data.stock || 0, 10),
      low_stock_threshold: parseInt(data.low_stock_threshold || 20, 10),
      is_live: data.is_live !== false,
      min_wholesale_qty: parseInt(data.min_wholesale_qty || 10, 10),
      image: data.image || "/images/sourdough-pizza-base.jpg",
      tagline: data.tagline || "",
      description: data.description || "",
      hsn_code: data.hsn_code || "",
      gst_rate: parseFloat(data.gst_rate || 0)
    };

    this.products.push(newProduct);

    if (newProduct.stock > 0) {
      this.inventoryLog.unshift({
        id: "log-" + Date.now(),
        productId: newProduct.id,
        productName: newProduct.name,
        type: "INITIAL",
        quantityChange: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reason: "New product creation",
        orderNo: null,
        user: typeof user === 'object' ? user.email : user,
        timestamp: new Date().toISOString()
      });
    }

    return newProduct;
  }

  // Edit existing product (Blueprint 3.4 & Test A1)
  updateProduct(id, data) {
    const p = this.products.find(item => item.id === id);
    if (!p) throw new Error("Product not found");

    if (data.retail_price !== undefined) {
      const val = parseFloat(data.retail_price);
      if (val <= 0) throw new Error("Price must be greater than zero");
      p.retail_price = val;
    }
    if (data.wholesale_price !== undefined) p.wholesale_price = parseFloat(data.wholesale_price);
    if (data.name) p.name = data.name.trim();
    if (data.category) p.category = data.category;
    if (data.pack_size) p.pack_size = data.pack_size;
    if (data.tagline !== undefined) p.tagline = data.tagline;
    if (data.description !== undefined) p.description = data.description;
    if (data.min_wholesale_qty !== undefined) p.min_wholesale_qty = parseInt(data.min_wholesale_qty, 10);
    if (data.low_stock_threshold !== undefined) p.low_stock_threshold = parseInt(data.low_stock_threshold, 10);
    if (data.image) p.image = data.image;

    return p;
  }

  // Toggle Live / Offline with immediate storefront effect (Blueprint 3.3 & Test A2)
  toggleProductStatus(id, isLive) {
    const p = this.products.find(item => item.id === id);
    if (!p) throw new Error("Product not found");
    p.is_live = isLive !== undefined ? Boolean(isLive) : !p.is_live;
    return p;
  }

  // Delete product rule (Blueprint 3.4: cannot delete if has past orders; set to Offline instead)
  deleteProduct(id) {
    const hasPastOrder = this.orders.some(o => (o.items || []).some(item => item.id === id));
    if (hasPastOrder) {
      throw new Error("Cannot delete product with past orders; set status to Offline instead.");
    }
    const idx = this.products.findIndex(p => p.id === id);
    if (idx === -1) throw new Error("Product not found");
    return this.products.splice(idx, 1)[0];
  }

  // ==========================================
  // CART VALIDATION & HOLD RESERVATION
  // ==========================================
  validateCart(requestedItems = [], user = null) {
    const validatedItems = [];
    let subtotal = 0;
    let hasErrors = false;
    const errors = [];

    for (const item of requestedItems) {
      const product = this.products.find(p => p.id === item.id);
      
      if (!product || !product.is_live) {
        errors.push(`Item "${item.name || item.id}" is currently unavailable or offline.`);
        hasErrors = true;
        validatedItems.push({
          id: item.id,
          name: item.name || "Unavailable Product",
          requested_quantity: item.quantity,
          available_stock: 0,
          price: 0,
          total: 0,
          is_valid: false,
          error: "Product is offline or does not exist."
        });
        continue;
      }

      let unitPrice = product.retail_price;
      let moq = 1;

      if (user && user.is_wholesale) {
        moq = product.min_wholesale_qty || 1;
        if (user.price_overrides && user.price_overrides[product.id]) {
          unitPrice = user.price_overrides[product.id];
        } else {
          unitPrice = product.wholesale_price;
        }
      }

      let itemValid = true;
      let itemError = null;
      const reserved = this.getReservedStock(product.id);
      const availableStock = Math.max(0, product.stock - reserved);

      if (item.quantity > availableStock) {
        itemValid = false;
        itemError = availableStock === 0 
          ? `"${product.name}" is out of stock.` 
          : `Only ${availableStock} units available for "${product.name}".`;
        hasErrors = true;
      } else if (user && user.is_wholesale && item.quantity < moq) {
        itemValid = false;
        itemError = `Minimum wholesale order for "${product.name}" is ${moq} packs.`;
        hasErrors = true;
      } else if (item.quantity <= 0) {
        itemValid = false;
        itemError = `Quantity must be at least 1.`;
        hasErrors = true;
      }

      const itemTotal = unitPrice * item.quantity;
      if (itemValid) subtotal += itemTotal;
      const stockInfo = this.getStockStatus(product);

      validatedItems.push({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        pack_size: product.pack_size,
        image: product.image,
        unit_price: unitPrice,
        quantity: item.quantity,
        total: itemTotal,
        stock: availableStock,
        total_physical_stock: product.stock,
        stock_status: stockInfo.status,
        min_quantity: moq,
        is_valid: itemValid,
        error: itemError
      });
    }

    let deliveryCharge = 0;
    if (this.settings.delivery_charge > 0) {
      deliveryCharge = this.settings.delivery_charge;
    } else if (subtotal > 0 && subtotal < this.settings.delivery_charge_threshold) {
      deliveryCharge = this.settings.default_delivery_fee;
    }

    const tax = 0;
    const grandTotal = subtotal + deliveryCharge + tax;

    return {
      is_valid: !hasErrors && validatedItems.length > 0,
      errors,
      items: validatedItems,
      subtotal,
      delivery_charge: deliveryCharge,
      tax_gst: tax,
      grand_total: grandTotal
    };
  }

  createReservation({ items = [], customer = {}, user = null, inShop = false }) {
    this.cleanupExpiredReservations();

    const validation = this.validateCart(items, user);
    if (!validation.is_valid) {
      return {
        success: false,
        error: 'One or more items are out of stock or exceed available quantity.',
        validation
      };
    }

    const reservationId = 'RES-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderNo = 'BB-' + Math.floor(100000 + Math.random() * 900000);
    const holdDurationMs = (this.settings.stock_hold_minutes || 10) * 60 * 1000;
    const expiresAt = Date.now() + holdDurationMs;

    const reservation = {
      id: reservationId,
      orderNo,
      customer,
      user,
      inShop,
      items: validation.items,
      subtotal: validation.subtotal,
      delivery_charge: validation.delivery_charge,
      tax_gst: validation.tax_gst,
      grand_total: validation.grand_total,
      expiresAt,
      holdSeconds: (this.settings.stock_hold_minutes || 10) * 60,
      status: 'HELD',
      createdAt: new Date().toISOString()
    };

    this.reservations.set(reservationId, reservation);

    return {
      success: true,
      reservationId,
      orderNo,
      expiresAt,
      holdSeconds: reservation.holdSeconds,
      summary: {
        items: validation.items,
        subtotal: validation.subtotal,
        delivery_charge: validation.delivery_charge,
        grand_total: validation.grand_total
      }
    };
  }

  cancelReservation(reservationId) {
    const res = this.reservations.get(reservationId);
    if (res && res.status === 'HELD') {
      res.status = 'CANCELLED';
      return { success: true, message: 'Stock hold released.' };
    }
    return { success: false, error: 'Reservation not found or already closed.' };
  }

  confirmPayment({ reservationId, paymentId, paymentSignature, simulatedStatus = 'success' }) {
    this.cleanupExpiredReservations();

    if (this.processedPayments.has(paymentId)) {
      const existingOrder = this.orders.find(o => o.paymentId === paymentId);
      return {
        success: true,
        duplicate: true,
        message: 'Payment already processed (idempotent).',
        order: existingOrder
      };
    }

    const reservation = this.reservations.get(reservationId);
    if (!reservation) return { success: false, error: 'Reservation not found.' };

    if (simulatedStatus === 'failure') {
      reservation.status = 'FAILED';
      return { success: false, status: 'FAILED', error: 'Payment declined. Stock hold released.' };
    }

    if (simulatedStatus === 'pending') {
      reservation.status = 'PENDING';
      return { success: true, status: 'PENDING', message: 'Payment verification pending from bank.' };
    }

    if (reservation.status === 'EXPIRED' || Date.now() > reservation.expiresAt) {
      reservation.status = 'EXPIRED';
      return { success: false, status: 'EXPIRED', error: 'Hold expired after 10 minutes.' };
    }

    if (reservation.status !== 'HELD') {
      return { success: false, error: `Reservation is ${reservation.status}.` };
    }

    // Atomic permanent stock deduction & log entry (Blueprint Admin 3.5 & Test A4)
    for (const item of reservation.items) {
      const product = this.products.find(p => p.id === item.id);
      if (product) {
        const prevStock = product.stock;
        product.stock = Math.max(0, product.stock - item.quantity);

        this.inventoryLog.unshift({
          id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          productId: product.id,
          productName: product.name,
          type: "SALE",
          quantityChange: -item.quantity,
          previousStock: prevStock,
          newStock: product.stock,
          reason: `Customer Order #${reservation.orderNo}`,
          orderNo: reservation.orderNo,
          user: "Customer Online",
          timestamp: new Date().toISOString()
        });
      }
    }

    reservation.status = 'PAID';
    this.processedPayments.add(paymentId);

    const now = new Date();
    const invoiceNo = `${this.settings.invoice_prefix}-${this.settings.next_invoice_number++}`;

    const order = {
      orderNo: reservation.orderNo,
      invoiceNo,
      reservationId,
      paymentId,
      customer: reservation.customer,
      items: reservation.items,
      subtotal: reservation.subtotal,
      delivery_charge: reservation.delivery_charge,
      tax_gst: reservation.tax_gst,
      grand_total: reservation.grand_total,
      status: 'Paid',
      statusSteps: [
        { label: 'Paid', done: true, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { label: 'Packed', done: false },
        { label: 'Out for delivery', done: false },
        { label: 'Delivered', done: false }
      ],
      wholesalerId: (reservation.user && reservation.user.id) ? reservation.user.id : null,
      channel: reservation.inShop ? 'In-shop' : 'Online',
      tag: reservation.user?.is_wholesale ? 'Wholesale' : (reservation.inShop ? 'In-shop' : 'Retail'),
      paymentMode: 'Online Gateway',
      createdAt: now.toISOString(),
      expectedDelivery: 'Tomorrow by 6:00 PM'
    };

    this.orders.push(order);

    // Trigger notification (WhatsApp, Email, Push) without blocking order (Blueprint 3.13 & Test O3-O6)
    try {
      const notificationService = require('../services/notificationService');
      notificationService.notifyNewPaidOrder(order, this.settings);
    } catch (e) {
      console.error('Notification dispatch error:', e);
    }

    return { success: true, order };
  }

  // ==========================================
  // OFFLINE ORDER / WALK-IN POS (Blueprint 3.8 & Test Q3)
  // ==========================================
  createOfflineOrder(params) {
    return this.recordOfflineOrder(params);
  }

  recordOfflineOrder({ items = [], customer = {}, paymentMode = "Cash", amountReceived = 0, user = "Staff" }) {
    if (!items || items.length === 0) throw new Error("Please select at least one product");

    let subtotal = 0;
    const orderItems = [];

    // Verify stock and calculate subtotal
    for (const line of items) {
      const pid = line.id || line.productId;
      const product = this.products.find(p => p.id === pid);
      if (!product) throw new Error(`Product ${pid} not found`);
      const qty = parseInt(line.quantity, 10);
      if (qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
      if (product.stock < qty) throw new Error(`Insufficient stock for ${product.name} (Only ${product.stock} available)`);

      const prevStock = product.stock;
      product.stock -= qty;

      const lineTotal = product.retail_price * qty;
      subtotal += lineTotal;

      orderItems.push({
        id: product.id,
        code: product.code,
        name: product.name,
        pack_size: product.pack_size,
        unit_price: product.retail_price,
        quantity: qty,
        total: lineTotal,
        image: product.image
      });

      // Audit log entry (Blueprint 3.5 & Security Rule 5)
      this.inventoryLog.unshift({
        id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        productId: product.id,
        productName: product.name,
        type: "OFFLINE_SALE",
        quantityChange: -qty,
        previousStock: prevStock,
        newStock: product.stock,
        reason: "Offline Walk-in / Phone Order",
        orderNo: null,
        user: typeof user === 'object' ? user.email : user,
        timestamp: new Date().toISOString()
      });
    }

    const orderNo = "BB-POS-" + Math.floor(100000 + Math.random() * 900000);
    const invoiceNo = `${this.settings.invoice_prefix}-${this.settings.next_invoice_number++}`;
    const now = new Date();

    const order = {
      orderNo,
      invoiceNo,
      reservationId: null,
      paymentId: "OFFLINE-" + Date.now(),
      customer: {
        name: customer.name || "Walk-in Customer",
        mobile: customer.mobile || "",
        address: "Counter Sale / Local Pickup"
      },
      items: orderItems,
      subtotal,
      delivery_charge: 0,
      tax_gst: 0,
      grand_total: subtotal,
      status: "Delivered", // Immediately handed over
      statusSteps: [
        { label: "Paid", done: true, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { label: "Packed", done: true },
        { label: "Delivered", done: true }
      ],
      channel: "In-shop",
      tag: "In-shop", // Test Q3: Tagged In-shop
      paymentMode: paymentMode || "Cash",
      amountReceived: amountReceived || subtotal,
      recordedBy: typeof user === 'object' ? user.email : user,
      createdAt: now.toISOString(),
      expectedDelivery: "Immediate Counter Pickup"
    };

    this.orders.push(order);
    return order;
  }

  // ==========================================
  // WHOLESALE OVERRIDES (Blueprint 3.10 & Test W4)
  // ==========================================
  setWholesalePriceOverride(wholesalerId, productId, overridePrice) {
    const wholesaler = this.wholesalers.find(w => w.id === wholesalerId);
    if (!wholesaler) throw new Error("Wholesaler not found");

    const price = parseFloat(overridePrice);
    if (isNaN(price) || price <= 0) throw new Error("Price must be greater than zero");

    wholesaler.price_overrides = wholesaler.price_overrides || {};
    wholesaler.price_overrides[productId] = price;
    return wholesaler;
  }

  // ==========================================
  // ORDER STATUS & DETAIL (Blueprint 3.7 & Test O2)
  // ==========================================
  updateOrderStatus(orderNo, newStatus) {
    const order = this.orders.find(o => o.orderNo === orderNo);
    if (!order) throw new Error("Order not found");

    const validStatuses = ['Paid', 'Packed', 'Out for delivery', 'Delivered'];
    if (!validStatuses.includes(newStatus)) throw new Error("Invalid order status");

    order.status = newStatus;
    const now = new Date();

    // Update status steps progress
    const idx = validStatuses.indexOf(newStatus);
    order.statusSteps = validStatuses.map((st, i) => ({
      label: st,
      done: i <= idx,
      time: i === idx ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
    }));

    return order;
  }

  addOrderInternalNote(orderNo, noteText) {
    const order = this.orders.find(o => o.orderNo === orderNo);
    if (!order) throw new Error("Order not found");
    order.internalNotes = (order.internalNotes ? order.internalNotes + "\n" : "") + noteText;
    return order;
  }

  getOrder(orderNo, phone = null) {
    const order = this.orders.find(o => o.orderNo === orderNo);
    if (!order) return null;

    if (phone && order.customer && order.customer.mobile) {
      const clean1 = phone.replace(/\D/g, '');
      const clean2 = order.customer.mobile.replace(/\D/g, '');
      if (clean1 !== clean2) return { error: 'Phone number does not match order record.' };
    }
    return order;
  }

  getWholesaleOrders(wholesalerId) {
    return this.orders.filter(o => o.wholesalerId === wholesalerId);
  }

  reorderPastOrder(orderId, wholesalerId) {
    const order = this.orders.find(o => (o.orderNo === orderId || o.reservationId === orderId) && o.wholesalerId === wholesalerId);
    if (!order) return { success: false, error: 'Order not found in wholesale account.' };

    const refillItems = [];
    for (const item of order.items) {
      const liveProduct = this.products.find(p => p.id === item.id);
      if (liveProduct && liveProduct.is_live) {
        refillItems.push({
          id: liveProduct.id,
          name: liveProduct.name,
          pack_size: liveProduct.pack_size,
          quantity: item.quantity,
          min_quantity: liveProduct.min_wholesale_qty || 1,
          retail_price: liveProduct.retail_price,
          wholesale_price: liveProduct.wholesale_price,
          stock: liveProduct.stock,
          image: liveProduct.image
        });
      }
    }
    return { success: true, orderNo: order.orderNo, items: refillItems };
  }
}

module.exports = new Store();
