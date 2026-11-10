/**
 * BACKREY BASES - SUPABASE POSTGRESQL PERSISTENCE LAYER
 * Creates tables on boot, seeds initial data if empty, hydrates in-memory store,
 * and persists state mutations atomically in serialized transactions.
 */

const fs = require('fs');
const path = require('path');

let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch (e) {
  // pg not installed yet
}

let pool = null;
let syncQueue = Promise.resolve();
let isHydrating = false;

function isEnabled() {
  return Boolean(Pool && process.env.DATABASE_URL && process.env.DISABLE_DB !== 'true');
}

function getPool() {
  if (!isEnabled()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000
    });
    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err.message);
    });
  }
  return pool;
}

async function upsertAll(client, store) {
  // 1. Settings
  await client.query(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(store.settings)]
  );

  // 2. Admin Users
  for (const u of store.adminUsers) {
    await client.query(
      `INSERT INTO admin_users (id, email, name, role, password) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, password = EXCLUDED.password`,
      [u.id, u.email, u.name, u.role, u.password]
    );
  }

  // 3. Products
  if (store.products.length > 0) {
    await client.query('DELETE FROM products WHERE NOT (id = ANY($1::text[]))', [store.products.map(p => p.id)]);
  }
  for (const p of store.products) {
    await client.query(
      `INSERT INTO products (id, code, name, category, pack_size, retail_price, wholesale_price, stock, low_stock_threshold, is_live, min_wholesale_qty, image, tagline, description, hsn_code, gst_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         code=EXCLUDED.code, name=EXCLUDED.name, category=EXCLUDED.category, pack_size=EXCLUDED.pack_size,
         retail_price=EXCLUDED.retail_price, wholesale_price=EXCLUDED.wholesale_price, stock=EXCLUDED.stock,
         low_stock_threshold=EXCLUDED.low_stock_threshold, is_live=EXCLUDED.is_live, min_wholesale_qty=EXCLUDED.min_wholesale_qty,
         image=EXCLUDED.image, tagline=EXCLUDED.tagline, description=EXCLUDED.description, hsn_code=EXCLUDED.hsn_code, gst_rate=EXCLUDED.gst_rate`,
      [
        p.id, p.code || p.id, p.name, p.category, p.pack_size || 'Standard',
        Number(p.retail_price) || 0, Number(p.wholesale_price) || 0, parseInt(p.stock || 0, 10),
        parseInt(p.low_stock_threshold || 20, 10), p.is_live !== false, parseInt(p.min_wholesale_qty || 1, 10),
        p.image || '', p.tagline || '', p.description || '', p.hsn_code || '', Number(p.gst_rate || 0)
      ]
    );
  }

  // 4. Price Lists & Items
  for (const pl of store.price_lists) {
    await client.query(
      `INSERT INTO price_lists (id, section, name, type, is_active) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET section=EXCLUDED.section, name=EXCLUDED.name, type=EXCLUDED.type, is_active=EXCLUDED.is_active`,
      [pl.id, pl.section, pl.name, pl.type, pl.is_active !== false]
    );
  }

  for (const item of store.price_list_items) {
    await client.query(
      `INSERT INTO price_list_items (price_list_id, product_id, unit, pack_size, price, price_paise, moq)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (price_list_id, product_id) DO UPDATE SET
         unit=EXCLUDED.unit, pack_size=EXCLUDED.pack_size, price=EXCLUDED.price, price_paise=EXCLUDED.price_paise, moq=EXCLUDED.moq`,
      [
        item.price_list_id, item.product_id, item.unit || 'pack',
        parseInt(item.pack_size || 1, 10), Number(item.price || 0),
        parseInt(item.price_paise || Math.round((Number(item.price) || 0) * 100), 10),
        parseInt(item.moq || 1, 10)
      ]
    );
  }

  // 5. Customers
  for (const c of store.customers) {
    await client.query(
      `INSERT INTO customers (id, section, name, shop_name, mobile, email, address, state, gstin, is_active, can_login, price_list_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         section=EXCLUDED.section, name=EXCLUDED.name, shop_name=EXCLUDED.shop_name, mobile=EXCLUDED.mobile,
         email=EXCLUDED.email, address=EXCLUDED.address, state=EXCLUDED.state, gstin=EXCLUDED.gstin,
         is_active=EXCLUDED.is_active, can_login=EXCLUDED.can_login, price_list_id=EXCLUDED.price_list_id`,
      [
        c.id, c.section, c.name || '', c.shop_name || '', c.mobile, c.email || '',
        c.address || '', c.state || 'Karnataka', c.gstin || '', c.is_active !== false,
        c.can_login !== false, c.price_list_id || null, c.createdAt || new Date().toISOString()
      ]
    );
  }

  // 6. Stock Locations & Location Stock
  for (const loc of store.stock_locations) {
    await client.query(
      `INSERT INTO stock_locations (id, name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`,
      [loc.id, loc.name]
    );
  }

  for (const ls of store.location_stock) {
    await client.query(
      `INSERT INTO location_stock (location_id, product_id, qty) VALUES ($1,$2,$3)
       ON CONFLICT (location_id, product_id) DO UPDATE SET qty=EXCLUDED.qty`,
      [ls.location_id, ls.product_id, parseInt(ls.qty || 0, 10)]
    );
  }

  // 7. Wholesalers (legacy compatibility)
  for (const w of store.wholesalers) {
    await client.query(
      `INSERT INTO wholesalers (id, shop_name, owner_name, mobile, email, address, state, gstin, password, price_overrides_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         shop_name=EXCLUDED.shop_name, owner_name=EXCLUDED.owner_name, mobile=EXCLUDED.mobile, email=EXCLUDED.email,
         address=EXCLUDED.address, state=EXCLUDED.state, gstin=EXCLUDED.gstin, password=EXCLUDED.password,
         price_overrides_json=EXCLUDED.price_overrides_json`,
      [w.id, w.shop_name, w.owner_name, w.mobile, w.email, w.address || '', w.state || 'Karnataka', w.gstin || '', w.password, JSON.stringify(w.price_overrides || {})]
    );
  }

  // 8. Orders
  for (const o of store.orders) {
    await client.query(
      `INSERT INTO orders (order_no, invoice_no, reservation_id, payment_id, customer_id, wholesaler_id, section, price_list_id, stock_location_id, customer_json, items_json, subtotal, delivery_charge, tax_gst, grand_total, status, status_steps_json, channel, tag, payment_mode, internal_notes, expected_delivery, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23)
       ON CONFLICT (order_no) DO UPDATE SET
         status=EXCLUDED.status, status_steps_json=EXCLUDED.status_steps_json, internal_notes=EXCLUDED.internal_notes`,
      [
        o.orderNo, o.invoiceNo || null, o.reservationId || null, o.paymentId || null,
        o.customerId || null, o.wholesalerId || null, o.section || 'regular', o.price_list_id || null,
        o.stock_location_id || 'loc-shop', JSON.stringify(o.customer || {}), JSON.stringify(o.items || []),
        Number(o.subtotal || 0), Number(o.delivery_charge || 0), Number(o.tax_gst || 0), Number(o.grand_total || 0),
        o.status || 'Paid', JSON.stringify(o.statusSteps || []), o.channel || 'Online', o.tag || 'Retail',
        o.paymentMode || 'Online Gateway', o.internalNotes || '', o.expectedDelivery || '', o.createdAt || new Date().toISOString()
      ]
    );
  }

  // 9. Append-Only Logs (price_change_log, stock_transfers, inventory_log, otp_log)
  for (const pcl of store.price_change_log.slice(0, 100)) {
    await client.query(
      `INSERT INTO price_change_log (id, admin_id, section, list_name, price_list_id, product_id, old_price, new_price, old_moq, new_moq, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [pcl.id, pcl.admin_id, pcl.section || '', pcl.list_name || '', pcl.price_list_id, pcl.product_id, pcl.old_price, pcl.new_price, pcl.old_moq, pcl.new_moq, pcl.created_at]
    );
  }

  for (const tx of store.stock_transfers.slice(0, 100)) {
    await client.query(
      `INSERT INTO stock_transfers (id, from_location, to_location, product_id, qty, admin_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [tx.id, tx.from_location, tx.to_location, tx.product_id, parseInt(tx.qty, 10), tx.admin_id || 'Owner', tx.created_at]
    );
  }

  for (const il of store.inventoryLog.slice(0, 100)) {
    await client.query(
      `INSERT INTO inventory_log (id, product_id, product_name, type, quantity_change, previous_stock, new_stock, reason, order_no, user_name, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [il.id, il.productId, il.productName, il.type, il.quantityChange, il.previousStock, il.newStock, il.reason || '', il.orderNo || null, il.user || 'System', il.timestamp]
    );
  }

  for (const ol of store.otp_log.slice(0, 100)) {
    await client.query(
      `INSERT INTO otp_log (id, mobile, device_id, otp, requested_at, status)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [ol.id, ol.mobile, ol.deviceId || 'web', ol.otp || null, ol.requested_at, ol.status]
    );
  }
}

async function initAndHydrate(store) {
  const db = getPool();
  if (!db) {
    console.log('[DB] Running in memory-only mode (no DATABASE_URL or disabled).');
    return false;
  }

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.query(schemaSql);

  const countRes = await db.query('SELECT COUNT(*)::int AS cnt FROM products');
  if (countRes.rows[0].cnt === 0) {
    console.log('[DB] Empty PostgreSQL database detected — seeding initial Backrey Bases data...');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await upsertAll(client, store);
      await client.query('COMMIT');
      console.log('[DB] Initial seed complete.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return true;
  }

  // Hydrate store from persisted Supabase tables
  isHydrating = true;
  try {
    const [
      settingsRes, adminRes, prodRes, plRes, pliRes, custRes, pclRes,
      locRes, lsRes, txRes, ordRes, ilRes, otpRes, whRes
    ] = await Promise.all([
      db.query('SELECT data FROM settings WHERE id = 1'),
      db.query('SELECT * FROM admin_users'),
      db.query('SELECT * FROM products ORDER BY id ASC'),
      db.query('SELECT * FROM price_lists ORDER BY id ASC'),
      db.query('SELECT * FROM price_list_items'),
      db.query('SELECT * FROM customers ORDER BY created_at ASC'),
      db.query('SELECT * FROM price_change_log ORDER BY created_at DESC LIMIT 200'),
      db.query('SELECT * FROM stock_locations ORDER BY id ASC'),
      db.query('SELECT * FROM location_stock'),
      db.query('SELECT * FROM stock_transfers ORDER BY created_at DESC LIMIT 200'),
      db.query('SELECT * FROM orders ORDER BY created_at ASC'),
      db.query('SELECT * FROM inventory_log ORDER BY timestamp DESC LIMIT 200'),
      db.query('SELECT * FROM otp_log ORDER BY requested_at DESC LIMIT 200'),
      db.query('SELECT * FROM wholesalers ORDER BY id ASC')
    ]);

    if (settingsRes.rows.length) {
      store.settings = { ...store.settings, ...settingsRes.rows[0].data };
    }
    if (adminRes.rows.length) {
      store.adminUsers = adminRes.rows;
    }
    if (prodRes.rows.length) {
      store.products = prodRes.rows.map(r => ({
        ...r,
        retail_price: Number(r.retail_price),
        wholesale_price: Number(r.wholesale_price),
        gst_rate: Number(r.gst_rate)
      }));
    }
    if (plRes.rows.length) store.price_lists = plRes.rows;
    if (pliRes.rows.length) {
      store.price_list_items = pliRes.rows.map(r => ({ ...r, price: Number(r.price) }));
    }
    if (custRes.rows.length) {
      store.customers = custRes.rows.map(r => ({
        ...r,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
      }));
    }
    store.price_change_log = pclRes.rows.map(r => ({
      ...r,
      old_price: r.old_price !== null ? Number(r.old_price) : null,
      new_price: r.new_price !== null ? Number(r.new_price) : null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
    }));
    if (locRes.rows.length) store.stock_locations = locRes.rows;
    if (lsRes.rows.length) store.location_stock = lsRes.rows;
    store.stock_transfers = txRes.rows.map(r => ({
      ...r,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
    }));
    if (ordRes.rows.length) {
      store.orders = ordRes.rows.map(r => ({
        orderNo: r.order_no,
        invoiceNo: r.invoice_no,
        reservationId: r.reservation_id,
        paymentId: r.payment_id,
        customerId: r.customer_id,
        wholesalerId: r.wholesaler_id,
        section: r.section,
        price_list_id: r.price_list_id,
        stock_location_id: r.stock_location_id,
        customer: r.customer_json,
        items: r.items_json,
        subtotal: Number(r.subtotal),
        delivery_charge: Number(r.delivery_charge),
        tax_gst: Number(r.tax_gst),
        grand_total: Number(r.grand_total),
        status: r.status,
        statusSteps: r.status_steps_json,
        channel: r.channel,
        tag: r.tag,
        paymentMode: r.payment_mode,
        internalNotes: r.internal_notes,
        expectedDelivery: r.expected_delivery,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
      }));
    }
    store.inventoryLog = ilRes.rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      type: r.type,
      quantityChange: r.quantity_change,
      previousStock: r.previous_stock,
      newStock: r.new_stock,
      reason: r.reason,
      orderNo: r.order_no,
      user: r.user_name,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp
    }));
    store.otp_log = otpRes.rows.map(r => ({
      id: r.id,
      mobile: r.mobile,
      deviceId: r.device_id,
      otp: r.otp,
      requested_at: Number(r.requested_at),
      status: r.status
    }));
    if (whRes.rows.length) {
      store.wholesalers = whRes.rows.map(r => ({
        ...r,
        price_overrides: r.price_overrides_json || {}
      }));
    }

    console.log(`[DB] Connected to Supabase PostgreSQL (${store.products.length} products, ${store.customers.length} customers, ${store.orders.length} orders loaded).`);
    return true;
  } finally {
    isHydrating = false;
  }
}

function scheduleSync(store) {
  if (!isEnabled() || isHydrating) return Promise.resolve();
  syncQueue = syncQueue.then(async () => {
    const db = getPool();
    if (!db) return;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await upsertAll(client, store);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[DB Sync Error]', err.message);
    } finally {
      client.release();
    }
  });
  return syncQueue;
}

module.exports = {
  isEnabled,
  getPool,
  initAndHydrate,
  scheduleSync
};
