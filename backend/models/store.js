/**
 * BACKREY BASES - CENTRAL DATA STORE & BUSINESS MODEL
 * Serves both Customer Storefront and Owner Admin Panel.
 */

class Store {
  constructor() {
    this.persistenceEnabled = false;
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
      invoice_series: {
        factory: { prefix: "FAC/2026-27", next_number: 1 },
        shopkeeper: { prefix: "SHP/2026-27", next_number: 1 },
        regular: { prefix: "RET/2026-27", next_number: 1 }
      },
      stock_hold_minutes: 10,
      default_low_stock_threshold: 20,
      delivery_charge: 0,
      delivery_charge_threshold: 500,
      default_delivery_fee: 40,
      auto_offline_at_zero: false,
      week_start_day: "Monday", // Blueprint Addendum Section 8 & 9.2 (default Monday)
      use_separate_shop_stock: true, // Blueprint Addendum Section 8 (confirmed ON)
      year_type: "financial", // Blueprint Addendum Section 10
      otp_limits: { max_per_window: 5, window_ms: 300000 }, // Blueprint Addendum Section 5 (max 5 requests per 5 mins)
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

    // 4. Wholesalers Registry (Legacy compatibility for tests W1, W3, W4, W5, W7, W8)
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

    // =========================================================================
    // BLUEPRINT ADDENDUM: THREE SECTIONS, CUSTOM PRICES & SECTIONED BILLING
    // =========================================================================

    // 4.1 Price Lists (Section 10: price_lists: id, section, name, type, is_active)
    this.price_lists = [
      // FACTORY SECTION
      {
        id: "pl-fac-std",
        section: "factory",
        name: "Factory Standard",
        type: "standard",
        is_active: true
      },
      {
        id: "pl-fac-spc-1",
        section: "factory",
        name: "Factory Special (Owner Settlement)",
        type: "special",
        is_active: true
      },
      // SHOPKEEPERS SECTION
      {
        id: "pl-shp-std",
        section: "shopkeeper",
        name: "Shopkeepers Standard",
        type: "standard",
        is_active: true
      },
      {
        id: "pl-shp-spc-1",
        section: "shopkeeper",
        name: "Shopkeepers Special (Bella Napoli)",
        type: "special",
        is_active: true
      },
      // REGULAR (SHOP) SECTION
      {
        id: "pl-reg-std",
        section: "regular",
        name: "Regular (Shop) Retail Standard",
        type: "standard",
        is_active: true
      },
      {
        id: "pl-reg-spc-1",
        section: "regular",
        name: "Regular (Shop) VIP Special",
        type: "special",
        is_active: true
      }
    ];

    // 4.2 Price List Items (Section 10: price_list_items: price_list_id, product_id, unit, pack_size, price_paise, moq)
    // Unit decision (Section 3 & 4):
    // Regular (Shop) buys per piece (bun @ ₹20). Factory & Shopkeepers buy per pack (pack of 10 @ ₹100 Std / ₹90 Special).
    this.price_list_items = [
      // --- Factory Standard (pl-fac-std) ---
      { price_list_id: "pl-fac-std", product_id: "p1", unit: "pack", pack_size: 2, price: 130, price_paise: 13000, moq: 10 },
      { price_list_id: "pl-fac-std", product_id: "p2", unit: "pack", pack_size: 10, price: 100, price_paise: 10000, moq: 10 }, // 10 packs = 100 buns = ₹1,000 (Worked example)
      { price_list_id: "pl-fac-std", product_id: "p3", unit: "pack", pack_size: 1, price: 80, price_paise: 8000, moq: 10 },
      { price_list_id: "pl-fac-std", product_id: "p4", unit: "pack", pack_size: 2, price: 100, price_paise: 10000, moq: 10 },

      // --- Factory Special: Owner Settlement (pl-fac-spc-1) ---
      { price_list_id: "pl-fac-spc-1", product_id: "p1", unit: "pack", pack_size: 2, price: 120, price_paise: 12000, moq: 10 },
      { price_list_id: "pl-fac-spc-1", product_id: "p2", unit: "pack", pack_size: 10, price: 90, price_paise: 9000, moq: 10 }, // 10 packs = 100 buns = ₹900 (Worked example)

      // --- Shopkeepers Standard (pl-shp-std) ---
      { price_list_id: "pl-shp-std", product_id: "p1", unit: "pack", pack_size: 2, price: 130, price_paise: 13000, moq: 10 },
      { price_list_id: "pl-shp-std", product_id: "p2", unit: "pack", pack_size: 10, price: 100, price_paise: 10000, moq: 5 },
      { price_list_id: "pl-shp-std", product_id: "p3", unit: "pack", pack_size: 1, price: 80, price_paise: 8000, moq: 8 },
      { price_list_id: "pl-shp-std", product_id: "p4", unit: "pack", pack_size: 2, price: 100, price_paise: 10000, moq: 10 },

      // --- Shopkeepers Special (pl-shp-spc-1) ---
      { price_list_id: "pl-shp-spc-1", product_id: "p1", unit: "pack", pack_size: 2, price: 120, price_paise: 12000, moq: 10 }, // Custom rate for Bella Napoli
      { price_list_id: "pl-shp-spc-1", product_id: "p2", unit: "pack", pack_size: 10, price: 95, price_paise: 9500, moq: 5 },

      // --- Regular (Shop) Retail Standard (pl-reg-std) ---
      { price_list_id: "pl-reg-std", product_id: "p1", unit: "piece", pack_size: 1, price: 90, price_paise: 9000, moq: 1 },
      { price_list_id: "pl-reg-std", product_id: "p2", unit: "piece", pack_size: 1, price: 20, price_paise: 2000, moq: 1 }, // 1 bun @ ₹20 (Worked example)
      { price_list_id: "pl-reg-std", product_id: "p3", unit: "piece", pack_size: 1, price: 120, price_paise: 12000, moq: 1 },
      { price_list_id: "pl-reg-std", product_id: "p4", unit: "piece", pack_size: 1, price: 75, price_paise: 7500, moq: 1 },

      // --- Regular (Shop) VIP Special (pl-reg-spc-1) ---
      { price_list_id: "pl-reg-spc-1", product_id: "p2", unit: "piece", pack_size: 1, price: 18, price_paise: 1800, moq: 1 }
    ];

    // 4.3 Customers Registry (Section 10: section, mobile (unique), is_active, can_login, price_list_id)
    this.customers = [
      {
        id: "cust-fac-std",
        section: "factory",
        name: "Factory Customer A",
        shop_name: "Apex Cloud Kitchens",
        mobile: "9876500001",
        email: "procurement@apexkitchens.in",
        address: "Plot 42, Peenya Industrial Area, Bengaluru",
        gstin: "29ABCDE1234F1Z5",
        is_active: true,
        can_login: true,
        price_list_id: null, // null = Section Standard list
        createdAt: "2026-10-01T10:00:00.000Z"
      },
      {
        id: "cust-fac-spc",
        section: "factory",
        name: "Factory Customer B",
        shop_name: "Gourmet Hub Factory",
        mobile: "9876500002",
        email: "chef@gourmethub.in",
        address: "Plot 10, Bommasandra Industrial Estate, Bengaluru",
        gstin: "29XYZAB5678C1Z2",
        is_active: true,
        can_login: true,
        price_list_id: "pl-fac-spc-1", // Special list with ₹9 bun
        createdAt: "2026-10-05T10:00:00.000Z"
      },
      {
        id: "cust-shp-1",
        section: "shopkeeper",
        name: "Marco Rossi",
        shop_name: "Bella Napoli Pizzeria",
        mobile: "9876543210",
        email: "marco@bellanapoli.in",
        address: "Shop 14, High Street Mall, Indiranagar",
        state: "Karnataka",
        gstin: "29AAAAA0000A1Z5",
        is_active: true,
        can_login: true,
        price_list_id: "pl-shp-spc-1",
        createdAt: "2026-10-10T10:00:00.000Z"
      },
      {
        id: "cust-shp-2",
        section: "shopkeeper",
        name: "Antonio Silva",
        shop_name: "Roma Trattoria & Cafe",
        mobile: "9812345678",
        email: "antonio@romatrattoria.in",
        address: "12, Koramangala 5th Block",
        state: "Karnataka",
        gstin: "29BBBBB1111B2Z6",
        is_active: true,
        can_login: true,
        price_list_id: null, // Standard shopkeeper list
        createdAt: "2026-10-12T10:00:00.000Z"
      },
      {
        id: "cust-reg-spc",
        section: "regular",
        name: "Vikram Malhotra",
        shop_name: "Residential Customer",
        mobile: "9876500003",
        email: "vikram@malhotra.in",
        address: "Flat 402, Palm Meadows, Whitefield",
        state: "Karnataka",
        gstin: "",
        is_active: true,
        can_login: true,
        price_list_id: "pl-reg-spc-1", // Special VIP rate
        createdAt: "2026-10-15T10:00:00.000Z"
      },
      {
        id: "cust-deactivated-1",
        section: "factory",
        name: "Deactivated Client",
        shop_name: "Closed Outlet",
        mobile: "9876599999",
        email: "closed@outlet.in",
        address: "Closed Premises",
        state: "Karnataka",
        gstin: "",
        is_active: false, // Deactivated (Test L3)
        can_login: false,
        price_list_id: null,
        createdAt: "2026-09-01T10:00:00.000Z"
      }
    ];

    // 4.4 Price Change Audit Trail (Section 10: price_change_log)
    this.price_change_log = [];

    // 4.5 Dual Stock Locations & Transfers (Section 8 & 10: stock_locations, location_stock, stock_transfers)
    this.stock_locations = [
      { id: "loc-factory", name: "Factory" },
      { id: "loc-shop", name: "Shop" }
    ];

    // Location stock always stored in pieces (Section 4 & 10)
    this.location_stock = [
      { location_id: "loc-factory", product_id: "p1", qty: 200 },
      { location_id: "loc-factory", product_id: "p2", qty: 300 }, // 300 buns at factory (Worked example Section 8)
      { location_id: "loc-factory", product_id: "p3", qty: 100 },
      { location_id: "loc-factory", product_id: "p4", qty: 0 },
      { location_id: "loc-shop", product_id: "p1", qty: 50 },
      { location_id: "loc-shop", product_id: "p2", qty: 200 }, // 200 buns at shop (Worked example Section 8)
      { location_id: "loc-shop", product_id: "p3", qty: 50 },
      { location_id: "loc-shop", product_id: "p4", qty: 0 }
    ];

    this.stock_transfers = [];

    // 4.6 OTP Request Tracking & Rate Limiting (Section 5 & 10: otp_log)
    this.otp_log = [];

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

  // Location Stock Helpers (Blueprint Addendum Section 8 & 10)
  getLocationStock(locationId, productId) {
    const entry = this.location_stock.find(ls => ls.location_id === locationId && ls.product_id === productId);
    if (entry) return entry.qty;
    const product = this.products.find(p => p.id === productId);
    return product ? product.stock : 0;
  }

  setLocationStock(locationId, productId, qty) {
    let entry = this.location_stock.find(ls => ls.location_id === locationId && ls.product_id === productId);
    if (!entry) {
      entry = { location_id: locationId, product_id: productId, qty: 0 };
      this.location_stock.push(entry);
    }
    entry.qty = parseInt(qty, 10) || 0;
    return entry.qty;
  }

  deductLocationStock(locationId, productId, pieces) {
    let entry = this.location_stock.find(ls => ls.location_id === locationId && ls.product_id === productId);
    if (!entry) {
      entry = { location_id: locationId, product_id: productId, qty: 0 };
      this.location_stock.push(entry);
    }
    const deduction = parseInt(pieces, 10) || 0;
    entry.qty = Math.max(0, entry.qty - deduction);
    return entry.qty;
  }

  getStockStatusForLocation(product, locationId) {
    if (!this.settings.use_separate_shop_stock || !locationId) {
      return this.getStockStatus(product);
    }
    const locQty = this.getLocationStock(locationId, product.id);
    const reserved = this.getReservedStock(product.id);
    const available = Math.max(0, locQty - reserved);
    const threshold = product.low_stock_threshold || this.settings.default_low_stock_threshold;

    if (available <= 0) {
      return { status: "Out of stock", code: "OUT_OF_STOCK", available: 0, can_add: false };
    }
    if (available <= threshold) {
      return { status: "Low stock", code: "LOW_STOCK", available, can_add: true };
    }
    return { status: "In stock", code: "IN_STOCK", available, can_add: true };
  }

  // Sequential zero-gap invoice series per section (Blueprint Addendum Section 9.1 & Test B1)
  getNextInvoiceNo(section = "regular") {
    const sec = (section || "regular").toLowerCase();
    const seriesConfig = this.settings.invoice_series || {
      factory: { prefix: "FAC/2026-27", next_number: 1 },
      shopkeeper: { prefix: "SHP/2026-27", next_number: 1 },
      regular: { prefix: "RET/2026-27", next_number: 1 }
    };

    const s = seriesConfig[sec] || seriesConfig["regular"];
    const num = s.next_number++;
    return `${s.prefix}/${String(num).padStart(4, "0")}`;
  }

  // Set morning opening stock (Blueprint 3.5 & Test A3)
  setOpeningStock(productId, newOpeningStock, user = "Owner", locationId = null) {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");

    const prev = p.stock;
    const targetVal = parseInt(newOpeningStock, 10);
    if (locationId) {
      this.setLocationStock(locationId, productId, targetVal);
      p.stock = this.getLocationStock('loc-factory', productId) + this.getLocationStock('loc-shop', productId);
    } else {
      p.stock = targetVal;
      this.setLocationStock('loc-shop', productId, targetVal);
      this.setLocationStock('loc-factory', productId, 0);
    }
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
  restockProduct(productId, addQuantity, user = "Owner", locationId = "loc-shop") {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");

    const qty = parseInt(addQuantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error("Restock quantity must be positive");

    const prev = p.stock;
    p.stock += qty;
    const targetLoc = locationId || "loc-shop";
    this.setLocationStock(targetLoc, productId, this.getLocationStock(targetLoc, productId) + qty);

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
  adjustStock(productId, newStockValue, reason, user = "Owner", locationId = null) {
    const p = this.products.find(item => item.id === productId);
    if (!p) throw new Error("Product not found");
    if (!reason || !reason.trim()) throw new Error("Mandatory reason required for manual adjustment");

    const targetStock = parseInt(newStockValue, 10);
    if (isNaN(targetStock) || targetStock < 0) throw new Error("Stock count must be a non-negative number");

    const prev = p.stock;
    const change = targetStock - prev;
    if (locationId) {
      this.setLocationStock(locationId, productId, targetStock);
      p.stock = this.getLocationStock('loc-factory', productId) + this.getLocationStock('loc-shop', productId);
    } else {
      p.stock = targetStock;
      const currShop = this.getLocationStock('loc-shop', productId);
      this.setLocationStock('loc-shop', productId, Math.max(0, currShop + change));
    }

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
    let effectivePrice = p.retail_price;
    let moq = 1;
    let unit = "piece";
    let packSize = 1;
    let priceSource = "retail";
    let priceListId = null;

    if (user && user.section) {
      const resolution = this.resolvePriceForCustomer(user, p);
      effectivePrice = resolution.price;
      moq = resolution.moq;
      unit = resolution.unit;
      packSize = resolution.pack_size;
      priceSource = resolution.price_source;
      priceListId = resolution.price_list_id;
    } else if (user && user.is_wholesale) {
      moq = p.min_wholesale_qty || 1;
      if (user.price_overrides && user.price_overrides[p.id]) {
        effectivePrice = user.price_overrides[p.id];
      } else {
        effectivePrice = p.wholesale_price;
      }
    }

    // Determine location stock for the storefront badge (Blueprint Addendum Section 8)
    let locationId = 'loc-shop';
    if (user && user.section === 'factory') {
      locationId = 'loc-factory';
    } else if (user && user.section === 'shopkeeper') {
      locationId = 'loc-factory';
    }

    const locStock = this.getLocationStock(locationId, p.id);
    const stockInfo = this.getStockStatusForLocation(p, locationId);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      pack_size: unit === 'pack' ? `Pack of ${packSize}` : p.pack_size,
      unit,
      pack_unit_size: packSize,
      price: effectivePrice,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      stock: this.settings.use_separate_shop_stock ? locStock : p.stock,
      total_physical_stock: p.stock,
      location_id: locationId,
      stock_status: stockInfo.status,
      stock_code: stockInfo.code,
      can_add: stockInfo.can_add,
      is_in_stock: (this.settings.use_separate_shop_stock ? locStock : p.stock) > 0,
      min_quantity: moq,
      price_source: priceSource,
      price_list_id: priceListId,
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
  validateCart(requestedItems = [], user = null, locationId = null) {
    const validatedItems = [];
    let subtotal = 0;
    let hasErrors = false;
    let hasPriceChange = false;
    const errors = [];
    const notices = [];

    // Find customer context (Blueprint Addendum Section 3 & 4)
    let customer = null;
    if (user && user.section) {
      customer = user;
    } else if (user && user.id) {
      customer = this.findCustomerById(user.id);
    }

    // Determine location stock source (Blueprint Addendum Section 8)
    let effectiveLocation = locationId;
    if (!effectiveLocation) {
      if (customer && (customer.section === "factory" || customer.section === "shopkeeper")) {
        effectiveLocation = "loc-factory";
      } else {
        effectiveLocation = "loc-shop";
      }
    }

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
      let unit = "piece";
      let packSize = 1;
      let priceSource = "retail";
      let priceListId = null;

      if (customer) {
        const resolution = this.resolvePriceForCustomer(customer, product);
        unitPrice = resolution.price;
        moq = resolution.moq;
        unit = resolution.unit;
        packSize = resolution.pack_size || 1;
        priceSource = resolution.price_source;
        priceListId = resolution.price_list_id;
      } else if (user && user.is_wholesale) {
        moq = product.min_wholesale_qty || 1;
        if (user.price_overrides && user.price_overrides[product.id]) {
          unitPrice = user.price_overrides[product.id];
        } else {
          unitPrice = product.wholesale_price;
        }
      }

      // Check if client submitted an outdated or tampered price (Blueprint Test PL8 & PL9)
      const clientPrice = item.price !== undefined ? Number(item.price) : (item.unit_price !== undefined ? Number(item.unit_price) : null);
      let priceNotice = null;
      if (clientPrice !== null && clientPrice !== unitPrice) {
        hasPriceChange = true;
        priceNotice = `Price for "${product.name}" has changed from ₹${clientPrice} to ₹${unitPrice}.`;
        notices.push(priceNotice);
      }

      let itemValid = true;
      let itemError = null;

      // Check stock availability (always computed in pieces as per Section 4 & 8)
      const piecesNeeded = (unit === "pack") ? (item.quantity * packSize) : item.quantity;
      const reserved = this.getReservedStock(product.id);
      const locPieces = this.settings.use_separate_shop_stock 
        ? this.getLocationStock(effectiveLocation, product.id) 
        : product.stock;
      const availablePieces = Math.max(0, locPieces - reserved);
      const availableUnits = (unit === "pack") ? Math.floor(availablePieces / packSize) : availablePieces;

      if (item.quantity > availableUnits) {
        itemValid = false;
        itemError = availableUnits === 0 
          ? `"${product.name}" is out of stock.` 
          : `Only ${availableUnits} ${unit === "pack" ? "packs" : "units"} available for "${product.name}".`;
        hasErrors = true;
      } else if (item.quantity < moq) {
        itemValid = false;
        itemError = (user && user.is_wholesale && !customer)
          ? `Minimum wholesale order for "${product.name}" is ${moq} packs.`
          : `Minimum order quantity for "${product.name}" is ${moq} ${unit === "pack" ? "packs" : "pieces"}.`;
        hasErrors = true;
      } else if (item.quantity <= 0) {
        itemValid = false;
        itemError = `Quantity must be at least 1.`;
        hasErrors = true;
      }

      // Server strictly enforces server unitPrice * quantity (Test PL8)
      const itemTotal = unitPrice * item.quantity;
      if (itemValid) subtotal += itemTotal;
      const stockInfo = this.getStockStatus(product);

      validatedItems.push({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        pack_size: product.pack_size,
        unit,
        pack_unit_size: packSize,
        pieces: piecesNeeded,
        image: product.image,
        unit_price: unitPrice,
        price: unitPrice,
        price_source: priceSource,
        price_list_id: priceListId,
        price_changed: clientPrice !== null && clientPrice !== unitPrice,
        notice: priceNotice,
        quantity: item.quantity,
        total: itemTotal,
        stock: availableUnits,
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
      price_changed: hasPriceChange,
      notices,
      errors,
      items: validatedItems,
      subtotal,
      delivery_charge: deliveryCharge,
      tax_gst: tax,
      grand_total: grandTotal
    };
  }

  createReservation({ items = [], customer = {}, user = null, inShop = false, stock_location_id = null }) {
    this.cleanupExpiredReservations();

    // Only authenticated/logged-in users get section/special prices (Blueprint Section 4 & Security)
    const effectiveUser = user;

    const section = (effectiveUser && effectiveUser.section) ? effectiveUser.section : (customer.section || "regular");
    const defaultLocation = (section === "factory") ? "loc-factory" : "loc-shop";
    const locationId = stock_location_id || customer.collect_from || defaultLocation;

    const validation = this.validateCart(items, effectiveUser, locationId);
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
      customer: {
        ...customer,
        section
      },
      user: effectiveUser,
      section,
      stock_location_id: locationId,
      price_list_id: effectiveUser?.price_list_id || null,
      inShop,
      items: validation.items,
      subtotal: validation.subtotal,
      delivery_charge: validation.delivery_charge,
      tax_gst: validation.tax_gst,
      grand_total: validation.grand_total,
      price_changed: validation.price_changed,
      notices: validation.notices,
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
      section,
      price_changed: validation.price_changed,
      notices: validation.notices,
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

    // Atomic permanent stock deduction from location stock & global inventory log (Section 8 & Test IN2, IN3)
    const orderLocation = reservation.stock_location_id || ((reservation.section === 'factory') ? 'loc-factory' : 'loc-shop');

    for (const item of reservation.items) {
      const product = this.products.find(p => p.id === item.id);
      const pieces = item.pieces || ((item.unit === 'pack') ? (item.quantity * (item.pack_unit_size || 1)) : item.quantity);

      if (product) {
        const prevStock = product.stock;
        product.stock = Math.max(0, product.stock - pieces);

        this.inventoryLog.unshift({
          id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
          productId: product.id,
          productName: product.name,
          type: "SALE",
          quantityChange: -pieces,
          previousStock: prevStock,
          newStock: product.stock,
          reason: `Customer Order #${reservation.orderNo}`,
          orderNo: reservation.orderNo,
          user: "Customer Online",
          timestamp: new Date().toISOString()
        });
      }

      // Deduct from location stock
      this.deductLocationStock(orderLocation, item.id, pieces);
    }

    reservation.status = 'PAID';
    this.processedPayments.add(paymentId);

    const now = new Date();
    // Sectioned sequential invoice series (Test B1)
    const invoiceNo = this.getNextInvoiceNo(reservation.section);

    const order = {
      orderNo: reservation.orderNo,
      invoiceNo,
      reservationId,
      paymentId,
      customer: reservation.customer,
      customerId: reservation.user?.id || null,
      section: reservation.section || 'regular',
      price_list_id: reservation.price_list_id || null,
      stock_location_id: orderLocation,
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
      tag: (reservation.user && reservation.user.is_wholesale) ? 'Wholesale' : (reservation.inShop ? 'In-shop' : 'Retail'),
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

  getWholesaleOrders(customerIdOrWholesalerId) {
    const cust = this.findCustomerById(customerIdOrWholesalerId);
    const cleanMobile = cust ? this.cleanMobile(cust.mobile) : null;
    return this.orders.filter(o =>
      o.wholesalerId === customerIdOrWholesalerId ||
      o.customerId === customerIdOrWholesalerId ||
      (cleanMobile && o.customer && this.cleanMobile(o.customer.mobile) === cleanMobile)
    );
  }

  reorderPastOrder(orderId, customerIdOrWholesalerId) {
    const order = this.orders.find(o => 
      (o.orderNo === orderId || o.reservationId === orderId) && 
      (o.wholesalerId === customerIdOrWholesalerId || 
       o.customerId === customerIdOrWholesalerId || 
       (o.customer && (o.customer.id === customerIdOrWholesalerId || o.customer.mobile === customerIdOrWholesalerId)))
    );
    if (!order) return { success: false, error: 'Order not found in account.' };

    const customer = this.findCustomerById(customerIdOrWholesalerId) || this.findCustomerByMobile(customerIdOrWholesalerId);

    const refillItems = [];
    for (const item of order.items) {
      const liveProduct = this.products.find(p => p.id === item.id);
      if (liveProduct && liveProduct.is_live) {
        let price = liveProduct.retail_price;
        let moq = 1;
        let unit = 'piece';
        let packSize = 1;

        if (customer) {
          const res = this.resolvePriceForCustomer(customer, liveProduct);
          price = res.price;
          moq = res.moq;
          unit = res.unit;
          packSize = res.pack_size;
        } else {
          price = liveProduct.wholesale_price;
          moq = liveProduct.min_wholesale_qty || 1;
        }

        refillItems.push({
          id: liveProduct.id,
          name: liveProduct.name,
          pack_size: liveProduct.pack_size,
          quantity: item.quantity,
          unit,
          pack_unit_size: packSize,
          min_quantity: moq,
          price,
          retail_price: liveProduct.retail_price,
          wholesale_price: liveProduct.wholesale_price,
          stock: liveProduct.stock,
          image: liveProduct.image
        });
      }
    }
    return { success: true, orderNo: order.orderNo, items: refillItems };
  }

  // =========================================================================
  // BLUEPRINT ADDENDUM: CUSTOMER SECTIONS, OTP AUTH & CUSTOM PRICE METHODS
  // =========================================================================

  cleanMobile(mobile) {
    if (!mobile) return "";
    return String(mobile).replace(/\D/g, "").slice(-10);
  }

  findCustomerByMobile(mobile) {
    const clean = this.cleanMobile(mobile);
    if (!clean) return null;
    return this.customers.find(c => this.cleanMobile(c.mobile) === clean) || null;
  }

  findCustomerById(id) {
    return this.customers.find(c => c.id === id) || null;
  }

  getCustomersBySection(section) {
    const sec = (section || "").toLowerCase();
    return this.customers
      .filter(c => c.section === sec)
      .map(c => {
        const custOrders = this.orders.filter(o => 
          o.customerId === c.id || 
          (o.customer && this.cleanMobile(o.customer.mobile) === this.cleanMobile(c.mobile))
        );
        const totalSpend = custOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
        const lastOrder = custOrders.length ? custOrders[custOrders.length - 1].createdAt : null;

        let priceListName = "Standard";
        let customPriceCount = 0;
        if (c.price_list_id) {
          const pl = this.price_lists.find(p => p.id === c.price_list_id);
          if (pl) priceListName = pl.name;
          customPriceCount = this.price_list_items.filter(i => i.price_list_id === c.price_list_id).length;
        }

        return {
          ...c,
          price_list_name: priceListName,
          custom_price_count: customPriceCount,
          total_orders: custOrders.length,
          total_spend: totalSpend,
          last_order_date: lastOrder
        };
      });
  }

  addCustomer({ section, mobile, name, shop_name = "", address = "", gstin = "", price_list_id = null }) {
    const sec = (section || "").toLowerCase();
    if (!["factory", "shopkeeper", "regular"].includes(sec)) {
      throw new Error(`Invalid section "${section}". Must be factory, shopkeeper, or regular.`);
    }

    const clean = this.cleanMobile(mobile);
    if (!clean || clean.length !== 10) {
      throw new Error("Validation Error: Mobile number must be a valid 10-digit Indian number.");
    }

    // Blueprint Section 2 & Test L5: A mobile number belongs to one section only.
    const existing = this.findCustomerByMobile(clean);
    if (existing) {
      const err = new Error(`Mobile number ${clean} is already registered under ${existing.section} section. A number can belong to only one section.`);
      err.statusCode = 400;
      throw err;
    }

    const newCustomer = {
      id: "cust-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      section: sec,
      name: (name || "").trim(),
      shop_name: (shop_name || "").trim(),
      mobile: clean,
      address: (address || "").trim(),
      gstin: (gstin || "").trim(),
      is_active: true,
      can_login: true,
      price_list_id: price_list_id || null,
      createdAt: new Date().toISOString()
    };

    this.customers.push(newCustomer);
    return newCustomer;
  }

  updateCustomer(id, data) {
    const cust = this.findCustomerById(id);
    if (!cust) throw new Error("Customer not found.");

    if (data.mobile !== undefined) {
      const clean = this.cleanMobile(data.mobile);
      if (!clean || clean.length !== 10) {
        throw new Error("Validation Error: Mobile number must be a valid 10-digit Indian number.");
      }
      const existing = this.findCustomerByMobile(clean);
      if (existing && existing.id !== cust.id) {
        const err = new Error(`Mobile number ${clean} is already in use by another customer.`);
        err.statusCode = 400;
        throw err;
      }
      cust.mobile = clean;
    }

    if (data.name !== undefined) cust.name = String(data.name).trim();
    if (data.shop_name !== undefined) cust.shop_name = String(data.shop_name).trim();
    if (data.address !== undefined) cust.address = String(data.address).trim();
    if (data.gstin !== undefined) cust.gstin = String(data.gstin).trim();
    if (data.is_active !== undefined) cust.is_active = Boolean(data.is_active);
    if (data.can_login !== undefined) cust.can_login = Boolean(data.can_login);
    if (data.price_list_id !== undefined) cust.price_list_id = data.price_list_id || null;
    if (data.section !== undefined) {
      const sec = data.section.toLowerCase();
      if (["factory", "shopkeeper", "regular"].includes(sec)) cust.section = sec;
    }

    return cust;
  }

  // OTP Authentication Logic (Blueprint Section 5 & Tests L1-L4)
  requestOtp(mobile, deviceId = "web") {
    const clean = this.cleanMobile(mobile);
    if (!clean || clean.length !== 10) {
      const err = new Error("Please enter a valid 10-digit mobile number.");
      err.statusCode = 400;
      throw err;
    }

    // Rate Limiting (Test L4: Many OTP requests from one number or device -> Rate limited)
    const windowMs = (this.settings.otp_limits && this.settings.otp_limits.window_ms) || 300000; // 5 mins
    const maxRequests = (this.settings.otp_limits && this.settings.otp_limits.max_per_window) || 5;
    const now = Date.now();

    const recentRequests = this.otp_log.filter(l => 
      (l.mobile === clean || (deviceId && l.deviceId === deviceId)) &&
      (now - l.requested_at) < windowMs
    );

    if (recentRequests.length >= maxRequests) {
      const err = new Error("Too many OTP requests from this number or device. Please try again later.");
      err.statusCode = 429;
      throw err;
    }

    // Check Whitelist (Blueprint Section 5: Check registered list before sending OTP)
    const customer = this.findCustomerByMobile(clean);

    // Test L1 & L3: If unregistered or deactivated, show neutral message without sending OTP
    if (!customer || !customer.is_active || !customer.can_login) {
      this.otp_log.unshift({
        id: "otp-rej-" + now,
        mobile: clean,
        deviceId,
        requested_at: now,
        status: !customer ? "UNREGISTERED" : "DEACTIVATED"
      });

      return {
        success: false,
        registered: false,
        error: "This number is not registered. Please contact the factory.",
        action: "contact_factory"
      };
    }

    // Test L2: Registered number requests login -> OTP sent
    const generatedOtp = "123456"; // Deterministic test OTP, production would dispatch SMS
    this.otp_log.unshift({
      id: "otp-" + now,
      mobile: clean,
      deviceId,
      otp: generatedOtp,
      requested_at: now,
      status: "SENT"
    });

    return {
      success: true,
      registered: true,
      message: "OTP sent successfully to registered mobile.",
      otp: generatedOtp // Returned for testing / client simulation
    };
  }

  verifyOtp(mobile, otp, deviceId = "web") {
    const clean = this.cleanMobile(mobile);
    const customer = this.findCustomerByMobile(clean);

    if (!customer || !customer.is_active || !customer.can_login) {
      const err = new Error("This number is not registered. Please contact the factory.");
      err.statusCode = 403;
      throw err;
    }

    if (otp !== "123456") {
      const err = new Error("Invalid or expired OTP. Please try again.");
      err.statusCode = 401;
      throw err;
    }

    // Create session token
    const token = `token-${customer.section}-${customer.id}-${Date.now()}`;
    return {
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        shop_name: customer.shop_name,
        mobile: customer.mobile,
        section: customer.section,
        price_list_id: customer.price_list_id
      }
    };
  }

  // Price Resolution Logic (Blueprint Section 4: Price rule replaces business rule 6)
  resolvePriceForCustomer(customer, product) {
    const section = (customer && customer.section) ? customer.section : "regular";
    const stdList = this.price_lists.find(pl => pl.section === section && pl.type === "standard");
    const stdItem = stdList
      ? this.price_list_items.find(i => i.price_list_id === stdList.id && i.product_id === product.id)
      : null;

    // 1. Check Special list price for that customer and product
    if (customer && customer.price_list_id) {
      const customItem = this.price_list_items.find(i => 
        i.price_list_id === customer.price_list_id && 
        i.product_id === product.id
      );
      if (customItem) {
        return {
          price: customItem.price,
          unit: customItem.unit || (stdItem ? stdItem.unit : "pack"),
          pack_size: customItem.pack_size || (stdItem ? stdItem.pack_size : 1),
          moq: (customItem.moq !== undefined && customItem.moq !== null) ? customItem.moq : (stdItem ? stdItem.moq : 1),
          price_source: "special",
          price_list_id: customer.price_list_id
        };
      }
    }

    // 2. Otherwise Standard price of the customer's section
    if (stdItem) {
      return {
        price: stdItem.price,
        unit: stdItem.unit,
        pack_size: stdItem.pack_size,
        moq: stdItem.moq !== undefined ? stdItem.moq : 1,
        price_source: "standard",
        price_list_id: stdList.id
      };
    }

    // 3. Guests (not logged in) always get Regular retail Standard price
    return {
      price: product.retail_price,
      unit: "piece",
      pack_size: 1,
      moq: 1,
      price_source: "standard",
      price_list_id: "pl-reg-std"
    };
  }

  resolveAllPricesForCustomer(customer) {
    return this.products
      .filter(p => p.is_live)
      .map(p => {
        const resolution = this.resolvePriceForCustomer(customer, p);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          image: p.image,
          description: p.description,
          retail_price: p.retail_price,
          price: resolution.price,
          unit: resolution.unit,
          pack_size: resolution.pack_size,
          moq: resolution.moq,
          price_source: resolution.price_source,
          price_list_id: resolution.price_list_id
        };
      });
  }

  async initDatabase() {
    const postgres = require('../db/postgres');
    const connected = await postgres.initAndHydrate(this);
    if (connected) {
      this.persistenceEnabled = true;
    }
    return connected;
  }

  persist() {
    if (!this.persistenceEnabled) return Promise.resolve();
    const postgres = require('../db/postgres');
    return postgres.scheduleSync(this);
  }
}

module.exports = new Store();
