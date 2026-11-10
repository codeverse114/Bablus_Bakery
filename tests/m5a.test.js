/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONE M1(EXTEND) & M5A
 * Blueprint Addendum: Customer Sections, Custom Prices & Sectioned Billing
 *
 * Tests Covered:
 * - SB1: Open the admin panel -> Sections, Standard and Special entries appear as designed
 * - SB2: Add a number under Factory, Special -> It appears in that list and can log in
 * - SB3: Same action under Shopkeepers and Regular -> Works the same way
 * - L1:  Unregistered number requests login -> Refused, no OTP sent, neutral message
 * - L2:  Registered number requests login -> OTP sent, login succeeds
 * - L3:  Deactivated number -> Refused with the same neutral message
 * - L4:  Many OTP requests from one number or device -> Rate limited (429)
 * - L5:  Add the same number to two sections -> Blocked (400)
 * - L6:  Guest checkout in Regular section -> Still works with no login
 * - L7:  Registered regular customer logs in -> Sees their Special price
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../backend/server');
const store = require('../backend/models/store');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-m5a-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
          resolve({ status: res.statusCode, body: json, raw: data, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function runTests() {
  console.log('\n====================================================');
  console.log(' RUNNING BACKREY BASES TEST SUITE: M1(EXTEND) & M5A ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(id, description, fn) {
    try {
      await fn();
      console.log(`  [PASS] Test ${id}: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${id}: ${description}`);
      console.error(`         Error: ${err.message}\n`);
      failed++;
    }
  }

  const ADMIN_AUTH = { 'Authorization': 'Bearer adm-usr-owner-1' };

  // ----------------------------------------------------
  // SIDEBAR & SECTION ENTRY TESTS (SB1 - SB3)
  // ----------------------------------------------------

  // SB1: Open the admin panel -> Sections, Standard and Special entries appear as designed
  await test('SB1', 'Open the admin panel -> Sections, Standard and Special entries appear as designed', async () => {
    store.reset();
    
    // Check admin HTML contains section navigation items
    const adminHtml = fs.readFileSync(path.join(__dirname, '../admin/public/index.html'), 'utf8');
    assert.ok(adminHtml.includes('data-tab="section-factory"'), 'Admin sidebar must have Factory section');
    assert.ok(adminHtml.includes('data-tab="section-shopkeeper"'), 'Admin sidebar must have Shopkeepers section');
    assert.ok(adminHtml.includes('data-tab="section-regular"'), 'Admin sidebar must have Regular section');
    assert.ok(adminHtml.includes('id="secTab-Standard"'), 'Section console must have Standard tab');
    assert.ok(adminHtml.includes('id="secTab-Special"'), 'Section console must have Special tab');
    assert.ok(adminHtml.includes('id="secTab-Customers"'), 'Section console must have Customers tab');
    assert.ok(adminHtml.includes('id="secTab-Billing"'), 'Section console must have Billing tab');

    // Also verify API returns price lists for standard and special
    const stdListRes = await request('GET', '/api/admin/price-lists/pl-fac-std', null, ADMIN_AUTH);
    assert.strictEqual(stdListRes.status, 200);
    assert.strictEqual(stdListRes.body.price_list.type, 'standard');
    assert.strictEqual(stdListRes.body.price_list.section, 'factory');

    const spcListRes = await request('GET', '/api/admin/price-lists/pl-fac-spc-1', null, ADMIN_AUTH);
    assert.strictEqual(spcListRes.status, 200);
    assert.strictEqual(spcListRes.body.price_list.type, 'special');
  });

  // SB2: Add a number under Factory, Special -> It appears in that list and can log in
  await test('SB2', 'Add a number under Factory, Special -> It appears in that list and can log in', async () => {
    store.reset();

    const newFactorySpecial = {
      mobile: '9845011223',
      name: 'Rohan Deshmukh',
      shop_name: 'Deshmukh Central Bakes',
      address: 'Plot 77, Peenya 3rd Phase',
      gstin: '29AAAAA1111A1Z9',
      price_list_id: 'pl-fac-spc-1'
    };

    const addRes = await request('POST', '/api/admin/sections/factory/customers', newFactorySpecial, ADMIN_AUTH);
    assert.strictEqual(addRes.status, 201);
    assert.strictEqual(addRes.body.success, true);
    assert.strictEqual(addRes.body.customer.mobile, '9845011223');
    assert.strictEqual(addRes.body.customer.price_list_id, 'pl-fac-spc-1');

    // Verify it appears in Factory section customers list
    const listRes = await request('GET', '/api/admin/sections/factory/customers', null, ADMIN_AUTH);
    assert.strictEqual(listRes.status, 200);
    const found = listRes.body.customers.find(c => c.mobile === '9845011223');
    assert.ok(found, 'Customer must appear in Factory customers list');
    assert.strictEqual(found.price_list_id, 'pl-fac-spc-1');

    // Verify this newly added number can log in via OTP
    const otpRes = await request('POST', '/api/auth/otp/request', { mobile: '9845011223' });
    assert.strictEqual(otpRes.status, 200);
    assert.strictEqual(otpRes.body.success, true);
    assert.strictEqual(otpRes.body.otp, '123456');

    const verifyRes = await request('POST', '/api/auth/otp/verify', { mobile: '9845011223', otp: '123456' });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.success, true);
    assert.ok(verifyRes.body.token);
    assert.strictEqual(verifyRes.body.customer.section, 'factory');
  });

  // SB3: Same action under Shopkeepers and Regular -> Works the same way
  await test('SB3', 'Same action under Shopkeepers and Regular -> Works the same way', async () => {
    // 1. Add under Shopkeepers
    const shopkeeperCust = {
      mobile: '9845022334',
      name: 'Sunil Rao',
      shop_name: 'Oven Story Cafe',
      address: 'Indiranagar 12th Main',
      price_list_id: 'pl-shp-spc-1'
    };
    const addShp = await request('POST', '/api/admin/sections/shopkeeper/customers', shopkeeperCust, ADMIN_AUTH);
    assert.strictEqual(addShp.status, 201);
    assert.strictEqual(addShp.body.customer.section, 'shopkeeper');

    // 2. Add under Regular (Shop)
    const regularCust = {
      mobile: '9845033445',
      name: 'Pooja Hegde',
      address: 'Koramangala 4th Block',
      price_list_id: 'pl-reg-spc-1'
    };
    const addReg = await request('POST', '/api/admin/sections/regular/customers', regularCust, ADMIN_AUTH);
    assert.strictEqual(addReg.status, 201);
    assert.strictEqual(addReg.body.customer.section, 'regular');

    // Verify both appear in their respective section lists
    const shpList = await request('GET', '/api/admin/sections/shopkeeper/customers', null, ADMIN_AUTH);
    assert.ok(shpList.body.customers.some(c => c.mobile === '9845022334'));

    const regList = await request('GET', '/api/admin/sections/regular/customers', null, ADMIN_AUTH);
    assert.ok(regList.body.customers.some(c => c.mobile === '9845033445'));

    // Both can log in via OTP
    const otpShp = await request('POST', '/api/auth/otp/request', { mobile: '9845022334' });
    assert.strictEqual(otpShp.status, 200);
    const otpReg = await request('POST', '/api/auth/otp/request', { mobile: '9845033445' });
    assert.strictEqual(otpReg.status, 200);
  });

  // ----------------------------------------------------
  // LOGIN RULES TESTS (L1 - L7)
  // ----------------------------------------------------

  // L1: Unregistered number requests login -> Refused, no OTP sent, neutral message
  await test('L1', 'Unregistered number requests login -> Refused, no OTP sent, neutral message', async () => {
    store.reset();

    const unregMobile = '9999900000';
    const res = await request('POST', '/api/auth/otp/request', { mobile: unregMobile });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.registered, false);
    assert.strictEqual(res.body.error, 'This number is not registered. Please contact the factory.');
    assert.strictEqual(res.body.otp, undefined, 'No OTP should be sent for unregistered numbers');

    // Verify no OTP was logged as SENT
    const sentOtp = store.otp_log.find(l => l.mobile === unregMobile && l.status === 'SENT');
    assert.strictEqual(sentOtp, undefined);
  });

  // L2: Registered number requests login -> OTP sent, login succeeds
  await test('L2', 'Registered number requests login -> OTP sent, login succeeds', async () => {
    store.reset();

    const regMobile = '9876500001'; // Seeded Factory Customer A
    const reqRes = await request('POST', '/api/auth/otp/request', { mobile: regMobile });
    assert.strictEqual(reqRes.status, 200);
    assert.strictEqual(reqRes.body.success, true);
    assert.strictEqual(reqRes.body.registered, true);
    assert.strictEqual(reqRes.body.otp, '123456');

    const verifyRes = await request('POST', '/api/auth/otp/verify', { mobile: regMobile, otp: '123456' });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.success, true);
    assert.ok(verifyRes.body.token);
    assert.strictEqual(verifyRes.body.customer.name, 'Factory Customer A');
    assert.strictEqual(verifyRes.body.customer.section, 'factory');
  });

  // L3: Deactivated number -> Refused with the same neutral message
  await test('L3', 'Deactivated number -> Refused with the same neutral message', async () => {
    store.reset();

    const deactMobile = '9876599999'; // Seeded Deactivated customer
    const res = await request('POST', '/api/auth/otp/request', { mobile: deactMobile });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'This number is not registered. Please contact the factory.');
    assert.strictEqual(res.body.otp, undefined, 'No OTP should be sent for deactivated accounts');
  });

  // L4: Many OTP requests from one number or device -> Rate limited
  await test('L4', 'Many OTP requests from one number or device -> Rate limited', async () => {
    store.reset();

    const mobile = '9876500001';
    const deviceId = 'test-device-rate-limit';

    // Exhaust 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request('POST', '/api/auth/otp/request', { mobile, deviceId });
      assert.strictEqual(res.status, 200);
    }

    // 6th attempt must be rate limited (429)
    const rateLimitedRes = await request('POST', '/api/auth/otp/request', { mobile, deviceId });
    assert.strictEqual(rateLimitedRes.status, 429);
    assert.strictEqual(rateLimitedRes.body.success, false);
    assert.ok(rateLimitedRes.body.error.toLowerCase().includes('too many otp requests'));
  });

  // L5: Add the same number to two sections -> Blocked
  await test('L5', 'Add the same number to two sections -> Blocked', async () => {
    store.reset();

    const sharedMobile = '9876511223';

    // 1. Add to Factory section
    const res1 = await request('POST', '/api/admin/sections/factory/customers', {
      mobile: sharedMobile,
      name: 'Dual Register Attempt'
    }, ADMIN_AUTH);
    assert.strictEqual(res1.status, 201);

    // 2. Attempt to add same number to Shopkeepers section -> Blocked 400
    const res2 = await request('POST', '/api/admin/sections/shopkeeper/customers', {
      mobile: sharedMobile,
      name: 'Dual Register Attempt 2'
    }, ADMIN_AUTH);
    assert.strictEqual(res2.status, 400);
    assert.strictEqual(res2.body.success, false);
    assert.ok(res2.body.error.includes('already registered under factory section'));
  });

  // L6: Guest checkout in Regular section -> Still works with no login
  await test('L6', 'Guest checkout in Regular section -> Still works with no login', async () => {
    store.reset();

    const guestCart = [
      { id: 'p1', quantity: 2 }
    ];

    // Guest validates cart with no auth headers
    const valRes = await request('POST', '/api/cart/validate', { items: guestCart });
    assert.strictEqual(valRes.status, 200);
    assert.strictEqual(valRes.body.is_valid, true);

    // Guest initiates checkout
    const checkoutRes = await request('POST', '/api/checkout/start', {
      items: guestCart,
      customer: {
        name: 'Guest Retail Buyer',
        mobile: '9845099887',
        address: 'MG Road, Bengaluru'
      }
    });
    assert.strictEqual(checkoutRes.status, 200);
    assert.strictEqual(checkoutRes.body.success, true);
    assert.ok(checkoutRes.body.reservationId);
    assert.strictEqual(checkoutRes.body.summary.grand_total, 360 + 40); // 2 * 180 + delivery
  });

  // L7: Registered regular customer logs in -> Sees their Special price
  await test('L7', 'Registered regular customer logs in -> Sees their Special price', async () => {
    store.reset();

    // 1. Unauthenticated/Guest sees Standard retail price for buns (p2 @ ₹20/bun or retail pack ₹140)
    const guestPrices = await request('GET', '/api/prices');
    assert.strictEqual(guestPrices.status, 200);
    const guestP2 = guestPrices.body.products.find(p => p.id === 'p2');
    assert.strictEqual(guestP2.price, 20, 'Guest retail price for bun is ₹20');

    // 2. Log in as Regular customer on Special list (cust-reg-spc has Special price ₹18 for p2)
    const loginRes = await request('POST', '/api/auth/otp/verify', { mobile: '9876500003', otp: '123456' });
    assert.strictEqual(loginRes.status, 200);
    const token = loginRes.body.token;

    // 3. Fetch resolved prices with customer auth token
    const authPrices = await request('GET', '/api/prices', null, { 'Authorization': `Bearer ${token}` });
    assert.strictEqual(authPrices.status, 200);
    assert.strictEqual(authPrices.body.customer.section, 'regular');
    assert.strictEqual(authPrices.body.customer.price_list_id, 'pl-reg-spc-1');

    const specialP2 = authPrices.body.products.find(p => p.id === 'p2');
    assert.strictEqual(specialP2.price, 18, 'Special regular customer must see custom rate ₹18 for p2');
    assert.strictEqual(specialP2.price_source, 'special');
  });

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

// Start test server using named pipe (sandbox friendly, zero permissions needed)
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
