/**
 * Backrey Bases - In-Memory State & Store
 * Source of truth for Products, Stock, Reservations, Wholesalers, and Orders.
 */

class Store {
  constructor() {
    this.reset();
  }

  reset() {
    // Default Owner Settings
    this.settings = {
      default_low_stock_threshold: 20,
      delivery_charge: 0, // Configurable delivery fee
      delivery_charge_threshold: 500, // Free above this
      default_delivery_fee: 40,
      gst_enabled: false,
      gst_rate: 0
    };

    // Product Catalog
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
        description: "Our signature slow-fermented artisan sourdough pizza base. Pre-baked to perfection on stone decks with natural fermentation bubbles and an airy, light crust that crisps beautifully in any standard domestic or commercial oven."
      },
      {
        id: "p2",
        code: "BB-BRIOCHE-4",
        name: "Gourmet Brioche Burger Buns",
        category: "Burger bases",
        pack_size: "Pack of 4 buns",
        retail_price: 140,
        wholesale_price: 95,
        stock: 5, // Low stock test case (< 20)
        low_stock_threshold: 20,
        is_live: true,
        min_wholesale_qty: 15,
        image: "/images/brioche-burger-buns.jpg",
        tagline: "Golden glazed, pillowy soft with toasted sesame",
        description: "Crafted with pure butter and rich milk dough, then crowned with golden sesame seeds. Engineered for premium gourmet burgers: resilient enough to hold juicy patties without turning soggy."
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
        tagline: "Hearty golden crust with tender, tangy open crumb",
        description: "Traditional European-style country bread baked from stoneground flour and levain starter. Sliced for sandwich convenience, toasts with an intoxicating aroma."
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
        description: "Crispy, crackery thin Italian crust base infused with extra virgin olive oil and oregano. Ready to top and bake in just 5-7 minutes."
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
        description: "Draft product for testing offline filtering."
      }
    ];

    // Wholesalers registry
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
          "p1": 120 // special shopkeeper discount
        }
      }
    ];

    // Orders store with initial seeded past order for wh-1 (Bella Napoli Pizzeria)
    this.orders = [
      {
        orderNo: 'BB-900123',
        reservationId: 'RES-SEED-01',
        paymentId: 'pay_seed_01',
        wholesalerId: 'wh-1',
        customer: {
          name: 'Marco Rossi',
          mobile: '9876543210',
          email: 'marco@bellanapoli.in',
          address: 'Shop 14, High Street Mall, Indiranagar',
          state: 'Karnataka'
        },
        items: [
          {
            id: 'p1',
            code: 'PB-SOURDOUGH-10',
            name: 'Artisanal Sourdough Pizza Base (10")',
            pack_size: 'Pack of 2 bases',
            unit_price: 120,
            quantity: 10,
            total: 1200,
            image: '/images/sourdough-pizza-base.jpg'
          }
        ],
        subtotal: 1200,
        delivery_charge: 0,
        tax_gst: 0,
        grand_total: 1200,
        status: 'Paid',
        statusSteps: [
          { label: 'Paid', done: true, time: '10:00 AM' },
          { label: 'Packed', done: true },
          { label: 'Out for delivery', done: true },
          { label: 'Delivered', done: true }
        ],
        tag: 'Wholesale',
        createdAt: '2026-10-25T10:00:00.000Z',
        expectedDelivery: '2026-10-26'
      }
    ];

    // Active stock reservations: { [reservationId]: { id, items: [{ productId, qty }], expiresAt, orderNo, customer, status } }
    this.reservations = new Map();
    // Set of processed payment webhook IDs for idempotency (Test G7)
    this.processedPayments = new Set();
  }

  // Get currently reserved stock for a product across all active non-expired reservations
  getReservedStock(productId) {
    const now = Date.now();
    let reserved = 0;
    for (const res of this.reservations.values()) {
      if (res.status === 'HELD' && res.expiresAt > now) {
        const item = res.items.find(i => i.id === productId);
        if (item) {
          reserved += item.quantity;
        }
      }
    }
    return reserved;
  }

  // Clean up any reservations that have passed their 10-minute hold window (Test G6)
  cleanupExpiredReservations() {
    const now = Date.now();
    for (const [id, res] of this.reservations.entries()) {
      if (res.status === 'HELD' && res.expiresAt <= now) {
        res.status = 'EXPIRED';
      }
    }
  }

  // Stock badge calculation taking active holds into account
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

  getLiveProducts(user = null) {
    return this.products
      .filter(p => p.is_live === true)
      .map(p => {
        const stockInfo = this.getStockStatus(p);
        let effectivePrice = p.retail_price;
        let isWholesale = false;
        let moq = 1;

        if (user && user.is_wholesale) {
          isWholesale = true;
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
          min_quantity: moq,
          image: p.image,
          tagline: p.tagline,
          description: p.description
        };
      });
  }

  getProductById(id, user = null) {
    const product = this.products.find(p => p.id === id);
    if (!product || !product.is_live) return null;

    const stockInfo = this.getStockStatus(product);
    let effectivePrice = product.retail_price;
    let moq = 1;

    if (user && user.is_wholesale) {
      moq = product.min_wholesale_qty || 1;
      if (user.price_overrides && user.price_overrides[product.id]) {
        effectivePrice = user.price_overrides[product.id];
      } else {
        effectivePrice = product.wholesale_price;
      }
    }

    return {
      ...product,
      price: effectivePrice,
      stock_status: stockInfo.status,
      stock_code: stockInfo.code,
      can_add: stockInfo.can_add,
      min_quantity: moq
    };
  }

  // Validate cart against server truth (Blueprint Rule 1 & Rule 2)
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

      // Calculate server price (never trust client)
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

      // Quantity validations considering active hold reservations
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
      if (itemValid) {
        subtotal += itemTotal;
      }

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

    // Configurable delivery charge
    let deliveryCharge = 0;
    if (this.settings.delivery_charge > 0) {
      deliveryCharge = this.settings.delivery_charge;
    } else if (subtotal > 0 && subtotal < this.settings.delivery_charge_threshold) {
      deliveryCharge = this.settings.default_delivery_fee;
    }

    // GST is on hold as per Blueprint Section 10
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

  // Create 10-minute hold reservation (Blueprint 3.5 & Rule 3)
  createReservation({ items = [], customer = {}, user = null, inShop = false }) {
    this.cleanupExpiredReservations();

    // Check cart validity & stock reservation capacity atomically
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
    const holdDurationMs = 10 * 60 * 1000; // 10 minutes (600 seconds)
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
      holdSeconds: 600,
      status: 'HELD',
      createdAt: new Date().toISOString()
    };

    this.reservations.set(reservationId, reservation);

    return {
      success: true,
      reservationId,
      orderNo,
      expiresAt,
      holdSeconds: 600,
      summary: {
        items: validation.items,
        subtotal: validation.subtotal,
        delivery_charge: validation.delivery_charge,
        grand_total: validation.grand_total
      }
    };
  }

  // Cancel reservation and release stock immediately (Test G5)
  cancelReservation(reservationId) {
    const res = this.reservations.get(reservationId);
    if (res && res.status === 'HELD') {
      res.status = 'CANCELLED';
      return { success: true, message: 'Stock hold released.' };
    }
    return { success: false, error: 'Reservation not found or already closed.' };
  }

  // Confirm payment via webhook (Test G4, G5, G7, G9)
  confirmPayment({ reservationId, paymentId, paymentSignature, simulatedStatus = 'success' }) {
    this.cleanupExpiredReservations();

    // Idempotency Check (Test G7: Duplicate webhook -> One order only)
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
    if (!reservation) {
      return { success: false, error: 'Reservation not found.' };
    }

    // Payment failure simulation (Test G5)
    if (simulatedStatus === 'failure') {
      reservation.status = 'FAILED';
      return {
        success: false,
        status: 'FAILED',
        error: 'Payment was declined or cancelled. Stock hold released.'
      };
    }

    // Pending payment simulation (slow bank)
    if (simulatedStatus === 'pending') {
      reservation.status = 'PENDING';
      return {
        success: true,
        status: 'PENDING',
        message: 'Payment verification is pending from bank.'
      };
    }

    // Check expiration (Test G6)
    if (reservation.status === 'EXPIRED' || Date.now() > reservation.expiresAt) {
      reservation.status = 'EXPIRED';
      return {
        success: false,
        status: 'EXPIRED',
        error: 'Checkout session expired after 10 minutes. Please restart checkout.'
      };
    }

    if (reservation.status !== 'HELD') {
      return {
        success: false,
        error: `Reservation is in ${reservation.status} state and cannot be confirmed.`
      };
    }

    // Atomic permanent stock deduction (Test G4, G9)
    for (const item of reservation.items) {
      const product = this.products.find(p => p.id === item.id);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
      }
    }

    reservation.status = 'PAID';
    this.processedPayments.add(paymentId);

    const now = new Date();
    const order = {
      orderNo: reservation.orderNo,
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
      tag: reservation.user?.is_wholesale ? 'Wholesale' : (reservation.inShop ? 'In-shop' : 'Retail'),
      createdAt: now.toISOString(),
      expectedDelivery: 'Tomorrow by 6:00 PM'
    };

    this.orders.push(order);

    return {
      success: true,
      order
    };
  }

  // Retrieve order for guest tracking (Test G3 / Blueprint 3.7)
  getOrder(orderNo, phone = null) {
    const order = this.orders.find(o => o.orderNo === orderNo);
    if (!order) return null;

    if (phone && order.customer && order.customer.mobile) {
      const clean1 = phone.replace(/\D/g, '');
      const clean2 = order.customer.mobile.replace(/\D/g, '');
      if (clean1 !== clean2) {
        return { error: 'Phone number does not match order record.' };
      }
    }

    return order;
  }

  // Retrieve wholesale orders for a shopkeeper (Blueprint 3.9 & 3.11)
  getWholesaleOrders(wholesalerId) {
    return this.orders.filter(o => o.wholesalerId === wholesalerId);
  }

  // Refill cart from past order (Blueprint 3.9 & Test W7)
  reorderPastOrder(orderId, wholesalerId) {
    const order = this.orders.find(o => (o.orderNo === orderId || o.reservationId === orderId) && o.wholesalerId === wholesalerId);
    if (!order) {
      return { success: false, error: 'Order not found in your wholesale account.' };
    }

    // Verify each item's live status
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

    return {
      success: true,
      orderNo: order.orderNo,
      items: refillItems
    };
  }
}

module.exports = new Store();
