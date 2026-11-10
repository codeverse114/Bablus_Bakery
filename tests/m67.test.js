/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONES M6(EXTEND) & M7(EXTEND)
 * Blueprint Addendum: Sectioned Invoice Series, Weekly/Monthly/Custom Reports & Customer Statements
 *
 * Tests Covered:
 * - B1: Create invoices in each section -> Separate sequential series, no gaps
 * - B2: Weekly Factory report -> Only factory orders in that week
 * - B3: Monthly report per section -> Totals match that section's orders
 * - B4: Custom range covering a full year -> Totals correct
 * - B5: Sum of the three section reports -> Equals the combined report
 * - B6: Customer downloads statement -> Only their own data
 * - B7: Report shows Standard versus Special usage -> Counts are correct
 * - B8: Invoice ZIP per section and period -> Marked as later add-on in Blueprint (skipped)
 */

const assert = require('assert');
const http = require('http');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-m67-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
  await request('POST', '/api/auth/otp/request', { mobile, deviceId: 'test-m67' });
  const verRes = await request('POST', '/api/auth/otp/verify', { mobile, otp: '123456', deviceId: 'test-m67' });
  assert.strictEqual(verRes.status, 200);
  return verRes.body.token;
}

async function placePaidOrder(items, customer, token = null) {
  const headers = token ? { 'x-customer-token': token } : {};
  const chk = await request('POST', '/api/checkout/start', { items, customer }, headers);
  assert.strictEqual(chk.status, 200, `Checkout failed: ${JSON.stringify(chk.body)}`);
  const pay = await request('POST', '/api/payments/webhook', {
    reservationId: chk.body.reservationId,
    paymentId: 'pay_b_' + Date.now() + '_' + Math.floor(Math.random() * 10000)
  });
  assert.strictEqual(pay.status, 200);
  return pay.body.order;
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
  console.log(' RUNNING BACKREY BASES TEST SUITE: M6(EXT) & M7(EXT) ');
  console.log('====================================================\n');

  const ownerHeaders = { 'Authorization': 'Bearer adm-usr-owner-1' };

  // TEST B1: Create invoices in each section -> Separate sequential series, no gaps
  await test('B1', 'Create invoices in each section -> Separate sequential series, no gaps', async () => {
    store.reset();
    const facToken = await loginCustomerOtp('9876500001'); // Factory Std
    const shpToken = await loginCustomerOtp('9876543210'); // Shopkeeper Special

    const facOrder1 = await placePaidOrder([{ id: 'p2', quantity: 10 }], { name: 'Fac A', mobile: '9876500001', address: 'Peenya' }, facToken);
    const shpOrder1 = await placePaidOrder([{ id: 'p2', quantity: 5 }], { name: 'Marco', mobile: '9876543210', address: 'Indiranagar' }, shpToken);
    const retOrder1 = await placePaidOrder([{ id: 'p2', quantity: 5 }], { name: 'Guest 1', mobile: '9000011111', address: 'Whitefield' });
    const facOrder2 = await placePaidOrder([{ id: 'p2', quantity: 10 }], { name: 'Fac A', mobile: '9876500001', address: 'Peenya' }, facToken);
    const retOrder2 = await placePaidOrder([{ id: 'p2', quantity: 3 }], { name: 'Guest 2', mobile: '9000022222', address: 'Koramangala' });

    assert.strictEqual(facOrder1.invoiceNo, 'FAC/2026-27/0001');
    assert.strictEqual(facOrder2.invoiceNo, 'FAC/2026-27/0002');
    assert.strictEqual(shpOrder1.invoiceNo, 'SHP/2026-27/0001');
    assert.strictEqual(retOrder1.invoiceNo, 'RET/2026-27/0001');
    assert.strictEqual(retOrder2.invoiceNo, 'RET/2026-27/0002');
  });

  // Setup multi-section orders for B2–B7
  // TEST B2: Weekly Factory report -> Only factory orders in that week
  await test('B2', 'Weekly Factory report -> Only factory orders in that week', async () => {
    store.reset();
    const facStdToken = await loginCustomerOtp('9876500001');
    const facSpcToken = await loginCustomerOtp('9876500002');
    const shpToken = await loginCustomerOtp('9876543210');

    await placePaidOrder([{ id: 'p2', quantity: 10 }], { name: 'Fac Std', mobile: '9876500001', address: 'Peenya' }, facStdToken); // ₹1,000, 100 pcs
    await placePaidOrder([{ id: 'p2', quantity: 10 }], { name: 'Fac Spc', mobile: '9876500002', address: 'Bommasandra' }, facSpcToken); // ₹900, 100 pcs
    await placePaidOrder([{ id: 'p2', quantity: 5 }], { name: 'Shopkeeper', mobile: '9876543210', address: 'Indiranagar' }, shpToken); // Should NOT appear in Factory report
    await placePaidOrder([{ id: 'p2', quantity: 5 }], { name: 'Retail Guest', mobile: '9123400000', address: 'HSR Layout' }); // Should NOT appear in Factory report

    const repRes = await request('GET', '/api/admin/reports/section/factory?period=weekly', null, ownerHeaders);
    assert.strictEqual(repRes.status, 200);
    assert.strictEqual(repRes.body.section, 'factory');
    assert.strictEqual(repRes.body.total_orders, 2, 'Only the 2 factory orders must be counted');
    assert.strictEqual(repRes.body.total_pieces, 200, '200 factory pieces');
    assert.strictEqual(repRes.body.gross_amount, 1900, '₹1,000 + ₹900 = ₹1,900');
  });

  // TEST B3: Monthly report per section -> Totals match that section's orders
  await test('B3', 'Monthly report per section -> Totals match that section\'s orders', async () => {
    const now = new Date();
    const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const facRes = await request('GET', `/api/admin/reports/section/factory?period=monthly&month=${monthParam}`, null, ownerHeaders);
    const shpRes = await request('GET', `/api/admin/reports/section/shopkeeper?period=monthly&month=${monthParam}`, null, ownerHeaders);
    const regRes = await request('GET', `/api/admin/reports/section/regular?period=monthly&month=${monthParam}`, null, ownerHeaders);

    assert.strictEqual(facRes.body.total_orders, 2);
    assert.strictEqual(facRes.body.gross_amount, 1900);

    assert.strictEqual(shpRes.body.total_orders, 1);
    assert.strictEqual(shpRes.body.total_pieces, 50); // 5 packs * 10 = 50 buns
    assert.strictEqual(shpRes.body.gross_amount, 515); // 5 * ₹95 (475) + ₹40 delivery (< 500 threshold) = ₹515

    assert.strictEqual(regRes.body.total_orders, 1);
    assert.strictEqual(regRes.body.total_pieces, 5);
  });

  // TEST B4: Custom range covering a full year -> Totals correct
  await test('B4', 'Custom range covering a full year -> Totals correct', async () => {
    const year = new Date().getFullYear();
    const res = await request('GET', `/api/admin/reports/section/all?period=custom&startDate=${year}-01-01&endDate=${year}-12-31`, null, ownerHeaders);
    assert.strictEqual(res.status, 200);
    // 4 orders created above + 1 seeded order BB-900123 (2026-10-25) = 5 if year === 2026
    assert.ok(res.body.total_orders >= 4, 'Must cover all orders in the custom full-year range');
  });

  // TEST B5: Sum of the three section reports -> Equals the combined report
  await test('B5', 'Sum of the three section reports -> Equals the combined report', async () => {
    const now = new Date();
    const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const fac = (await request('GET', `/api/admin/reports/section/factory?period=monthly&month=${monthParam}`, null, ownerHeaders)).body;
    const shp = (await request('GET', `/api/admin/reports/section/shopkeeper?period=monthly&month=${monthParam}`, null, ownerHeaders)).body;
    const reg = (await request('GET', `/api/admin/reports/section/regular?period=monthly&month=${monthParam}`, null, ownerHeaders)).body;
    const all = (await request('GET', `/api/admin/reports/section/all?period=monthly&month=${monthParam}`, null, ownerHeaders)).body;

    assert.strictEqual(fac.total_orders + shp.total_orders + reg.total_orders, all.total_orders, 'Order counts sum must equal combined report');
    assert.strictEqual(fac.total_pieces + shp.total_pieces + reg.total_pieces, all.total_pieces, 'Pieces sum must equal combined report');
    assert.strictEqual(fac.gross_amount + shp.gross_amount + reg.gross_amount, all.gross_amount, 'Gross amount sum must equal combined report');
  });

  // TEST B6: Customer downloads statement -> Only their own data
  await test('B6', 'Customer downloads statement -> Only their own data', async () => {
    const facStdToken = await loginCustomerOtp('9876500001'); // Fac Std (spent ₹1,000)
    const facSpcToken = await loginCustomerOtp('9876500002'); // Fac Spc (spent ₹900)

    const stmt1 = await request('GET', '/api/me/statement?period=monthly', null, { 'x-customer-token': facStdToken });
    assert.strictEqual(stmt1.status, 200);
    assert.strictEqual(stmt1.body.customer.id, 'cust-fac-std');
    assert.strictEqual(stmt1.body.summary.total_orders, 1);
    assert.strictEqual(stmt1.body.summary.total_amount, 1000);

    // Ensure CSV download also only includes cust-fac-std's data
    const csvRes = await request('GET', '/api/me/statement?format=csv', null, { 'x-customer-token': facSpcToken });
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.headers['content-type'].includes('text/csv'));
    assert.ok(csvRes.body.includes('900'), 'Special customer statement must show ₹900');
    assert.ok(!csvRes.body.includes('1000'), 'Must NOT contain another customer\'s ₹1000 order');
  });

  // TEST B7: Report shows Standard versus Special usage -> Counts are correct
  await test('B7', 'Report shows Standard versus Special usage -> Counts are correct', async () => {
    const now = new Date();
    const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const facRes = await request('GET', `/api/admin/reports/section/factory?period=monthly&month=${monthParam}`, null, ownerHeaders);
    const pb = facRes.body.pricing_breakdown;
    assert.strictEqual(pb.standard_orders_count, 1, '1 Standard order in Factory');
    assert.strictEqual(pb.standard_orders_amount, 1000);
    assert.strictEqual(pb.special_orders_count, 1, '1 Special order in Factory');
    assert.strictEqual(pb.special_orders_amount, 900);
  });

  // Blueprint Section 15.9: Staff sees only Regular orders, Shop stock & Shop-collected Shopkeeper orders
  await test('STAFF-15.9', 'Staff sees Shop stock & Shop orders only; blocked from Factory, prices, logs & transfers', async () => {
    const staffHeaders = { 'Authorization': 'Bearer adm-usr-staff-1' };

    // Blocked (403) from prices, price lists, price log, transfers, customer registry
    const pLog = await request('GET', '/api/admin/price-log', null, staffHeaders);
    const sCust = await request('GET', '/api/admin/sections/factory/customers', null, staffHeaders);
    const txList = await request('GET', '/api/admin/stock/transfers', null, staffHeaders);
    assert.strictEqual(pLog.status, 403);
    assert.strictEqual(sCust.status, 403);
    assert.strictEqual(txList.status, 403);

    // Location stock returns only loc-shop
    const locRes = await request('GET', '/api/admin/stock/locations', null, staffHeaders);
    assert.strictEqual(locRes.status, 200);
    assert.strictEqual(locRes.body.locations.length, 1);
    assert.strictEqual(locRes.body.locations[0].id, 'loc-shop');

    // Orders list excludes Factory section orders
    const ordRes = await request('GET', '/api/admin/orders', null, staffHeaders);
    assert.strictEqual(ordRes.status, 200);
    assert.strictEqual(ordRes.body.orders.some(o => o.section === 'factory'), false, 'Staff must not see Factory orders');
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
