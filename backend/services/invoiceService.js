/**
 * BACKREY BASES - PDF & CSV INVOICE SERVICE
 * Generates Tax Invoices, Packing Slips, and Consolidated Monthly Statements.
 */

const PDFDocument = require('pdfkit');

/**
 * Generate Single Order Tax Invoice PDF (Blueprint Customer 3.12 & Admin 3.12)
 */
function generateInvoicePDF(order, streamOrRes) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(streamOrRes);

  // Brand Header
  doc.rect(40, 40, 515, 65).fill('#FFF8F0');
  
  doc.fillColor('#C05621').font('Helvetica-Bold').fontSize(22).text('BACKREY BASES', 55, 52);
  doc.fillColor('#74645A').font('Helvetica').fontSize(9).text('Artisanal Pizza Bases, Gourmet Burger Buns & Breads', 55, 78);
  doc.text('Indiranagar, Bengaluru, Karnataka | Phone: +91 8219775396', 55, 90);

  doc.fillColor('#2D231E').font('Helvetica-Bold').fontSize(16).text('TAX INVOICE', 420, 52, { align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#6B5B52');
  doc.text(`Invoice #: INV-${order.orderNo}`, 420, 74, { align: 'right' });
  doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 420, 88, { align: 'right' });

  doc.moveDown(3);

  // Billing Details Box
  const yStart = 125;
  doc.rect(40, yStart, 515, 75).strokeColor('#E8DDD2').stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#2D231E').text('BILLED TO / DELIVER TO:', 55, yStart + 10);
  doc.font('Helvetica').fontSize(9).fillColor('#2D231E');
  doc.text(`Name: ${order.customer?.name || 'Valued Customer'}`, 55, yStart + 26);
  doc.text(`Mobile: +91 ${order.customer?.mobile || '—'}`, 55, yStart + 39);
  doc.text(`Address: ${order.customer?.address || '—'}`, 55, yStart + 52);

  doc.font('Helvetica-Bold').text('ORDER INFO:', 360, yStart + 10);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Order No: ${order.orderNo}`, 360, yStart + 26);
  doc.text(`Payment Ref: ${order.paymentId || 'PAID-ONLINE'}`, 360, yStart + 39);
  doc.text(`Channel: ${order.channel || order.tag || 'Online'}`, 360, yStart + 52);

  // Table Headers
  const tableY = 220;
  doc.rect(40, tableY, 515, 24).fill('#F3ECE4');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#2D231E');
  doc.text('ITEM DESCRIPTION', 55, tableY + 7);
  doc.text('PACK SIZE', 270, tableY + 7);
  doc.text('RATE (INR)', 370, tableY + 7, { align: 'right' });
  doc.text('QTY', 440, tableY + 7, { align: 'center' });
  doc.text('AMOUNT (INR)', 540, tableY + 7, { align: 'right' });

  // Items List
  let curY = tableY + 30;
  (order.items || []).forEach((item) => {
    doc.font('Helvetica').fontSize(9).fillColor('#2D231E');
    doc.text(item.name, 55, curY);
    doc.fillColor('#6B5B52').text(item.pack_size || 'Standard', 270, curY);
    doc.text(`₹${item.unit_price}`, 370, curY, { align: 'right' });
    doc.text(String(item.quantity), 440, curY, { align: 'center' });
    doc.fillColor('#2D231E').text(`₹${item.total}`, 540, curY, { align: 'right' });

    curY += 22;
    doc.strokeColor('#F3ECE4').moveTo(40, curY - 4).lineTo(555, curY - 4).stroke();
  });

  // Totals Section
  curY += 10;
  doc.strokeColor('#E8DDD2').moveTo(340, curY).lineTo(555, curY).stroke();
  curY += 10;

  doc.font('Helvetica').fontSize(9).fillColor('#6B5B52');
  doc.text('Subtotal:', 340, curY);
  doc.text(`₹${order.subtotal}`, 540, curY, { align: 'right' });

  curY += 16;
  doc.text('Delivery Fee:', 340, curY);
  doc.text(order.delivery_charge === 0 ? 'Free' : `₹${order.delivery_charge}`, 540, curY, { align: 'right' });

  curY += 16;
  doc.text('GST / Tax (HSN on hold):', 340, curY);
  doc.text('—', 540, curY, { align: 'right' });

  curY += 20;
  doc.rect(340, curY - 4, 215, 26).fill('#FFF8F0');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#C05621');
  doc.text('Grand Total Paid:', 350, curY + 4);
  doc.text(`₹${order.grand_total}`, 540, curY + 4, { align: 'right' });

  // Policy Notice
  doc.fontSize(8).font('Helvetica').fillColor('#9C8C83');
  doc.text('Terms & Conditions: Orders are fresh baked and final upon payment confirmation. Non-refundable.', 40, 750, { align: 'center' });
  doc.text('Computer-generated tax invoice. Backrey Bases Commercial Kitchen.', 40, 762, { align: 'center' });

  doc.end();
}

/**
 * Generate Packing Slip PDF for Kitchen / Delivery (Blueprint Admin 3.7)
 */
function generatePackingSlipPDF(order, streamOrRes) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(streamOrRes);

  doc.font('Helvetica-Bold').fontSize(20).text('PACKING SLIP - KITCHEN COPY', 40, 40);
  doc.font('Helvetica').fontSize(10).text(`Order Number: ${order.orderNo}`, 40, 68);
  doc.text(`Date & Time: ${new Date(order.createdAt).toLocaleString('en-IN')}`, 40, 82);
  doc.text(`Channel: ${order.channel || 'Online'} | Type: ${order.tag || 'Retail'}`, 40, 96);

  doc.rect(40, 115, 515, 50).fill('#F3ECE4');
  doc.fillColor('#2D231E').font('Helvetica-Bold').fontSize(11).text('PACK FOR CUSTOMER:', 50, 125);
  doc.font('Helvetica').fontSize(10).text(`${order.customer?.name} (Ph: +91 ${order.customer?.mobile})`, 50, 140);

  let curY = 185;
  doc.font('Helvetica-Bold').fontSize(11).text('ITEMS TO PACK:', 40, curY);
  curY += 20;

  (order.items || []).forEach(item => {
    doc.font('Helvetica-Bold').fontSize(12).text(`[ ]  ${item.quantity} x  ${item.name} (${item.pack_size || ''})`, 50, curY);
    curY += 24;
  });

  if (order.internalNotes) {
    curY += 20;
    doc.font('Helvetica-Bold').fontSize(10).text(`Special Instructions / Notes:`, 40, curY);
    doc.font('Helvetica').fontSize(9).text(order.internalNotes, 40, curY + 14);
  }

  doc.end();
}

/**
 * Generate Wholesale Monthly Statement PDF (Blueprint Admin 3.11 & Customer 3.12)
 */
function generateMonthlyStatementPDF(wholesaler, month, orders, streamOrRes) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(streamOrRes);

  doc.rect(40, 40, 515, 60).fill('#2D231E');
  doc.fillColor('#FEF3C7').font('Helvetica-Bold').fontSize(18).text('BACKREY BASES', 55, 52);
  doc.fillColor('#D3C3B8').font('Helvetica').fontSize(9).text('Wholesale Shopkeeper Monthly Statement', 55, 75);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(month || 'Consolidated Statement', 420, 54, { align: 'right' });
  doc.font('Helvetica').fontSize(9).text(`Account #: ${wholesaler.id}`, 420, 72, { align: 'right' });

  const yStart = 115;
  doc.rect(40, yStart, 515, 55).strokeColor('#E8DDD2').stroke();
  doc.fillColor('#2D231E').font('Helvetica-Bold').fontSize(10).text(`SHOP: ${wholesaler.shop_name}`, 55, yStart + 10);
  doc.font('Helvetica').fontSize(9).fillColor('#6B5B52');
  doc.text(`Owner: ${wholesaler.owner_name} | Mobile: +91 ${wholesaler.mobile}`, 55, yStart + 24);
  doc.text(`Address: ${wholesaler.address}, ${wholesaler.state} | GSTIN: ${wholesaler.gstin || 'Not registered'}`, 55, yStart + 37);

  const tableY = 190;
  doc.rect(40, tableY, 515, 22).fill('#F3ECE4');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#2D231E');
  doc.text('DATE', 48, tableY + 6);
  doc.text('ORDER #', 105, tableY + 6);
  doc.text('PRODUCT', 170, tableY + 6);
  doc.text('RATE', 330, tableY + 6, { align: 'right' });
  doc.text('PIECES', 380, tableY + 6, { align: 'center' });
  doc.text('AMOUNT', 460, tableY + 6, { align: 'right' });
  doc.text('PAID', 545, tableY + 6, { align: 'right' });

  let curY = tableY + 28;
  let totalPieces = 0;
  let totalAmount = 0;

  orders.forEach(order => {
    const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    (order.items || []).forEach(item => {
      doc.font('Helvetica').fontSize(8).fillColor('#2D231E');
      doc.text(dateStr, 48, curY);
      doc.text(order.orderNo, 105, curY);
      doc.text(item.name.slice(0, 32), 170, curY);
      doc.text(`₹${item.unit_price}`, 330, curY, { align: 'right' });
      doc.text(String(item.quantity), 380, curY, { align: 'center' });
      doc.text(`₹${item.total}`, 460, curY, { align: 'right' });
      doc.text(`₹${item.total}`, 545, curY, { align: 'right' });

      totalPieces += item.quantity;
      totalAmount += item.total;
      curY += 18;
    });
  });

  curY += 15;
  doc.rect(40, curY, 515, 30).fill('#FFF8F0');
  doc.strokeColor('#E8DDD2').rect(40, curY, 515, 30).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#C05621');
  doc.text('MONTHLY TOTAL:', 55, curY + 9);
  doc.text(`Total Pieces: ${totalPieces} units`, 220, curY + 9);
  doc.text(`Total Paid: ₹${totalAmount}`, 540, curY + 9, { align: 'right' });

  doc.end();
}

/**
 * Generate Wholesale Monthly Statement CSV (Blueprint Admin 3.11 & Customer 3.12)
 */
function generateMonthlyStatementCSV(wholesaler, month, orders) {
  const rows = [
    ['Date', 'Order No', 'Product', 'Rate (INR)', 'Pieces (Qty)', 'Amount (INR)', 'GST', 'Amount Paid (INR)']
  ];

  let totalPieces = 0;
  let totalAmount = 0;

  orders.forEach(order => {
    const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
    (order.items || []).forEach(item => {
      rows.push([
        dateStr,
        order.orderNo,
        `"${item.name.replace(/"/g, '""')}"`,
        item.unit_price,
        item.quantity,
        item.total,
        '0',
        item.total
      ]);
      totalPieces += item.quantity;
      totalAmount += item.total;
    });
  });

  rows.push([]);
  rows.push(['MONTHLY TOTAL', '', '', '', totalPieces, totalAmount, '0', totalAmount]);
  return rows.map(r => r.join(',')).join('\n');
}

/**
 * Generate Consolidated Report CSV across all customers (Blueprint Admin 3.11 & Test R2)
 */
function generateConsolidatedReportCSV(orders, month) {
  const rows = [
    ['Order No', 'Date', 'Customer Name', 'Type', 'Channel', 'Total Items', 'Grand Total (INR)', 'Payment Mode', 'Status']
  ];

  let totalSales = 0;

  orders.forEach(o => {
    const totalItems = (o.items || []).reduce((sum, i) => sum + i.quantity, 0);
    rows.push([
      o.orderNo,
      new Date(o.createdAt).toLocaleDateString('en-IN'),
      `"${(o.customer?.name || '').replace(/"/g, '""')}"`,
      o.tag || 'Retail',
      o.channel || 'Online',
      totalItems,
      o.grand_total,
      o.paymentMode || 'Online',
      o.status || 'Paid'
    ]);
    totalSales += o.grand_total;
  });

  rows.push([]);
  rows.push(['CONSOLIDATED TOTAL SALES', '', '', '', '', '', totalSales, '', '']);
  return rows.map(r => r.join(',')).join('\n');
}

function getInvoicePDFBuffer(order) {
  return new Promise((resolve, reject) => {
    const { PassThrough } = require('stream');
    const pt = new PassThrough();
    const chunks = [];
    pt.on('data', chunk => chunks.push(chunk));
    pt.on('end', () => resolve(Buffer.concat(chunks)));
    pt.on('error', reject);
    generateInvoicePDF(order, pt);
  });
}

/**
 * Generate Monthly Invoices ZIP Archive (Blueprint Admin 3.11 & Test R4)
 */
async function generateInvoicesZipStream(orders, res) {
  const archiverMod = require('archiver');
  const ZipClass = archiverMod.ZipArchive || archiverMod.default || archiverMod;
  const archive = (typeof ZipClass === 'function' && ZipClass.prototype) 
    ? new ZipClass({ zlib: { level: 9 } }) 
    : (typeof archiverMod === 'function' ? archiverMod('zip', { zlib: { level: 9 } }) : new archiverMod.ZipArchive({ zlib: { level: 9 } }));

  archive.on('error', (err) => {
    console.error('Archiver error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  });

  archive.pipe(res);

  for (const order of orders) {
    const buffer = await getInvoicePDFBuffer(order);
    archive.append(buffer, { name: `Invoice-${order.orderNo}.pdf` });
  }

  await archive.finalize();
}

/**
 * Generate Printable QR Code Standee / Poster PDF (Blueprint 3.14)
 */
function generateQrPosterPDF(res, storeSettings = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  // Background frame
  doc.rect(40, 40, 515, 760).fill('#FFF8EC');
  doc.rect(50, 50, 495, 740).strokeColor('#C05621').lineWidth(3).stroke();

  // Header
  doc.font('Helvetica-Bold').fontSize(26).fillColor('#C05621').text('BACKREY BASES', 50, 90, { align: 'center' });
  doc.font('Helvetica').fontSize(12).fillColor('#74645A').text('Artisanal Pizza Bases & Gourmet Burger Buns', 50, 125, { align: 'center' });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#2D231E').text('SCAN HERE TO ORDER & PAY', 50, 175, { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('#74645A').text('Fast Counter Order • Skip the queue • Live Kitchen Hold', 50, 200, { align: 'center' });

  // QR Code Box Placeholder / Visual Frame
  const qrBoxSize = 240;
  const qrX = (595 - qrBoxSize) / 2;
  const qrY = 250;
  doc.rect(qrX, qrY, qrBoxSize, qrBoxSize).fill('#FFFFFF');
  doc.rect(qrX, qrY, qrBoxSize, qrBoxSize).strokeColor('#E8DDD2').lineWidth(2).stroke();

  // QR Visual Simulation Matrix
  doc.fillColor('#2D231E');
  doc.rect(qrX + 25, qrY + 25, 45, 45).fill();
  doc.rect(qrX + 170, qrY + 25, 45, 45).fill();
  doc.rect(qrX + 25, qrY + 170, 45, 45).fill();
  doc.rect(qrX + 90, qrY + 90, 60, 60).fill();

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#C05621').text('backreybases.in/qr', 50, 520, { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#74645A').text('Direct URL: http://localhost:3000/qr', 50, 540, { align: 'center' });

  // Instructions
  doc.rect(80, 580, 435, 120).fill('#FFFFFF');
  doc.rect(80, 580, 435, 120).strokeColor('#E8DDD2').stroke();

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#2D231E').text('HOW TO ORDER:', 100, 600);
  doc.font('Helvetica').fontSize(10).fillColor('#74645A');
  doc.text('1. Scan the code using your mobile camera or Google Lens / Pay.', 100, 622);
  doc.text('2. Pick your artisanal pizza bases, gourmet buns, or rustic loaves.', 100, 642);
  doc.text('3. Pay securely via UPI / Card. Pick up fresh from the bakery counter!', 100, 662);

  // Footer contact
  doc.font('Helvetica').fontSize(9).fillColor('#9C8C83');
  doc.text('Indiranagar, Bengaluru | WhatsApp: +91 8219775396 | support@backreybases.in', 50, 740, { align: 'center' });

  doc.end();
}

module.exports = {
  generateInvoicePDF,
  generatePackingSlipPDF,
  generateMonthlyStatementPDF,
  generateMonthlyStatementCSV,
  generateConsolidatedReportCSV,
  generateInvoicesZipStream,
  generateQrPosterPDF
};
