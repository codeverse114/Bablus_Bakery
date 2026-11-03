/**
 * BACKREY BASES - AUTOMATED TEST SUITE FOR MILESTONES 6, 7 & 8
 * Tests: I6 (Invoice PDF), R5 (Wholesale Statement), Q1/Q2 (QR In-Shop Tagging)
 */

const assert = require('assert');
const http = require('http');
const app = require('../server/server');
const store = require('../server/store');

let server;
const PORT = 3004;

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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let json = null;
        if (contentType.includes('application/json')) {
          try {
            json = JSON.parse(buffer.toString('utf-8'));
          } catch (e) {}
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || buffer.toString('utf-8'),
          rawBuffer: buffer
        });
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING BACKREY BASES TEST SUITE: M6, M7, M8 (I6, R5, Q1/Q2)');
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

  // TEST I6: Download invoice from confirmation -> PDF downloads
  await test('I6', 'Download invoice from confirmation -> PDF downloads', async () => {
    store.reset();
    
    // Seed confirmed order
    const orderNo = 'BB-778899';
    store.orders.push({
      orderNo,
      reservationId: 'RES-I6',
      paymentId: 'pay_i6',
      customer: { name: 'Kavita Nair', mobile: '9845099887', address: 'Indiranagar 12th Main' },
      items: [
        { id: 'p1', name: 'Artisanal Sourdough Pizza Base', pack_size: 'Pack of 2 bases', unit_price: 180, quantity: 2, total: 360 }
      ],
      subtotal: 360,
      delivery_charge: 40,
      tax_gst: 0,
      grand_total: 400,
      status: 'Paid',
      createdAt: new Date().toISOString()
    });

    const res = await request('GET', `/api/invoices/${orderNo}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/pdf'), 'Content-Type must be application/pdf');
    assert.ok(res.headers['content-disposition'].includes(`Invoice-${orderNo}.pdf`), 'Must have PDF attachment disposition');
    
    // PDF Magic Number Check (%PDF- in binary buffer)
    const magic = res.rawBuffer.slice(0, 5).toString('utf-8');
    assert.strictEqual(magic, '%PDF-', 'Downloaded binary stream must be a valid PDF format');
  });

  // TEST R5: Wholesaler downloads statement -> Only own data
  await test('R5', 'Wholesaler downloads statement -> Only own data', async () => {
    store.reset();

    // Wholesaler 1 order (Marco Rossi)
    store.orders = [
      {
        orderNo: 'BB-WH1-ORDER',
        wholesalerId: 'wh-1',
        customer: { name: 'Marco Rossi', mobile: '9876543210' },
        items: [{ id: 'p1', name: 'Sourdough Pizza Base', unit_price: 120, quantity: 15, total: 1800 }],
        subtotal: 1800,
        delivery_charge: 0,
        tax_gst: 0,
        grand_total: 1800,
        status: 'Paid',
        createdAt: '2026-10-20T10:00:00.000Z'
      },
      // Wholesaler 2 order (Competitor)
      {
        orderNo: 'BB-WH2-COMPETITOR',
        wholesalerId: 'wh-2',
        customer: { name: 'Secret Competitor', mobile: '9111222333' },
        items: [{ id: 'p2', name: 'Brioche Burger Buns', unit_price: 95, quantity: 50, total: 4750 }],
        subtotal: 4750,
        delivery_charge: 0,
        tax_gst: 0,
        grand_total: 4750,
        status: 'Paid',
        createdAt: '2026-10-21T10:00:00.000Z'
      }
    ];

    // Wholesaler 1 downloads CSV statement
    const csvRes = await request('GET', '/api/wholesale/statement?month=October%202026&format=csv', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.headers['content-type'].includes('text/csv'));
    
    const csvContent = csvRes.body;
    assert.ok(csvContent.includes('BB-WH1-ORDER'), 'Wholesaler 1 must see own order');
    assert.ok(csvContent.includes('1800'), 'Wholesaler 1 must see own total');
    
    // Strict isolation assertion: Wholesaler 1 MUST NOT see Wholesaler 2's order
    assert.strictEqual(csvContent.includes('BB-WH2-COMPETITOR'), false, 'Wholesaler must NOT see competitor order');
    assert.strictEqual(csvContent.includes('Secret Competitor'), false, 'Wholesaler must NOT see competitor name');
    assert.strictEqual(csvContent.includes('4750'), false, 'Wholesaler must NOT see competitor total');

    // Wholesaler 1 downloads PDF statement
    const pdfRes = await request('GET', '/api/wholesale/statement?month=October%202026&format=pdf', null, { 'x-wholesale-token': 'wh-1' });
    assert.strictEqual(pdfRes.status, 200);
    assert.ok(pdfRes.headers['content-type'].includes('application/pdf'));
    const pdfMagic = pdfRes.rawBuffer.slice(0, 5).toString('utf-8');
    assert.strictEqual(pdfMagic, '%PDF-');
  });

  // TEST Q1/Q2: Scan QR and pay -> Order tagged In-shop
  await test('Q1/Q2', 'Scan QR and pay -> Order tagged In-shop', async () => {
    store.reset();

    // 1. Scan QR code short link
    const qrRes = await request('GET', '/qr');
    assert.strictEqual(qrRes.status, 302, 'QR link must redirect');
    assert.ok(qrRes.headers['location'].includes('tag=in-shop'), 'Must redirect to products tagged as In-shop');

    // 2. Guest places order with inShop: true flag
    const chkRes = await request('POST', '/api/checkout/start', {
      items: [{ id: 'p1', quantity: 1 }],
      customer: { name: 'Dine-In Customer', mobile: '9900112233', address: 'Table 4, In-Shop Bakery' },
      inShop: true
    });
    assert.strictEqual(chkRes.status, 200);
    const reservationId = chkRes.body.reservationId;

    // 3. Webhook confirms payment
    const payRes = await request('POST', '/api/payments/webhook', {
      reservationId,
      paymentId: 'pay_qr_table4',
      simulatedStatus: 'success'
    });
    assert.strictEqual(payRes.status, 200);
    
    // Crucial check: Order must be tagged 'In-shop'
    assert.strictEqual(payRes.body.order.tag, 'In-shop', 'Order must be tagged In-shop');

    const retrievedOrder = store.getOrder(payRes.body.order.orderNo, '9900112233');
    assert.strictEqual(retrievedOrder.tag, 'In-shop');
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
