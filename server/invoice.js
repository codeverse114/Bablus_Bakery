/**
 * BACKREY BASES - PDF INVOICE & STATEMENT GENERATOR
 * Blueprint 3.12, Milestone 6 (Test I6) & Milestone 7 (Test R5)
 */

const PDFDocument = require('pdfkit');

/**
 * Generate Single Order Tax Invoice PDF (Blueprint 3.12 & Test I6)
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
  doc.text(`Name: ${order.customer.name || 'Valued Customer'}`, 55, yStart + 26);
  doc.text(`Mobile: +91 ${order.customer.mobile || '—'}`, 55, yStart + 39);
  doc.text(`Address: ${order.customer.address || '—'}`, 55, yStart + 52);

  doc.font('Helvetica-Bold').text('ORDER INFO:', 360, yStart + 10);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Order No: ${order.orderNo}`, 360, yStart + 26);
  doc.text(`Payment Ref: ${order.paymentId || 'PAID-ONLINE'}`, 360, yStart + 39);
  doc.text(`Channel: ${order.tag || 'Retail Storefront'}`, 360, yStart + 52);

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
  (order.items || []).forEach((item, idx) => {
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

  // Policy Notice (Blueprint 5.5: Orders are final after payment. No refund or cancel)
  doc.fontSize(8).font('Helvetica').fillColor('#9C8C83');
  doc.text('Terms & Conditions: Orders are fresh baked and final upon payment confirmation. Non-refundable.', 40, 750, { align: 'center' });
  doc.text('Computer-generated tax invoice. No physical signature required.', 40, 762, { align: 'center' });

  doc.end();
}

/**
 * Generate Wholesale Monthly Statement PDF (Blueprint 3.12 & Test R5)
 */
function generateMonthlyStatementPDF(wholesaler, month, orders, streamOrRes) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(streamOrRes);

  // Header
  doc.rect(40, 40, 515, 60).fill('#2D231E');
  doc.fillColor('#FEF3C7').font('Helvetica-Bold').fontSize(18).text('BACKREY BASES', 55, 52);
  doc.fillColor('#D3C3B8').font('Helvetica').fontSize(9).text('Wholesale Shopkeeper Monthly Statement', 55, 75);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(month || 'Consolidated Statement', 420, 54, { align: 'right' });
  doc.font('Helvetica').fontSize(9).text(`Account #: ${wholesaler.id}`, 420, 72, { align: 'right' });

  // Shopkeeper Info
  const yStart = 115;
  doc.rect(40, yStart, 515, 55).strokeColor('#E8DDD2').stroke();
  doc.fillColor('#2D231E').font('Helvetica-Bold').fontSize(10).text(`SHOP: ${wholesaler.shop_name}`, 55, yStart + 10);
  doc.font('Helvetica').fontSize(9).fillColor('#6B5B52');
  doc.text(`Owner: ${wholesaler.owner_name} | Mobile: +91 ${wholesaler.mobile}`, 55, yStart + 24);
  doc.text(`Address: ${wholesaler.address}, ${wholesaler.state} | GSTIN: ${wholesaler.gstin || 'Not registered'}`, 55, yStart + 37);

  // Table
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

  // Monthly Summary Box
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
 * Generate Wholesale Monthly Statement CSV (Blueprint 3.12 & Test R5)
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

module.exports = {
  generateInvoicePDF,
  generateMonthlyStatementPDF,
  generateMonthlyStatementCSV
};
