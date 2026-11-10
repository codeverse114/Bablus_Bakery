/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE M5B
 * Blueprint Addendum: Standard & Special Price Lists, Price Resolution, MOQ & Price Log
 *
 * Tests Covered:
 * - PL1: Factory customer on Standard orders 100 buns -> ₹1,000 charged
 * - PL2: Another factory number on Special at ₹9/bun orders 100 buns -> ₹900 charged
 * - PL3: Owner changes a price -> Only new orders use it; old orders unchanged
 * - PL4: Remove a customer from Special -> Reverts to Standard prices
 * - PL5: Special has custom price for one product only -> Other products use Standard
 * - PL6: Change a price -> Log row with who, when, old and new
 * - PL7: MOQ override on a Special list -> Applies only to that customer
 * - PL8: Tamper with price in the request -> Server price used
 * - PL9: Cart open during a price change -> Re-checked at checkout with a notice
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-m5b-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = reqPath.startsWith('/') ? reqPath : '/' + reqPath;
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

async function loginCustomerOtp(mobile) {
  await request('POST', '/api/auth/otp/request', { mobile, deviceId: 'test-m5b' });
  const verRes = await request('POST', '/api/auth/otp/verify', { mobile, otp: '123456', deviceId: 'test-m5b' });
  assert.strictEqual(verRes.status, 200);
  return verRes.body.token;
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
  console.log(' RUNNING BACKREY BASES TEST SUITE: MILESTONE M5B ');
  console.log('====================================================\n');

  const ownerHeaders = { 'Authorization': 'Bearer adm-usr-owner-1' };

  // TEST PL1: Factory customer on Standard orders 100 buns -> ₹1,000 charged
  await test('PL1', 'Factory customer on Standard orders 100 buns (10 packs) -> ₹1,000 charged', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500001'); // cust-fac-std

    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }], // 10 packs of 10 buns = 100 buns
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': token });

    assert.strictEqual(chk.status, 200);
    assert.strictEqual(chk.body.summary.subtotal, 1000, '10 packs @ ₹100/pack = ₹1,000');
    assert.strictEqual(chk.body.summary.items[0].pieces, 100, 'Must convert to 100 pieces');
    assert.strictEqual(chk.body.summary.items[0].price_source, 'standard');

    const pay = await request('POST', '/api/payments/webhook', {
      reservationId: chk.body.reservationId,
      paymentId: 'pay_pl1_' + Date.now()
    });
    assert.strictEqual(pay.status, 200);
    assert.strictEqual(pay.body.order.grand_total, 1000);
  });

  // TEST PL2: Another factory number on Special at ₹9/bun orders 100 buns -> ₹900 charged
  await test('PL2', 'Another factory number on Special at ₹9/bun orders 100 buns -> ₹900 charged', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500002'); // cust-fac-spc (pl-fac-spc-1: ₹90/pack)

    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }],
      customer: { name: 'Factory Customer B', mobile: '9876500002', address: 'Bommasandra, Bengaluru' }
    }, { 'x-customer-token': token });

    assert.strictEqual(chk.status, 200);
    assert.strictEqual(chk.body.summary.subtotal, 900, '10 packs @ ₹90/pack = ₹900');
    assert.strictEqual(chk.body.summary.items[0].price_source, 'special');
  });

  // TEST PL3: Owner changes a price -> Only new orders use it; old orders unchanged
  await test('PL3', 'Owner changes a price -> Only new orders use it; old orders unchanged', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500001'); // cust-fac-std

    // Place Order 1 at ₹100/pack
    const chk1 = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }],
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': token });
    const pay1 = await request('POST', '/api/payments/webhook', {
      reservationId: chk1.body.reservationId,
      paymentId: 'pay_pl3_1_' + Date.now()
    });
    const order1No = pay1.body.order.orderNo;
    assert.strictEqual(pay1.body.order.grand_total, 1000);

    // Owner updates Standard factory bun price from ₹100 to ₹110
    const updRes = await request('PUT', '/api/admin/price-lists/pl-fac-std', {
      items: [{ product_id: 'p2', price: 110 }]
    }, ownerHeaders);
    assert.strictEqual(updRes.status, 200);

    // Past order 1 must stay ₹1,000
    const oldOrder = store.orders.find(o => o.orderNo === order1No);
    assert.strictEqual(oldOrder.grand_total, 1000, 'Old order total must remain ₹1,000');
    assert.strictEqual(oldOrder.items[0].unit_price, 100, 'Old order unit_price must remain ₹100');

    // Place Order 2 -> uses new price ₹110/pack = ₹1,100
    const chk2 = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }],
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': token });
    assert.strictEqual(chk2.status, 200);
    assert.strictEqual(chk2.body.summary.subtotal, 1100, 'New order must use new ₹110 price -> ₹1,100');
  });

  // TEST PL4: Remove a customer from Special -> Reverts to Standard prices
  await test('PL4', 'Remove a customer from Special -> Reverts to Standard prices', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500002'); // cust-fac-spc initially on pl-fac-spc-1 (₹90)

    // Verify initially ₹90
    const pBefore = await request('GET', '/api/prices', null, { 'x-customer-token': token });
    assert.strictEqual(pBefore.body.products.find(p => p.id === 'p2').price, 90);

    // Admin removes customer from Special list
    const patchRes = await request('PATCH', '/api/admin/customers/cust-fac-spc', {
      price_list_id: null
    }, ownerHeaders);
    assert.strictEqual(patchRes.status, 200);

    // Next price check / order reverts to Standard (₹100)
    const pAfter = await request('GET', '/api/prices', null, { 'x-customer-token': token });
    const bunAfter = pAfter.body.products.find(p => p.id === 'p2');
    assert.strictEqual(bunAfter.price, 100, 'Must revert to Factory Standard ₹100');
    assert.strictEqual(bunAfter.price_source, 'standard');
  });

  // TEST PL5: Special has custom price for one product only -> Other products use Standard
  await test('PL5', 'Special has custom price for one product only -> Other products use Standard', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500002'); // cust-fac-spc: pl-fac-spc-1 has p1, p2; NO p3

    const valRes = await request('POST', '/api/cart/validate', {
      items: [
        { id: 'p2', quantity: 10 }, // Custom Special ₹90
        { id: 'p3', quantity: 10 }  // Fallback to Factory Standard ₹80
      ]
    }, { 'x-customer-token': token });

    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valRes.body.is_valid, true);
    const bun = valRes.body.items.find(i => i.id === 'p2');
    const bread = valRes.body.items.find(i => i.id === 'p3');

    assert.strictEqual(bun.unit_price, 90);
    assert.strictEqual(bun.price_source, 'special');
    assert.strictEqual(bread.unit_price, 80, 'Product without custom price must fall back to Standard ₹80');
    assert.strictEqual(bread.price_source, 'standard');
  });

  // TEST PL6: Change a price -> Log row with who, when, old and new
  await test('PL6', 'Change a price -> Log row with who, when, old and new', async () => {
    store.reset();

    await request('PUT', '/api/admin/price-lists/pl-fac-std', {
      items: [{ product_id: 'p2', price: 105, moq: 12 }]
    }, ownerHeaders);

    const logRes = await request('GET', '/api/admin/price-log', null, ownerHeaders);
    assert.strictEqual(logRes.status, 200);
    assert.ok(logRes.body.log.length >= 1, 'Price change log must have an entry');

    const entry = logRes.body.log[0];
    assert.strictEqual(entry.admin_id, 'owner@backreybases.in');
    assert.ok(entry.created_at, 'Timestamp must be recorded');
    assert.strictEqual(entry.price_list_id, 'pl-fac-std');
    assert.strictEqual(entry.product_id, 'p2');
    assert.strictEqual(entry.old_price, 100);
    assert.strictEqual(entry.new_price, 105);
    assert.strictEqual(entry.old_moq, 10);
    assert.strictEqual(entry.new_moq, 12);
  });

  // TEST PL7: MOQ override on a Special list -> Applies only to that customer
  await test('PL7', 'MOQ override on a Special list -> Applies only to that customer', async () => {
    store.reset();

    // Override MOQ on Special list pl-fac-spc-1 for p2 to 15 packs (Standard stays 10)
    await request('PUT', '/api/admin/price-lists/pl-fac-spc-1', {
      items: [{ product_id: 'p2', moq: 15 }]
    }, ownerHeaders);

    const spcToken = await loginCustomerOtp('9876500002');
    const stdToken = await loginCustomerOtp('9876500001');

    // Special customer ordering 10 packs -> Blocked (needs 15)
    const spcVal = await request('POST', '/api/cart/validate', {
      items: [{ id: 'p2', quantity: 10 }]
    }, { 'x-customer-token': spcToken });
    assert.strictEqual(spcVal.body.is_valid, false, 'Special customer with MOQ 15 must be blocked at qty 10');

    // Standard customer ordering 10 packs -> Allowed (MOQ is still 10)
    const stdVal = await request('POST', '/api/cart/validate', {
      items: [{ id: 'p2', quantity: 10 }]
    }, { 'x-customer-token': stdToken });
    assert.strictEqual(stdVal.body.is_valid, true, 'Standard customer still has MOQ 10 and is allowed at qty 10');
  });

  // TEST PL8: Tamper with price in the request -> Server price used
  await test('PL8', 'Tamper with price in the request -> Server price used', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500001');

    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10, price: 1, unit_price: 1 }], // Malicious ₹1
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': token });

    assert.strictEqual(chk.status, 200);
    assert.strictEqual(chk.body.summary.subtotal, 1000, 'Server must charge ₹1,000, ignoring tampered ₹1');
    assert.strictEqual(chk.body.summary.items[0].unit_price, 100);
  });

  // TEST PL9: Cart open during a price change -> Re-checked at checkout with a notice
  await test('PL9', 'Cart open during a price change -> Re-checked at checkout with a notice', async () => {
    store.reset();
    const token = await loginCustomerOtp('9876500001');

    // Customer opened cart when p2 was ₹100
    const openCartItem = { id: 'p2', quantity: 10, price: 100 };

    // Owner increases price to ₹115 before customer clicks Checkout
    await request('PUT', '/api/admin/price-lists/pl-fac-std', {
      items: [{ product_id: 'p2', price: 115 }]
    }, ownerHeaders);

    // Checkout re-checks price and notifies customer
    const chk = await request('POST', '/api/checkout/start', {
      items: [openCartItem],
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': token });

    assert.strictEqual(chk.status, 200);
    assert.strictEqual(chk.body.price_changed, true, 'Checkout must detect price moved');
    assert.ok(Array.isArray(chk.body.notices) && chk.body.notices.length >= 1, 'Checkout must include price update notice');
    assert.ok(chk.body.notices[0].includes('100') && chk.body.notices[0].includes('115'), 'Notice must state old and new price');
    assert.strictEqual(chk.body.summary.subtotal, 1150, 'New total must reflect updated price ₹115 * 10 = ₹1,150');
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
