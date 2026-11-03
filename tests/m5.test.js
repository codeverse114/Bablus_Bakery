/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE 5 (W TESTS)
 * Tests: W1, W3, W5, W7, W8
 */

const assert = require('assert');
const http = require('http');
const app = require('../server/server');
const store = require('../server/store');

let server;
const PORT = 3003;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = `${path.startsWith('/') ? path : '/' + path}`;
    const url = new URL(fullPath, `http://localhost:${PORT}`);
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
  console.log('RUNNING BACKREY BASES TEST SUITE: MILESTONE 5 (W TESTS)');
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

  // TEST W1: Register as shopkeeper -> Active immediately
  await test('W1', 'Register as shopkeeper -> Active immediately', async () => {
    store.reset();

    const newShopkeeper = {
      shop_name: 'Fire & Stone Pizzeria',
      owner_name: 'Ananya Deshmukh',
      mobile: '9845112233',
      email: 'ananya@firestone.in',
      address: 'Shop 5, Phoenix Marketcity, Whitefield',
      state: 'Karnataka',
      gstin: '29ABCDE1234F1Z5',
      password: 'password_secret'
    };

    const regRes = await request('POST', '/api/wholesale/register', newShopkeeper);
    assert.strictEqual(regRes.status, 200);
    assert.strictEqual(regRes.body.success, true);
    assert.strictEqual(regRes.body.wholesaler.is_active, true, 'Account must be immediately active');
    const token = regRes.body.token;
    assert.ok(token, 'Must return wholesale auth token immediately');

    // Immediately access wholesale dashboard without waiting for manual admin approval
    const dashRes = await request('GET', '/api/wholesale/dashboard', null, { 'x-wholesale-token': token });
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.body.profile.shop_name, 'Fire & Stone Pizzeria');
  });

  // TEST W3: Compare guest and wholesaler price -> Wholesaler sees wholesale price
  await test('W3', 'Compare guest and wholesaler price -> Wholesaler sees wholesale price', async () => {
    store.reset();

    // 1. Guest request (no wholesale token)
    const guestRes = await request('GET', '/api/products');
    assert.strictEqual(guestRes.status, 200);
    const guestP1 = guestRes.body.products.find(p => p.id === 'p1');
    assert.ok(guestP1, 'Product p1 must exist');
    const guestPrice = guestP1.price;
    assert.strictEqual(guestPrice, 180, 'Guest must see standard retail price ₹180');

    // 2. Wholesaler request (wh-1 has shopkeeper override ₹120; standard wholesale is ₹130)
    const wholesaleRes = await request('GET', '/api/products', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(wholesaleRes.status, 200);
    const wholesaleP1 = wholesaleRes.body.products.find(p => p.id === 'p1');
    assert.ok(wholesaleP1, 'Product p1 must exist for wholesaler');
    const wholesalePrice = wholesaleP1.price;

    assert.strictEqual(wholesalePrice, 120, 'Wholesaler must see discounted wholesale price ₹120');
    assert.ok(wholesalePrice < guestPrice, `Wholesale price (₹${wholesalePrice}) must be lower than guest price (₹${guestPrice})`);
  });

  // TEST W5: Order below minimum -> Blocked
  await test('W5', 'Order below minimum -> Blocked', async () => {
    store.reset();

    // Product p1 has min_wholesale_qty = 10
    const p1 = store.products.find(p => p.id === 'p1');
    assert.strictEqual(p1.min_wholesale_qty, 10);

    // Wholesaler attempts to order 4 units (below MOQ 10)
    const belowMoqCart = [
      { id: 'p1', quantity: 4 }
    ];

    const valRes = await request('POST', '/api/cart/validate', { items: belowMoqCart }, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valRes.body.is_valid, false, 'Order below minimum quantity must be invalid/blocked');
    
    const p1Validation = valRes.body.items.find(i => i.id === 'p1');
    assert.strictEqual(p1Validation.is_valid, false);
    assert.ok(p1Validation.error.includes('Minimum wholesale order'), `Error must mention MOQ: ${p1Validation.error}`);
  });

  // TEST W7: Re-order -> Cart refilled
  await test('W7', 'Re-order -> Cart refilled', async () => {
    store.reset();

    // Call reorder endpoint for past order BB-900123
    const reorderRes = await request('POST', '/api/wholesale/reorder/BB-900123', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(reorderRes.status, 200);
    assert.strictEqual(reorderRes.body.success, true);
    assert.strictEqual(reorderRes.body.orderNo, 'BB-900123');
    assert.ok(Array.isArray(reorderRes.body.items));
    assert.strictEqual(reorderRes.body.items.length, 1);
    assert.strictEqual(reorderRes.body.items[0].id, 'p1');
    assert.strictEqual(reorderRes.body.items[0].quantity, 10);
  });

  // TEST W8: Wholesaler opens admin URL -> Denied
  await test('W8', 'Wholesaler opens admin URL -> Denied', async () => {
    store.reset();

    // 1. Wholesaler attempts to open /admin
    const adminPageRes = await request('GET', '/admin', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(adminPageRes.status, 403, 'Opening /admin must return 403 Forbidden');

    // 2. Wholesaler attempts to call /api/admin/config
    const adminApiRes = await request('GET', '/api/admin/config', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(adminApiRes.status, 403, 'Calling /api/admin/* must return 403 Forbidden');
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
