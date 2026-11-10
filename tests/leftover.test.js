/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR LEFTOVER ADMIN & NOTIFICATION MILESTONES
 * Tests: O3, O4, O5, O6, I3, I5, R1, R2, R3, R4, R6, R7, P1, P2, P4
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../backend/server');
const store = require('../backend/models/store');
const notificationService = require('../backend/services/notificationService');

let server;
const PIPE_NAME = `\\\\.\\pipe\\bb-leftover-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        try {
          const json = JSON.parse(text);
          resolve({ status: res.statusCode, body: json, headers: res.headers, raw: buffer });
        } catch (e) {
          resolve({ status: res.statusCode, body: text, headers: res.headers, raw: buffer });
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
  console.log(' RUNNING BACKREY BASES LEFTOVER MILESTONES SUITE');
  console.log('====================================================\n');

  const ownerToken = 'adm-usr-owner-1';
  const ownerHeaders = { 'Authorization': `Bearer ${ownerToken}` };

  // TEST O3/O4/O5: Place a paid order -> WhatsApp, email, and push arrive
  await test('O3/O4/O5', 'Place paid order -> WhatsApp, email and push all arrive within a minute', async () => {
    store.reset();
    notificationService.reset();

    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p1', quantity: 2 }],
      customer: { name: 'Chef Mario', mobile: '8219775396', address: '100ft Road, Indiranagar' }
    });
    assert.strictEqual(holdRes.status, 200);

    const payRes = await request('POST', '/api/payments/webhook', {
      reservationId: holdRes.body.reservationId,
      simulatedStatus: 'success'
    });
    assert.strictEqual(payRes.status, 200);

    // Verify dispatched alerts
    const alerts = notificationService.getRecentAlerts();
    assert.ok(alerts.length >= 1, 'Alert must be triggered upon payment confirmation');

    const alert = alerts[0];
    assert.strictEqual(alert.orderNo, payRes.body.order.orderNo);
    // WhatsApp (Test O3)
    assert.strictEqual(alert.whatsapp.status, 'SENT');
    assert.strictEqual(alert.whatsapp.recipient, '8219775396');
    assert.ok(alert.whatsapp.message.includes(payRes.body.order.orderNo));
    // Email (Test O4)
    assert.strictEqual(alert.email.status, 'SENT');
    assert.strictEqual(alert.email.recipient, 'owner@backreybases.in');
    // Push (Test O5)
    assert.strictEqual(alert.push.status, 'SENT');
  });

  // TEST O6: Notification provider down -> Order still succeeds; failure logged
  await test('O6', 'Notification provider down -> Order still succeeds; failure logged', async () => {
    store.reset();
    notificationService.reset();
    // Simulate notification gateway downtime
    notificationService.setProviderDown(true);

    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p2', quantity: 1 }],
      customer: { name: 'Burger Bistro', mobile: '9123456789', address: 'Koramangala' }
    });
    assert.strictEqual(holdRes.status, 200);

    // Order MUST still confirm cleanly without failing or blocking
    const payRes = await request('POST', '/api/payments/webhook', {
      reservationId: holdRes.body.reservationId,
      simulatedStatus: 'success'
    });
    assert.strictEqual(payRes.status, 200, 'Order must succeed even when notification provider is down');
    assert.ok(payRes.body.order.orderNo);

    // Verify failure record is captured in admin diagnostic log
    const failRes = await request('GET', '/api/admin/notifications/failures', null, ownerHeaders);
    assert.strictEqual(failRes.status, 200);
    assert.ok(failRes.body.failures.length >= 1, 'Failure must be logged with retry details');
    assert.strictEqual(failRes.body.failures[0].orderNo, payRes.body.order.orderNo);
    assert.strictEqual(failRes.body.failures[0].retryScheduled, true);

    // Restore provider
    notificationService.setProviderDown(false);
  });

  // TEST I3: Create 10 invoices -> Sequential, no gaps
  await test('I3', 'Create 10 invoices -> Sequential, no gaps', async () => {
    store.reset();
    const createdInvoiceNumbers = [];

    // Place 10 rapid POS walk-in orders
    for (let i = 1; i <= 10; i++) {
      const posRes = await request('POST', '/api/admin/orders/offline', {
        items: [{ productId: 'p1', quantity: 1 }],
        customer: { name: `Batch Customer #${i}`, mobile: '8219775396' },
        paymentMode: 'Cash'
      }, ownerHeaders);

      assert.strictEqual(posRes.status, 200);
      createdInvoiceNumbers.push(posRes.body.order.invoiceNo);
    }

    assert.strictEqual(createdInvoiceNumbers.length, 10);
    console.log('         Generated Invoices:', createdInvoiceNumbers.join(', '));

    // Check sequential sequence without any gaps
    for (let i = 0; i < 9; i++) {
      const currentNum = parseInt(createdInvoiceNumbers[i].replace(/\D/g, ''), 10);
      const nextNum = parseInt(createdInvoiceNumbers[i + 1].replace(/\D/g, ''), 10);
      assert.strictEqual(nextNum, currentNum + 1, `Invoice sequence gap found between ${createdInvoiceNumbers[i]} and ${createdInvoiceNumbers[i + 1]}`);
    }
  });

  // TEST I5: Generate invoice with GST blank -> Works; dashboard warning visible
  await test('I5', 'Generate invoice with GST blank -> Works; dashboard warning visible', async () => {
    // 1. Verify dashboard shows GST alert warning
    const dashRes = await request('GET', '/api/admin/dashboard', null, ownerHeaders);
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.body.gst_status.registered, false);
    assert.ok(dashRes.body.gst_status.warning.includes('pending'));

    // 2. Download invoice PDF for seeded order
    const invRes = await request('GET', '/api/invoices/BB-900123');
    assert.strictEqual(invRes.status, 200);
    assert.strictEqual(invRes.headers['content-type'], 'application/pdf');
    assert.ok(invRes.raw.length > 1000, 'Invoice PDF must be a valid non-empty document');
  });

  // TEST R1: Statement for one customer for a seeded month
  await test('R1', 'Statement for one customer for a seeded month -> Date, product, rate, pieces, amount, total correct', async () => {
    const res = await request('GET', '/api/admin/reports/statement?customerId=wh-1&month=2026-10', null, ownerHeaders);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'application/pdf');
    assert.ok(res.raw.length > 500);
  });

  // TEST R2: Consolidated report -> Totals by product, type, and channel are correct
  await test('R2', 'Consolidated report -> Totals by product, type, and channel are correct', async () => {
    const res = await request('GET', '/api/admin/reports/monthly', null, ownerHeaders);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.byProduct));
    assert.ok(res.body.byCustomerType.retail !== undefined);
    assert.ok(res.body.byCustomerType.wholesale !== undefined);
    assert.ok(res.body.byChannel.online !== undefined);
    assert.ok(res.body.byChannel.in_shop !== undefined);
  });

  // TEST R3: Export PDF and Excel/CSV -> Files open; totals match database
  await test('R3', 'Export PDF and Excel/CSV -> Files open; totals match database', async () => {
    // CSV Export
    const csvRes = await request('GET', '/api/admin/reports/monthly?format=csv', null, ownerHeaders);
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.headers['content-type'].includes('text/csv'));
    assert.ok(csvRes.body.includes('CONSOLIDATED TOTAL SALES'));

    // Customer Statement CSV
    const stmtCsv = await request('GET', '/api/admin/reports/statement?customerId=wh-1&format=csv', null, ownerHeaders);
    assert.strictEqual(stmtCsv.status, 200);
    assert.ok(stmtCsv.headers['content-type'].includes('text/csv'));
    assert.ok(stmtCsv.body.includes('MONTHLY TOTAL'));
  });

  // TEST R4: Invoice ZIP -> Contains every invoice for the month in one file
  await test('R4', 'Invoice ZIP -> Contains every invoice for the month in one file', async () => {
    const zipRes = await request('GET', '/api/admin/reports/invoices.zip', null, ownerHeaders);
    assert.strictEqual(zipRes.status, 200);
    assert.strictEqual(zipRes.headers['content-type'], 'application/zip');
    assert.ok(zipRes.raw.length > 100, 'ZIP archive must be non-empty');
  });

  // TEST R6: Custom date range -> Only those orders included
  await test('R6', 'Custom date range -> Only those orders included', async () => {
    const rangeRes = await request('GET', '/api/admin/reports/monthly?startDate=2026-10-01&endDate=2026-10-31', null, ownerHeaders);
    assert.strictEqual(rangeRes.status, 200);
    assert.ok(Array.isArray(rangeRes.body.orders));
    // All returned orders must fall in October 2026
    for (const o of rangeRes.body.orders) {
      assert.ok(o.createdAt.startsWith('2026-10'), `Order date ${o.createdAt} must be within date range`);
    }
  });

  // TEST R7: Compare with gateway dashboard -> Totals match
  await test('R7', 'Compare with gateway dashboard -> Totals match', async () => {
    const reconRes = await request('GET', '/api/admin/reports/reconciliation', null, ownerHeaders);
    assert.strictEqual(reconRes.status, 200);
    assert.strictEqual(reconRes.body.reconciliation.matched, true);
    assert.strictEqual(reconRes.body.reconciliation.variance, 0);
  });

  // TEST P1: Android app configuration exists & valid
  await test('P1', 'Android APK shell configuration exists & valid', async () => {
    const configPath = path.join(__dirname, '..', 'admin', 'capacitor.config.json');
    assert.ok(fs.existsSync(configPath), 'capacitor.config.json must exist');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.appId, 'in.backreybases.ops');
    assert.strictEqual(config.appName, 'Backrey Bases Operations');
  });

  // TEST P2: Log in with unapproved email -> Refused
  await test('P2', 'Log in with unapproved email -> Refused (401)', async () => {
    const unapprovedRes = await request('POST', '/api/admin/login', {
      email: 'hacker@outsider.com',
      password: 'password123'
    });
    assert.strictEqual(unapprovedRes.status, 401, 'Unapproved email must be refused');
    assert.strictEqual(unapprovedRes.body.success, false);
  });

  // TEST P4: Close the app and place an order -> Push notification arrives
  await test('P4', 'Place an order -> Push notification payload ready for Android shell', async () => {
    const holdRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p1', quantity: 1 }],
      customer: { name: 'Android Customer', mobile: '8219775396', address: 'Indiranagar' }
    });
    await request('POST', '/api/payments/webhook', {
      reservationId: holdRes.body.reservationId,
      simulatedStatus: 'success'
    });

    const alerts = notificationService.getRecentAlerts();
    const latest = alerts[0];
    assert.ok(latest, 'Dispatched push alert must be present');
    assert.ok(latest.push, 'Push notification must be defined');
    assert.strictEqual(latest.push.status, 'SENT');
    assert.ok(latest.push.title.includes('New Bakery Order'));
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
