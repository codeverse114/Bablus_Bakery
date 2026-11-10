/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE M5D
 * Blueprint Addendum: Dual Stock Locations (Factory & Shop) and Transfers
 *
 * Tests Covered:
 * - IN1: Transfer 200 of 500 to Shop -> Factory 300, Shop 200, logged
 * - IN2: Factory order of 100 -> Factory stock reduces
 * - IN3: Regular shop order -> Shop stock reduces
 * - IN4: Transfer more than available -> Blocked
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-m5d-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
  await request('POST', '/api/auth/otp/request', { mobile, deviceId: 'test-m5d' });
  const verRes = await request('POST', '/api/auth/otp/verify', { mobile, otp: '123456', deviceId: 'test-m5d' });
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
  console.log(' RUNNING BACKREY BASES TEST SUITE: MILESTONE M5D ');
  console.log('====================================================\n');

  const ownerHeaders = { 'Authorization': 'Bearer adm-usr-owner-1' };

  // TEST IN1: Transfer 200 of 500 to Shop -> Factory 300, Shop 200, logged
  await test('IN1', 'Transfer 200 of 500 to Shop -> Factory 300, Shop 200, logged', async () => {
    store.reset();

    // Initial batch: 500 at Factory, 0 at Shop for p2
    store.setLocationStock('loc-factory', 'p2', 500);
    store.setLocationStock('loc-shop', 'p2', 0);

    const txRes = await request('POST', '/api/admin/stock/transfer', {
      from_location: 'loc-factory',
      to_location: 'loc-shop',
      product_id: 'p2',
      qty: 200
    }, ownerHeaders);

    assert.strictEqual(txRes.status, 200);
    assert.strictEqual(txRes.body.success, true);
    assert.strictEqual(txRes.body.source_stock, 300, 'Factory stock must become 300');
    assert.strictEqual(txRes.body.destination_stock, 200, 'Shop stock must become 200');
    assert.strictEqual(store.getLocationStock('loc-factory', 'p2'), 300);
    assert.strictEqual(store.getLocationStock('loc-shop', 'p2'), 200);

    // Transfer is logged
    const logsRes = await request('GET', '/api/admin/stock/transfers', null, ownerHeaders);
    assert.strictEqual(logsRes.status, 200);
    assert.ok(logsRes.body.transfers.length >= 1);
    assert.strictEqual(logsRes.body.transfers[0].qty, 200);
    assert.strictEqual(logsRes.body.transfers[0].from_location, 'loc-factory');
    assert.strictEqual(logsRes.body.transfers[0].to_location, 'loc-shop');
  });

  // TEST IN2: Factory order of 100 -> Factory stock reduces
  await test('IN2', 'Factory order of 100 buns (10 packs) -> Factory stock reduces (300 -> 200)', async () => {
    // Continuing from seed/previous state (Factory 300, Shop 200)
    const facBefore = store.getLocationStock('loc-factory', 'p2');
    const shopBefore = store.getLocationStock('loc-shop', 'p2');
    assert.strictEqual(facBefore, 300);
    assert.strictEqual(shopBefore, 200);

    const facToken = await loginCustomerOtp('9876500001'); // Factory customer
    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 10 }], // 10 packs = 100 buns
      customer: { name: 'Factory Customer A', mobile: '9876500001', address: 'Peenya, Bengaluru' }
    }, { 'x-customer-token': facToken });
    assert.strictEqual(chk.status, 200);

    const pay = await request('POST', '/api/payments/webhook', {
      reservationId: chk.body.reservationId,
      paymentId: 'pay_in2_' + Date.now()
    });
    assert.strictEqual(pay.status, 200);

    assert.strictEqual(store.getLocationStock('loc-factory', 'p2'), 200, 'Factory stock must decrease by 100 pieces');
    assert.strictEqual(store.getLocationStock('loc-shop', 'p2'), 200, 'Shop stock must remain untouched at 200');
  });

  // TEST IN3: Regular shop order -> Shop stock reduces
  await test('IN3', 'Regular shop order of 15 buns -> Shop stock reduces (200 -> 185)', async () => {
    const facBefore = store.getLocationStock('loc-factory', 'p2');
    const shopBefore = store.getLocationStock('loc-shop', 'p2');

    // Guest checkout in Regular section
    const chk = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 15 }], // 15 pieces
      customer: { name: 'Walk-in Online Buyer', mobile: '9111122222', address: 'Indiranagar' }
    });
    assert.strictEqual(chk.status, 200);

    const pay = await request('POST', '/api/payments/webhook', {
      reservationId: chk.body.reservationId,
      paymentId: 'pay_in3_' + Date.now()
    });
    assert.strictEqual(pay.status, 200);

    assert.strictEqual(store.getLocationStock('loc-shop', 'p2'), shopBefore - 15, 'Shop stock must reduce by 15');
    assert.strictEqual(store.getLocationStock('loc-factory', 'p2'), facBefore, 'Factory stock must remain unchanged');
  });

  // TEST IN4: Transfer more than available -> Blocked
  await test('IN4', 'Transfer more than available -> Blocked (400)', async () => {
    const availFactory = store.getLocationStock('loc-factory', 'p2'); // 200

    const txRes = await request('POST', '/api/admin/stock/transfer', {
      from_location: 'loc-factory',
      to_location: 'loc-shop',
      product_id: 'p2',
      qty: availFactory + 50 // Try transferring 250 when only 200 available
    }, ownerHeaders);

    assert.strictEqual(txRes.status, 400, 'Transfer exceeding available stock must be rejected (400)');
    assert.strictEqual(txRes.body.success, false);
    assert.ok(txRes.body.error.includes('exceeds available stock'));
    assert.strictEqual(store.getLocationStock('loc-factory', 'p2'), availFactory, 'Stock must remain unchanged');
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
