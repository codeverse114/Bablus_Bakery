/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE 2
 * Tests: S1, S2, S4, G1, G2
 */

const assert = require('assert');
const http = require('http');
const app = require('../server/server');
const store = require('../server/store');

let server;
const PORT = 3001;
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
  console.log('RUNNING BACKREY BASES TEST SUITE: MILESTONE 2');
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

  // TEST S1: 3 live and 1 offline product exist -> Only 3 show
  await test('S1', '3 live and 1 offline product exist -> Only 3 show', async () => {
    store.reset();
    
    // Explicitly configure 3 live and 1 offline product
    store.products = [
      { id: 't1', name: 'Live Base 1', category: 'Pizza bases', retail_price: 150, stock: 50, is_live: true },
      { id: 't2', name: 'Live Base 2', category: 'Burger bases', retail_price: 120, stock: 30, is_live: true },
      { id: 't3', name: 'Live Base 3', category: 'Bread', retail_price: 90, stock: 20, is_live: true },
      { id: 't4', name: 'Draft Secret Base', category: 'Pizza bases', retail_price: 200, stock: 10, is_live: false }
    ];

    const res = await request('GET', '/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.products.length, 3, 'Should return exactly 3 products');
    
    const foundOffline = res.body.products.some(p => p.id === 't4');
    assert.strictEqual(foundOffline, false, 'Offline product must NOT appear in public catalog');
  });

  // TEST S2: Stock 100, 5, 0 -> In stock, Low stock, Out of stock; button disabled at 0
  await test('S2', 'Stock 100, 5, 0 -> In stock, Low stock, Out of stock; button disabled at 0', async () => {
    store.reset();

    store.products = [
      { id: 's-100', name: 'Abundant Base', category: 'Pizza bases', retail_price: 150, stock: 100, low_stock_threshold: 20, is_live: true },
      { id: 's-5', name: 'Running Low Base', category: 'Burger bases', retail_price: 120, stock: 5, low_stock_threshold: 20, is_live: true },
      { id: 's-0', name: 'Sold Out Base', category: 'Bread', retail_price: 90, stock: 0, low_stock_threshold: 20, is_live: true }
    ];

    const res = await request('GET', '/products');
    assert.strictEqual(res.status, 200);

    const p100 = res.body.products.find(p => p.id === 's-100');
    const p5 = res.body.products.find(p => p.id === 's-5');
    const p0 = res.body.products.find(p => p.id === 's-0');

    assert.strictEqual(p100.stock_status, 'In stock');
    assert.strictEqual(p100.can_add, true);

    assert.strictEqual(p5.stock_status, 'Low stock');
    assert.strictEqual(p5.can_add, true);

    assert.strictEqual(p0.stock_status, 'Out of stock');
    assert.strictEqual(p0.can_add, false, 'can_add must be false when stock is 0 (button disabled)');
  });

  // TEST S4: Open at 360px -> No sideways scroll
  await test('S4', 'Open at 360px -> Viewport configured and no sideways scroll triggers', async () => {
    const fs = require('fs');
    const path = require('path');

    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');
    const css = fs.readFileSync(path.join(__dirname, '../public/styles/main.css'), 'utf-8');

    // Verify viewport meta tag exists with responsive settings
    assert.ok(html.includes('<meta name="viewport"'), 'HTML must have viewport meta tag');
    assert.ok(html.includes('width=device-width'), 'Viewport must specify width=device-width');

    // Verify CSS prevents horizontal scrolling overflow
    assert.ok(css.includes('overflow-x: hidden'), 'CSS must prevent horizontal overflow on body/html');
    assert.ok(css.includes('box-sizing: border-box'), 'CSS must use box-sizing border-box reset');
  });

  // TEST G1: Add to cart as guest -> Cart works with no login
  await test('G1', 'Add to cart as guest -> Cart works with no login', async () => {
    store.reset();
    
    // Guest validates cart without any session token or auth headers
    const guestCart = [
      { id: 'p1', quantity: 2 },
      { id: 'p2', quantity: 1 }
    ];

    const res = await request('POST', '/cart/validate', { items: guestCart });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.is_valid, true);
    assert.strictEqual(res.body.items.length, 2);
    
    // Correct server calculation: p1 retail 180 * 2 = 360; p2 retail 140 * 1 = 140; subtotal = 500
    assert.strictEqual(res.body.subtotal, 500);
    assert.ok(res.body.grand_total >= 500);
  });

  // TEST G2: Add more than stock -> Blocked
  await test('G2', 'Add more than stock -> Blocked', async () => {
    store.reset();
    
    // Product p2 only has 5 units in stock
    const p2 = store.products.find(p => p.id === 'p2');
    assert.ok(p2, 'Product p2 must exist');
    assert.strictEqual(p2.stock, 5);

    // Guest attempts to order 10 units
    const invalidCart = [
      { id: 'p2', quantity: 10 }
    ];

    const res = await request('POST', '/cart/validate', { items: invalidCart });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.is_valid, false, 'Cart must be marked invalid when quantity exceeds stock');
    
    const p2Validation = res.body.items.find(i => i.id === 'p2');
    assert.strictEqual(p2Validation.is_valid, false);
    assert.ok(p2Validation.error.includes('Only 5 units available'), `Error should state available stock: ${p2Validation.error}`);
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
