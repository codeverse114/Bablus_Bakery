/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE M5C
 * Blueprint Addendum: Factory & Shopkeeper Ordering Portal using Resolved Prices & Re-Order
 *
 * Tests Covered (re-verified with Addendum rules):
 * - W3: Compare guest and Factory/Shopkeeper price -> Sees resolved section/special price
 * - W5: Order below minimum MOQ -> Blocked
 * - W7: Re-order past order -> Cart refilled with resolved prices
 * - W8: Customer/Shopkeeper opens admin URL (/admin or /api/admin/*) -> Denied (403 Forbidden)
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-m5c-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
  await request('POST', '/api/auth/otp/request', { mobile, deviceId: 'test-m5c' });
  const verRes = await request('POST', '/api/auth/otp/verify', { mobile, otp: '123456', deviceId: 'test-m5c' });
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
  console.log(' RUNNING BACKREY BASES TEST SUITE: MILESTONE M5C ');
  console.log('====================================================\n');

  // TEST W3: Compare guest and Factory/Shopkeeper resolved price
  await test('W3', 'Compare guest and Shopkeeper/Factory price -> Sees resolved section/special price', async () => {
    store.reset();

    // 1. Guest sees retail price for p1 (₹180)
    const guestRes = await request('GET', '/api/products/p1');
    assert.strictEqual(guestRes.status, 200);
    assert.strictEqual(guestRes.body.product.price, 180);

    // 2. Shopkeeper on Special (cust-shp-1: Bella Napoli) sees ₹120 pack price
    const shpToken = await loginCustomerOtp('9876543210');
    const shpRes = await request('GET', '/api/products/p1', null, { 'x-customer-token': shpToken });
    assert.strictEqual(shpRes.status, 200);
    assert.strictEqual(shpRes.body.product.price, 120);
    assert.strictEqual(shpRes.body.product.price_source, 'special');

    // 3. Factory Standard customer (cust-fac-std) sees ₹130 pack price for p1
    const facToken = await loginCustomerOtp('9876500001');
    const facRes = await request('GET', '/api/products/p1', null, { 'x-customer-token': facToken });
    assert.strictEqual(facRes.status, 200);
    assert.strictEqual(facRes.body.product.price, 130);
    assert.strictEqual(facRes.body.product.price_source, 'standard');
  });

  // TEST W5: Order below minimum MOQ -> Blocked
  await test('W5', 'Order below minimum MOQ -> Blocked', async () => {
    store.reset();
    const facToken = await loginCustomerOtp('9876500001'); // Factory MOQ for p2 is 10 packs

    const valRes = await request('POST', '/api/cart/validate', {
      items: [{ id: 'p2', quantity: 4 }]
    }, { 'x-customer-token': facToken });

    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valRes.body.is_valid, false, 'Below MOQ must be blocked');
    const p2Val = valRes.body.items.find(i => i.id === 'p2');
    assert.strictEqual(p2Val.is_valid, false);
    assert.ok(p2Val.error.includes('Minimum order quantity'), `Expected MOQ error, got: ${p2Val.error}`);
  });

  // TEST W7: Re-order -> Cart refilled with resolved prices
  await test('W7', 'Re-order past order -> Cart refilled with current resolved prices', async () => {
    store.reset();
    const facToken = await loginCustomerOtp('9876500001');

    // Place an order as Factory Customer A
    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }],
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': facToken });
    const pay = await request('POST', '/api/payments/webhook', {
      reservationId: chk.body.reservationId,
      paymentId: 'pay_w7_' + Date.now()
    });
    const orderNo = pay.body.order.orderNo;

    // Reorder via section customer endpoint
    const reorderRes = await request('POST', `/api/orders/${orderNo}/reorder`, null, { 'x-customer-token': facToken });
    assert.strictEqual(reorderRes.status, 200);
    assert.strictEqual(reorderRes.body.success, true);
    assert.strictEqual(reorderRes.body.orderNo, orderNo);
    assert.strictEqual(reorderRes.body.items.length, 1);
    assert.strictEqual(reorderRes.body.items[0].id, 'p2');
    assert.strictEqual(reorderRes.body.items[0].quantity, 10);
    assert.strictEqual(reorderRes.body.items[0].price, 100);
  });

  // TEST W8: Customer/Shopkeeper opens admin URL -> Denied (403)
  await test('W8', 'Customer/Shopkeeper opens admin URL -> Denied (403)', async () => {
    store.reset();
    const facToken = await loginCustomerOtp('9876500001');

    const adminPageRes = await request('GET', '/admin', null, { 'x-customer-token': facToken });
    assert.strictEqual(adminPageRes.status, 403, 'Opening /admin with customer token must return 403');

    const adminApiRes = await request('GET', '/api/admin/dashboard', null, { 'Authorization': `Bearer ${facToken}` });
    assert.strictEqual(adminApiRes.status, 403, 'Calling /api/admin/* with customer token must return 403');
  });

  // Bonus verify Addendum Section 11: Old POST /api/wholesale/register is removed
  await test('W-REG-REMOVED', 'Public POST /api/wholesale/register is removed (410 Gone)', async () => {
    store.reset();
    const regRes = await request('POST', '/api/wholesale/register', {
      shop_name: 'Unauthorized',
      owner_name: 'Hacker',
      mobile: '9999988888',
      email: 'test@test.in',
      password: 'pass'
    });
    assert.strictEqual(regRes.status, 410, 'Public wholesale sign-up must be removed (410)');
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
