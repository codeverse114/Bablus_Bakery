/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE 3
 * Tests: G3, G4, G5, G6, G7, G9, G10
 */

const assert = require('assert');
const http = require('http');
const app = require('../server/server');
const store = require('../server/store');

let server;
const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = `${path.startsWith('/') ? path : '/' + path}`;
    const url = new URL(`/api${fullPath}`, `http://localhost:${PORT}`);
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (body) {
      reqBody = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
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

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING BACKREY BASES TEST SUITE: MILESTONE 3 (G TESTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(id, description, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${id}: ${description}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${id}: ${description}`);
      console.error(`   Error: ${err.message}\n`);
      failed++;
    }
  }

  // TEST G3: Blank and bad phone numbers -> Errors shown
  await test('G3', 'Blank and bad phone numbers -> Errors shown', async () => {
    store.reset();

    const badPhones = ['', '123', 'abcdefghij', '1234567890123', '987-bad'];
    for (const phone of badPhones) {
      const res = await request('POST', '/checkout/start', {
        items: [{ id: 'p1', quantity: 1 }],
        customer: { name: 'Test Customer', mobile: phone, address: 'Indiranagar 100ft road' }
      });
      assert.strictEqual(res.status, 400, `Phone "${phone}" must be rejected`);
      assert.ok(res.body.error.toLowerCase().includes('10-digit mobile number'));
    }

    // Also test order tracking with bad phone verification
    const orderRes = await request('GET', '/orders/BB-NONEXISTENT?phone=123');
    assert.strictEqual(orderRes.status, 404);
  });

  // TEST G4: Pay with test UPI/card -> Order confirmed, stock reduced
  await test('G4', 'Pay with test UPI/card -> Order confirmed, stock reduced', async () => {
    store.reset();
    const p1 = store.products.find(p => p.id === 'p1');
    p1.stock = 10;

    // Start checkout reservation for 2 units
    const chkRes = await request('POST', '/checkout/start', {
      items: [{ id: 'p1', quantity: 2 }],
      customer: { name: 'Priya Sharma', mobile: '9876543210', address: '12th Cross, Koramangala' }
    });
    assert.strictEqual(chkRes.status, 200);
    assert.strictEqual(chkRes.body.success, true);
    const reservationId = chkRes.body.reservationId;

    // Pay with test payment webhook
    const payRes = await request('POST', '/payments/webhook', {
      reservationId,
      paymentId: 'pay_test_g4_123',
      simulatedStatus: 'success'
    });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.success, true);
    assert.strictEqual(payRes.body.order.status, 'Paid');

    // Verify stock permanently reduced from 10 to 8
    assert.strictEqual(p1.stock, 8, 'Physical stock must be reduced by 2');
  });

  // TEST G5: Failed test payment -> No order, stock released
  await test('G5', 'Failed test payment -> No order, stock released', async () => {
    store.reset();
    const p1 = store.products.find(p => p.id === 'p1');
    p1.stock = 10;

    const chkRes = await request('POST', '/checkout/start', {
      items: [{ id: 'p1', quantity: 3 }],
      customer: { name: 'Anita Rao', mobile: '9123456780', address: 'MG Road' }
    });
    assert.strictEqual(chkRes.status, 200);
    const reservationId = chkRes.body.reservationId;

    // Available stock during hold is 10 - 3 = 7
    assert.strictEqual(store.getStockStatus(p1).available, 7);

    // Simulate failure
    const failRes = await request('POST', '/payments/webhook', {
      reservationId,
      simulatedStatus: 'failure'
    });

    assert.strictEqual(failRes.status, 400);
    assert.strictEqual(failRes.body.status, 'FAILED');

    // Available stock immediately released back to 10
    assert.strictEqual(store.getStockStatus(p1).available, 10);
    assert.strictEqual(p1.stock, 10, 'Physical stock was not deducted');
  });

  // TEST G6: Start checkout and abandon -> Stock released after hold expires
  await test('G6', 'Start checkout and abandon -> Stock released after hold expires', async () => {
    store.reset();
    const p1 = store.products.find(p => p.id === 'p1');
    p1.stock = 10;

    const chkRes = await request('POST', '/checkout/start', {
      items: [{ id: 'p1', quantity: 4 }],
      customer: { name: 'Arjun Das', mobile: '9988776655', address: 'Whitefield' }
    });
    assert.strictEqual(chkRes.status, 200);
    const reservationId = chkRes.body.reservationId;

    // While hold is active, available is 6
    assert.strictEqual(store.getStockStatus(p1).available, 6);

    // Force reservation expiration (simulating 10-minute timeout expiry)
    const expRes = await request('POST', '/test/expire-reservation', { reservationId });
    assert.strictEqual(expRes.status, 200);

    // Stock must be released after hold expires
    assert.strictEqual(store.getStockStatus(p1).available, 10);
    
    // Attempting to pay an expired reservation must fail
    const payRes = await request('POST', '/payments/webhook', {
      reservationId,
      paymentId: 'pay_too_late'
    });
    assert.strictEqual(payRes.status, 400);
    assert.strictEqual(payRes.body.status, 'EXPIRED');
  });

  // TEST G7: Duplicate webhook -> One order only
  await test('G7', 'Duplicate webhook -> One order only', async () => {
    store.reset();
    const p1 = store.products.find(p => p.id === 'p1');
    p1.stock = 10;

    const chkRes = await request('POST', '/checkout/start', {
      items: [{ id: 'p1', quantity: 2 }],
      customer: { name: 'Rohan Mehta', mobile: '9845012345', address: 'Jayanagar' }
    });
    const reservationId = chkRes.body.reservationId;
    const initialOrderCount = store.orders.length;

    // Send first webhook
    const res1 = await request('POST', '/payments/webhook', {
      reservationId,
      paymentId: 'pay_duplicate_webhook_unique_id',
      simulatedStatus: 'success'
    });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(store.orders.length, initialOrderCount + 1);
    assert.strictEqual(p1.stock, 8);

    // Send duplicate webhook with identical paymentId
    const res2 = await request('POST', '/payments/webhook', {
      reservationId,
      paymentId: 'pay_duplicate_webhook_unique_id',
      simulatedStatus: 'success'
    });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.duplicate, true);
    // Crucial: exactly one order exists and stock was NOT deducted again
    assert.strictEqual(store.orders.length, initialOrderCount + 1);
    assert.strictEqual(p1.stock, 8, 'Stock must not be double deducted');
  });

  // TEST G9: 20 buyers for 5 units -> Exactly 5 sold
  await test('G9', '20 buyers for 5 units -> Exactly 5 sold', async () => {
    store.reset();
    const p2 = store.products.find(p => p.id === 'p2');
    p2.stock = 5; // Exactly 5 units available

    // Simulate 20 concurrent buyers attempting to reserve 1 unit each
    const buyerPromises = [];
    for (let i = 1; i <= 20; i++) {
      const mobileNum = `98000000${String(i).padStart(2, '0')}`;
      buyerPromises.push(
        request('POST', '/checkout/start', {
          items: [{ id: 'p2', quantity: 1 }],
          customer: { name: `Buyer ${i}`, mobile: mobileNum, address: `Address ${i}` }
        })
      );
    }

    const responses = await Promise.all(buyerPromises);

    const successfulReservations = responses.filter(r => r.status === 200);
    const rejectedReservations = responses.filter(r => r.status === 400);

    assert.strictEqual(successfulReservations.length, 5, 'Exactly 5 buyers must secure a reservation');
    assert.strictEqual(rejectedReservations.length, 15, '15 buyers must be blocked due to stock exhaustion');

    // Confirm payments for the 5 successful buyers
    for (const succ of successfulReservations) {
      const payRes = await request('POST', '/payments/webhook', {
        reservationId: succ.body.reservationId,
        paymentId: 'pay_g9_' + Math.random().toString(36).substring(7)
      });
      assert.strictEqual(payRes.status, 200);
    }

    // Verify exactly 5 units sold and final stock is 0
    assert.strictEqual(p2.stock, 0, 'Physical stock of p2 must be 0');
  });

  // TEST G10: Tamper with price in the request -> Real price used
  await test('G10', 'Tamper with price in the request -> Real price used', async () => {
    store.reset();
    const p1 = store.products.find(p => p.id === 'p1');
    const realPrice = p1.retail_price; // 180
    assert.ok(realPrice > 1);

    // Client attempts to tamper with price by sending ₹1
    const tamperedPayload = {
      items: [
        {
          id: 'p1',
          quantity: 2,
          retail_price: 1, // Tampered price
          price: 1,
          total: 2
        }
      ],
      customer: { name: 'Sneaky User', mobile: '9000000000', address: 'Cyber City' }
    };

    const res = await request('POST', '/checkout/start', tamperedPayload);
    assert.strictEqual(res.status, 200);
    
    // Server must calculate 2 * 180 = 360, completely ignoring the tampered ₹1
    assert.strictEqual(res.body.summary.subtotal, 360, 'Subtotal must be computed from server price');
    assert.ok(res.body.summary.grand_total >= 360, 'Grand total must use real server price');
  });

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

// Start test server
server = app.listen(PORT, async () => {
  try {
    await runTests();
  } catch (e) {
    console.error('Fatal test error:', e);
    process.exit(1);
  } finally {
    server.close();
  }
});
