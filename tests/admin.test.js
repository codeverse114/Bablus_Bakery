/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR ADMIN OPERATIONS
 * Tests: A1, A2, A3, A4, A5, A6, A7, A8, A9, O1, O2, Q3, W4, X2, X7
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-admin-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith('/') ? path : '/' + path;
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (body) {
      reqBody = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request({
      socketPath: PIPE_NAME,
      path: fullPath,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function test(id, description, fn) {
  try {
    await fn();
    console.log(`  [PASS] Test ${id}: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] Test ${id}: ${description}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n====================================================');
  console.log(' RUNNING BACKREY BASES ADMIN OPERATIONS TEST SUITE');
  console.log('====================================================\n');

  const ownerToken = 'adm-usr-owner-1';
  const staffToken = 'adm-usr-staff-1';
  const ownerHeaders = { 'Authorization': `Bearer ${ownerToken}` };
  const staffHeaders = { 'Authorization': `Bearer ${staffToken}` };

  // TEST X2: Call admin APIs without login -> 401 Unauthorized
  await test('X2', 'Call admin APIs without login -> 401 Unauthorized', async () => {
    store.reset();
    const res = await request('GET', '/api/admin/dashboard');
    assert.strictEqual(res.status, 401, 'Unauthenticated admin request must return 401');
    assert.strictEqual(res.body.success, false);
  });

  // TEST A9: Wrong password 5 times -> Account temporarily locked
  await test('A9', 'Attempt wrong password 5 times -> Account temporarily locked (429)', async () => {
    store.reset();
    const email = 'owner@backreybases.in';

    // 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      const res = await request('POST', '/api/admin/login', { email, password: 'wrongpassword' });
      assert.strictEqual(res.status, 401, `Attempt ${i} should be 401`);
    }

    // 5th wrong attempt triggers lock
    const res5 = await request('POST', '/api/admin/login', { email, password: 'wrongpassword' });
    assert.strictEqual(res5.status, 429, '5th wrong attempt must trigger 429 rate limit lock');
    assert.ok(res5.body.error.includes('temporarily locked'));

    // Even right password during lock is rejected
    const resLock = await request('POST', '/api/admin/login', { email, password: 'adminpassword123' });
    assert.strictEqual(resLock.status, 429);
  });

  // TEST A1: Add then edit product -> Updates reflected on storefront
  await test('A1', 'Add then edit product -> Updates storefront', async () => {
    store.reset();

    // 1. Owner adds new product
    const newProductPayload = {
      name: 'Semolina Focaccia Base',
      code: 'FC-SEMOLINA-1',
      category: 'Bread',
      pack_size: 'Pack of 2',
      retail_price: 210,
      wholesale_price: 155,
      stock: 40,
      min_wholesale_qty: 6,
      image: '/images/farmhouse-bread.jpg',
      description: 'Golden semolina dimpled crust with sea salt and rosemary'
    };

    const createRes = await request('POST', '/api/admin/products', newProductPayload, ownerHeaders);
    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.success, true);
    const createdId = createRes.body.product.id;

    // Verify it appears on storefront /api/products
    const sfRes1 = await request('GET', `/api/products/${createdId}`);
    assert.strictEqual(sfRes1.status, 200);
    assert.strictEqual(sfRes1.body.product.name, 'Semolina Focaccia Base');
    assert.strictEqual(sfRes1.body.product.retail_price, 210);

    // 2. Edit price to 230
    const updateRes = await request('PUT', `/api/admin/products/${createdId}`, {
      ...newProductPayload,
      retail_price: 230
    }, ownerHeaders);
    assert.strictEqual(updateRes.status, 200);

    // Verify updated on storefront
    const sfRes2 = await request('GET', `/api/products/${createdId}`);
    assert.strictEqual(sfRes2.status, 200);
    assert.strictEqual(sfRes2.body.product.retail_price, 230);
  });

  // TEST A2: Toggle Live to Offline -> Product disappears from storefront
  await test('A2', 'Toggle Live to Offline -> Product disappears from storefront', async () => {
    store.reset();

    // p1 is initially live
    const sfBefore = await request('GET', '/api/products/p1');
    assert.strictEqual(sfBefore.status, 200);

    // Toggle p1 to offline
    const toggleRes = await request('PATCH', '/api/admin/products/p1/status', { is_live: false }, ownerHeaders);
    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.body.product.is_live, false);

    // Storefront request now returns 404 (offline)
    const sfAfter = await request('GET', '/api/products/p1');
    assert.strictEqual(sfAfter.status, 404, 'Offline product must not be accessible on storefront');

    // Toggle back to live
    await request('PATCH', '/api/admin/products/p1/status', { is_live: true }, ownerHeaders);
  });

  // TEST A3: Set opening stock to 500
  await test('A3', 'Set opening stock to 500', async () => {
    store.reset();

    const res = await request('POST', '/api/admin/inventory/opening', {
      productId: 'p1',
      quantity: 500
    }, ownerHeaders);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.product.stock, 500);

    // Verify storefront shows 500
    const sf = await request('GET', '/api/products/p1');
    assert.strictEqual(sf.body.product.stock, 500);
  });

  // TEST A4: Customer buys 250 -> shows 250
  await test('A4', 'Customer buys 250 -> shows 250', async () => {
    // p1 stock was 500 from A3
    // Customer reserves and completes payment for 250 units
    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p1', quantity: 250 }],
      customer: {
        name: 'Hotel Grand Bangalore',
        mobile: '9876543210',
        address: 'MG Road, Bengaluru'
      }
    });

    assert.strictEqual(holdRes.status, 200);
    const reservationId = holdRes.body.reservationId;

    // Complete payment
    const payRes = await request('POST', '/api/payments/webhook', {
      reservationId,
      simulatedStatus: 'success'
    });
    assert.strictEqual(payRes.status, 200);

    // Admin inventory reflects 500 - 250 = 250
    const invRes = await request('GET', '/api/admin/inventory', null, staffHeaders);
    const p1Inv = invRes.body.inventory.find(i => i.id === 'p1');
    assert.strictEqual(p1Inv.stock, 250);
  });

  // TEST A5: Restock +200 -> shows 450, log row written
  await test('A5', 'Restock +200 -> shows 450, log row written', async () => {
    const restockRes = await request('POST', '/api/admin/inventory/restock', {
      productId: 'p1',
      quantity: 200,
      notes: 'Fresh afternoon stone-deck batch'
    }, staffHeaders);

    assert.strictEqual(restockRes.status, 200);
    assert.strictEqual(restockRes.body.product.stock, 450);

    // Audit log check
    const logRes = await request('GET', '/api/admin/inventory/log?productId=p1', null, staffHeaders);
    assert.strictEqual(logRes.status, 200);
    const latestLog = logRes.body.logs[0];
    assert.strictEqual(latestLog.type, 'RESTOCK');
    assert.strictEqual(latestLog.quantityChange, 200);
    assert.strictEqual(latestLog.newStock, 450);
  });

  // TEST A6: Manual correction with mandatory reason
  await test('A6', 'Manual correction with mandatory reason logged', async () => {
    // 1. Without reason -> 400 Bad Request
    const noReasonRes = await request('POST', '/api/admin/inventory/adjust', {
      productId: 'p1',
      newStock: 440,
      reason: ''
    }, staffHeaders);
    assert.strictEqual(noReasonRes.status, 400, 'Correction without reason must be rejected');

    // 2. With valid reason
    const adjustRes = await request('POST', '/api/admin/inventory/adjust', {
      productId: 'p1',
      newStock: 440,
      reason: '10 crusts damaged during cooling rack handling'
    }, staffHeaders);

    assert.strictEqual(adjustRes.status, 200);
    assert.strictEqual(adjustRes.body.product.stock, 440);

    // Verify log entry
    const logRes = await request('GET', '/api/admin/inventory/log?productId=p1', null, staffHeaders);
    const log = logRes.body.logs[0];
    assert.strictEqual(log.type, 'MANUAL_ADJUSTMENT');
    assert.strictEqual(log.newStock, 440);
    assert.ok(log.reason.includes('cooling rack handling'));
  });

  // TEST A7: Sell last unit -> shows Out of stock
  await test('A7', 'Sell last unit -> shows Out of stock', async () => {
    // Set stock of p2 to 1
    await request('POST', '/api/test/set-stock', { productId: 'p2', stock: 1 });

    // Customer buys 1 unit
    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 1 }],
      customer: { name: 'Burger Club', mobile: '9123456789', address: 'Indiranagar' }
    });
    assert.strictEqual(holdRes.status, 200);

    await request('POST', '/api/payments/webhook', {
      reservationId: holdRes.body.reservationId,
      simulatedStatus: 'success'
    });

    // Verify storefront product shows 0 stock and is_in_stock: false
    const sfRes = await request('GET', '/api/products/p2');
    assert.strictEqual(sfRes.body.product.stock, 0);
    assert.strictEqual(sfRes.body.product.is_in_stock, false);

    // Subsequent buy attempt fails
    const failBuy = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 1 }],
      customer: { name: 'Late Buyer', mobile: '9123456780', address: 'Koramangala' }
    });
    assert.strictEqual(failBuy.status, 400);
  });

  // TEST A8: Stock log reflects every change
  await test('A8', 'Stock log reflects every change', async () => {
    const logRes = await request('GET', '/api/admin/inventory/log', null, ownerHeaders);
    assert.strictEqual(logRes.status, 200);
    assert.ok(Array.isArray(logRes.body.logs));
    assert.ok(logRes.body.logs.length >= 3, 'Log must contain audit history');

    // Verify required audit fields
    for (const entry of logRes.body.logs) {
      assert.ok(entry.id);
      assert.ok(entry.productId);
      assert.ok(entry.type);
      assert.ok(typeof entry.quantityChange === 'number');
      assert.ok(typeof entry.previousStock === 'number');
      assert.ok(typeof entry.newStock === 'number');
      assert.ok(entry.timestamp);
    }
  });

  // TEST O1: Guest and wholesale orders listed
  await test('O1', 'Guest and wholesale orders listed', async () => {
    const ordersRes = await request('GET', '/api/admin/orders', null, staffHeaders);
    assert.strictEqual(ordersRes.status, 200);
    assert.ok(Array.isArray(ordersRes.body.orders));

    // Has seeded wholesale order BB-900123
    const seededWholesale = ordersRes.body.orders.find(o => o.orderNo === 'BB-900123');
    assert.ok(seededWholesale, 'Seeded wholesale order must be present');
    assert.strictEqual(seededWholesale.wholesalerId, 'wh-1');
  });

  // TEST O2: Update status to Packed then Delivered reflected in tracking
  await test('O2', 'Update status to Packed then Delivered reflected in tracking', async () => {
    store.reset();

    // Place an order
    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p3', quantity: 2 }],
      customer: { name: 'Rahul Sharma', mobile: '9888877777', address: 'Whitefield' }
    });
    const payRes = await request('POST', '/api/payments/webhook', {
      reservationId: holdRes.body.reservationId,
      simulatedStatus: 'success'
    });
    const orderNo = payRes.body.orderNo;

    // 1. Initial status is Paid
    let trackRes = await request('GET', `/api/orders/${orderNo}?phone=9888877777`);
    assert.strictEqual(trackRes.body.order.status, 'Paid');

    // 2. Staff updates status to Packed
    const packRes = await request('PATCH', `/api/admin/orders/${orderNo}/status`, { status: 'Packed' }, staffHeaders);
    assert.strictEqual(packRes.status, 200);

    trackRes = await request('GET', `/api/orders/${orderNo}?phone=9888877777`);
    assert.strictEqual(trackRes.body.order.status, 'Packed');

    // 3. Staff updates status to Delivered
    const delivRes = await request('PATCH', `/api/admin/orders/${orderNo}/status`, { status: 'Delivered' }, staffHeaders);
    assert.strictEqual(delivRes.status, 200);

    trackRes = await request('GET', `/api/orders/${orderNo}?phone=9888877777`);
    assert.strictEqual(trackRes.body.order.status, 'Delivered');
  });

  // TEST Q3: Record walk-in sale -> stock reduced, invoice generated, tagged In-shop
  await test('Q3', 'Record walk-in sale -> stock reduced, invoice generated, tagged In-shop', async () => {
    store.reset();
    const prevStock = store.products.find(p => p.id === 'p1').stock;

    // POS Walk-in Sale of 5 units of p1
    const posRes = await request('POST', '/api/admin/orders/offline', {
      items: [{ productId: 'p1', quantity: 5 }],
      customer: { name: 'Walk-in Chef', mobile: '8219775396' },
      paymentMode: 'Cash'
    }, staffHeaders);

    assert.strictEqual(posRes.status, 200);
    assert.strictEqual(posRes.body.success, true);
    const posOrder = posRes.body.order;

    // Tagged In-shop
    assert.strictEqual(posOrder.tag, 'In-shop');
    assert.strictEqual(posOrder.channel, 'In-shop');
    assert.strictEqual(posOrder.status, 'Delivered');

    // Stock decremented by 5
    const newStock = store.products.find(p => p.id === 'p1').stock;
    assert.strictEqual(newStock, prevStock - 5);

    // Tax invoice can be downloaded
    const invRes = await request('GET', `/api/invoices/${posOrder.orderNo}`);
    assert.strictEqual(invRes.status, 200);
    assert.strictEqual(invRes.headers['content-type'], 'application/pdf');
  });

  // TEST W4: Set per-shopkeeper price override
  await test('W4', 'Set per-shopkeeper price override', async () => {
    store.reset();

    // Base wholesale price of p1 is 130
    assert.strictEqual(store.products.find(p => p.id === 'p1').wholesale_price, 130);

    // Owner gives wh-1 special custom rate of 115
    const overrideRes = await request('POST', '/api/admin/wholesale/price-override', {
      wholesalerId: 'wh-1',
      productId: 'p1',
      overridePrice: 115
    }, ownerHeaders);

    assert.strictEqual(overrideRes.status, 200);
    assert.strictEqual(overrideRes.body.wholesaler.price_overrides['p1'], 115);

    // When wh-1 queries products, price is 115
    const whRes = await request('GET', '/api/products/p1', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(whRes.body.product.price, 115);

    // Other wholesaler (wh-2) sees standard wholesale price 130
    const wh2Res = await request('GET', '/api/products/p1', null, { 'x-wholesale-token': 'wh-2' });
    assert.strictEqual(wh2Res.body.product.price, 130);
  });

  // TEST X7: Staff tries to open reports/settings/wholesale-prices -> Denied 403
  await test('X7', 'Staff tries to open reports/settings/wholesale-prices -> Denied 403', async () => {
    // 1. Reports
    const repRes = await request('GET', '/api/admin/reports', null, staffHeaders);
    assert.strictEqual(repRes.status, 403, 'Staff must be denied access to reports');

    // 2. Settings
    const setRes = await request('GET', '/api/admin/settings', null, staffHeaders);
    assert.strictEqual(setRes.status, 403, 'Staff must be denied access to settings');

    // 3. Wholesale price override
    const priceRes = await request('POST', '/api/admin/wholesale/price-override', {
      wholesalerId: 'wh-1',
      productId: 'p1',
      overridePrice: 99
    }, staffHeaders);
    assert.strictEqual(priceRes.status, 403, 'Staff must be denied access to price overrides');

    // 4. Staff management
    const staffRes = await request('GET', '/api/admin/staff', null, staffHeaders);
    assert.strictEqual(staffRes.status, 403, 'Staff must be denied access to staff accounts');
  });

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

server = app.listen(PIPE_NAME, async () => {
  try {
    await runTests();
  } catch (e) {
    console.error('Fatal test error:', e);
    process.exit(1);
  } finally {
    server.close();
  }
});
