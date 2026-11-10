/**
 * BACKREY BASES - CHECKOUT CONTROLLER
 * Blueprint 3.5 (Checkout Guest) & 3.6 (Payment Result)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const checkoutItemsList = document.getElementById('checkoutItemsList');
  const chkSubtotal = document.getElementById('chkSubtotal');
  const chkDelivery = document.getElementById('chkDelivery');
  const chkTax = document.getElementById('chkTax');
  const chkGrandTotal = document.getElementById('chkGrandTotal');
  const btnPayNow = document.getElementById('btnPayNow');
  const payBtnText = document.getElementById('payBtnText');
  const holdBannerArea = document.getElementById('holdBannerArea');
  const checkoutFormContainer = document.getElementById('checkoutFormContainer');
  const paymentResultArea = document.getElementById('paymentResultArea');

  // Form Fields & Inline Errors
  const custName = document.getElementById('custName');
  const custMobile = document.getElementById('custMobile');
  const custEmail = document.getElementById('custEmail');
  const custAddress = document.getElementById('custAddress');
  const custPincode = document.getElementById('custPincode');
  const custLandmark = document.getElementById('custLandmark');
  const custCity = document.getElementById('custCity');
  const custNotes = document.getElementById('custNotes');

  const errName = document.getElementById('errName');
  const errMobile = document.getElementById('errMobile');
  const errAddress = document.getElementById('errAddress');
  const errPincode = document.getElementById('errPincode');

  // Razorpay Simulation Modal
  const rzpModalBackdrop = document.getElementById('rzpModalBackdrop');
  const rzpAmount = document.getElementById('rzpAmount');
  const rzpCountdown = document.getElementById('rzpCountdown');
  const btnSimulateSuccess = document.getElementById('btnSimulateSuccess');
  const btnSimulateFailure = document.getElementById('btnSimulateFailure');
  const btnSimulatePending = document.getElementById('btnSimulatePending');
  const btnCancelModal = document.getElementById('btnCancelModal');

  let activeReservation = null;
  let timerInterval = null;
  let remainingSeconds = 600; // 10 minutes (Blueprint Rule 3)

  function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Load & Re-verify Cart
  const cartState = window.cartManager.getState();
  if (!cartState.items || cartState.items.length === 0) {
    window.location.href = '/';
    return;
  }

  const validatedCart = await window.cartManager.revalidateWithServer();
  if (validatedCart && validatedCart.price_changed && validatedCart.notices && validatedCart.notices.length > 0) {
    showToast(`Price Updated: ${validatedCart.notices[0]}`, 'error');
  } else if (!validatedCart || !validatedCart.is_valid) {
    showToast('Your cart contains out-of-stock or invalid items.', 'error');
  }

  renderCheckoutSummary(validatedCart);

  // Pre-fill saved wholesale address if logged in (Blueprint 3.10)
  const savedWholesale = localStorage.getItem('backrey_wholesale_user');
  if (savedWholesale) {
    try {
      const wProfile = JSON.parse(savedWholesale);
      if (wProfile.owner_name && !custName.value) custName.value = wProfile.owner_name;
      if (wProfile.mobile && !custMobile.value) custMobile.value = wProfile.mobile;
      if (wProfile.email && !custEmail.value) custEmail.value = wProfile.email;
      if (wProfile.address && !custAddress.value) custAddress.value = wProfile.address;
      if (wProfile.state && !custCity.value) custCity.value = wProfile.state;
      showToast(`Saved wholesale address loaded for ${wProfile.shop_name}`);
    } catch (e) {}
  }

  function renderCheckoutSummary(validated) {
    checkoutItemsList.innerHTML = '';
    const items = validated ? validated.items : [];

    items.forEach(item => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.fontSize = '0.9rem';
      row.innerHTML = `
        <div>
          <div style="font-weight:700;">${item.name}</div>
          <div style="font-size:0.75rem;color:var(--color-text-muted);">${item.pack_size || ''} × ${item.quantity}</div>
        </div>
        <div style="font-weight:800;font-family:var(--font-family-display);">
          ${window.API.formatINR(item.total)}
        </div>
      `;
      checkoutItemsList.appendChild(row);
    });

    const subtotal = validated ? validated.subtotal : 0;
    const delivery = validated ? validated.delivery_charge : 0;
    const grand = validated ? validated.grand_total : 0;

    chkSubtotal.textContent = window.API.formatINR(subtotal);
    chkDelivery.textContent = delivery === 0 ? 'Free' : window.API.formatINR(delivery);
    chkTax.textContent = '—'; // GST blank as per Rule 6
    chkGrandTotal.textContent = window.API.formatINR(grand);
    rzpAmount.textContent = window.API.formatINR(grand);
  }

  // Real-time input validation (Blueprint 3.5: inline plain language)
  custMobile.addEventListener('input', () => {
    custMobile.value = custMobile.value.replace(/\D/g, '').slice(0, 10);
    if (custMobile.value.length === 10) {
      errMobile.style.display = 'none';
      custMobile.classList.remove('input-error');
    }
  });

  custName.addEventListener('input', () => {
    if (custName.value.trim().length >= 2) {
      errName.style.display = 'none';
      custName.classList.remove('input-error');
    }
  });

  custAddress.addEventListener('input', () => {
    if (custAddress.value.trim().length >= 5) {
      errAddress.style.display = 'none';
      custAddress.classList.remove('input-error');
    }
  });

  custPincode.addEventListener('input', () => {
    custPincode.value = custPincode.value.replace(/\D/g, '').slice(0, 6);
    if (custPincode.value.length === 6) {
      errPincode.style.display = 'none';
      custPincode.classList.remove('input-error');
    }
  });

  function validateAddressForm() {
    let valid = true;

    if (!custName.value.trim() || custName.value.trim().length < 2) {
      errName.style.display = 'block';
      custName.classList.add('input-error');
      valid = false;
    } else {
      errName.style.display = 'none';
      custName.classList.remove('input-error');
    }

    const cleanPhone = custMobile.value.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      errMobile.textContent = 'Enter a 10-digit mobile number.';
      errMobile.style.display = 'block';
      custMobile.classList.add('input-error');
      valid = false;
    } else {
      errMobile.style.display = 'none';
      custMobile.classList.remove('input-error');
    }

    if (!custAddress.value.trim() || custAddress.value.trim().length < 5) {
      errAddress.style.display = 'block';
      custAddress.classList.add('input-error');
      valid = false;
    } else {
      errAddress.style.display = 'none';
      custAddress.classList.remove('input-error');
    }

    const cleanPincode = custPincode.value.replace(/\D/g, '');
    if (!cleanPincode || cleanPincode.length !== 6) {
      errPincode.style.display = 'block';
      custPincode.classList.add('input-error');
      valid = false;
    } else {
      errPincode.style.display = 'none';
      custPincode.classList.remove('input-error');
    }

    return valid;
  }

  // 10-Minute Countdown Timer (Blueprint 3.5 & Rule 3)
  function startHoldTimer(durationSeconds) {
    clearInterval(timerInterval);
    remainingSeconds = durationSeconds;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      remainingSeconds--;
      updateTimerDisplay();

      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        handleHoldExpired();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const timerValEl = document.getElementById('timerVal');
    if (timerValEl) {
      timerValEl.textContent = timeStr;
      if (remainingSeconds < 120) {
        timerValEl.classList.add('urgent');
      }
    }
    rzpCountdown.textContent = timeStr;
  }

  function renderHoldBanner() {
    holdBannerArea.innerHTML = `
      <div class="hold-timer-banner">
        <div class="timer-left">
          <span class="timer-icon">⏱️</span>
          <div>
            <div class="timer-title">Stock Reserved for Checkout</div>
            <div class="timer-sub">Items held securely for 10 minutes. Complete payment before the timer expires.</div>
          </div>
        </div>
        <div class="timer-countdown" id="timerVal">10:00</div>
      </div>
    `;
  }

  function handleHoldExpired() {
    closeRazorpayModal();
    holdBannerArea.innerHTML = `
      <div class="cart-alert-box" style="margin-bottom: 20px;">
        ⚠️ Your 10-minute stock hold has expired. Stock has been released. Please review your cart to try again.
      </div>
    `;
    btnPayNow.disabled = false;
    payBtnText.textContent = 'Pay Now (Razorpay UPI / Card)';
    activeReservation = null;
  }

  // Tapping "Pay Now"
  btnPayNow.addEventListener('click', async () => {
    if (!validateAddressForm()) {
      showToast('Please fix the highlighted fields in your delivery address.', 'error');
      return;
    }

    btnPayNow.disabled = true;
    payBtnText.textContent = 'Reserving Stock & Connecting...';

    try {
      const itemsPayload = window.cartManager.getState().items.map(i => ({
        id: i.id,
        quantity: i.quantity
      }));

      const customerPayload = {
        name: custName.value.trim(),
        mobile: custMobile.value.replace(/\D/g, ''),
        email: custEmail.value.trim(),
        address: `${custAddress.value.trim()}, Pincode: ${custPincode.value.trim()}`,
        landmark: custLandmark.value.trim(),
        city: custCity.value.trim(),
        notes: custNotes.value.trim()
      };

      const isTaggedInShop = localStorage.getItem('backrey_order_tag') === 'In-shop' || new URLSearchParams(window.location.search).get('tag') === 'in-shop';

      // Call POST /api/checkout/start
      const res = await window.API.startCheckout(itemsPayload, customerPayload, isTaggedInShop);

      activeReservation = res;
      renderHoldBanner();
      startHoldTimer(res.holdSeconds || 600);
      openRazorpayModal();

    } catch (err) {
      showToast(err.message || 'Could not initiate checkout.', 'error');
      btnPayNow.disabled = false;
      payBtnText.textContent = 'Pay Now (Razorpay UPI / Card)';
    }
  });

  function openRazorpayModal() {
    rzpModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeRazorpayModal() {
    rzpModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  btnCancelModal.addEventListener('click', async () => {
    if (activeReservation) {
      await window.API.cancelCheckout(activeReservation.reservationId);
    }
    clearInterval(timerInterval);
    closeRazorpayModal();
    holdBannerArea.innerHTML = '';
    btnPayNow.disabled = false;
    payBtnText.textContent = 'Pay Now (Razorpay UPI / Card)';
    showToast('Stock hold released. Your cart is intact.');
  });

  // SIMULATE SUCCESSFUL PAYMENT (Blueprint 3.6 & Test G4)
  btnSimulateSuccess.addEventListener('click', async () => {
    if (!activeReservation) return;

    btnSimulateSuccess.disabled = true;
    btnSimulateSuccess.textContent = 'Processing Webhook...';

    try {
      const webhookPayload = {
        reservationId: activeReservation.reservationId,
        paymentId: 'pay_test_' + Date.now(),
        paymentSignature: 'sig_valid_' + Math.random().toString(36).substring(7),
        simulatedStatus: 'success'
      };

      const res = await window.API.submitPaymentWebhook(webhookPayload);

      clearInterval(timerInterval);
      closeRazorpayModal();
      window.cartManager.clearCart(); // Clear local cart upon verified order
      renderSuccessScreen(res.order);

    } catch (err) {
      showToast(err.message, 'error');
      btnSimulateSuccess.disabled = false;
      btnSimulateSuccess.textContent = '✓ Pay Successfully (Test UPI / Card)';
    }
  });

  // SIMULATE FAILED PAYMENT (Blueprint 3.6 & Test G5)
  btnSimulateFailure.addEventListener('click', async () => {
    if (!activeReservation) return;

    try {
      await window.API.submitPaymentWebhook({
        reservationId: activeReservation.reservationId,
        simulatedStatus: 'failure'
      });
    } catch (e) {
      // Expected failure
    }

    clearInterval(timerInterval);
    closeRazorpayModal();
    holdBannerArea.innerHTML = '';
    renderFailureScreen();
  });

  // SIMULATE PENDING PAYMENT (Blueprint 3.6)
  btnSimulatePending.addEventListener('click', async () => {
    if (!activeReservation) return;

    try {
      await window.API.submitPaymentWebhook({
        reservationId: activeReservation.reservationId,
        simulatedStatus: 'pending'
      });
    } catch (e) {}

    clearInterval(timerInterval);
    closeRazorpayModal();
    renderPendingScreen();
  });

  // =========================================
  // PAYMENT RESULT SCREENS (Blueprint 3.6)
  // =========================================
  function renderSuccessScreen(order) {
    checkoutFormContainer.style.display = 'none';
    holdBannerArea.innerHTML = '';
    paymentResultArea.style.display = 'block';

    paymentResultArea.innerHTML = `
      <div class="checkout-card confirmation-card">
        <div class="conf-icon-wrap">✓</div>
        <h1 class="font-heading" style="font-size:1.6rem;margin-bottom:6px;">Order Confirmed!</h1>
        <p style="color:var(--color-text-muted);font-size:0.95rem;">
          Thank you for choosing Backrey Bases. Your batch is queued for baking!
        </p>

        <div class="order-badge-pill" id="confirmedOrderNo">Order #${order.orderNo}</div>

        <div style="background:var(--color-surface-alt);border-radius:var(--radius-md);padding:18px;margin:20px 0;text-align:left;">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:0.9rem;">
            <span style="color:var(--color-text-muted);">Total Paid</span>
            <strong style="font-family:var(--font-family-display);font-size:1.1rem;">${window.API.formatINR(order.grand_total)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:0.9rem;">
            <span style="color:var(--color-text-muted);">Expected Delivery</span>
            <strong>${order.expectedDelivery || 'Tomorrow by 6:00 PM'}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
            <span style="color:var(--color-text-muted);">Delivery To</span>
            <span style="text-align:right;max-width:240px;">${order.customer.name}, ${order.customer.address}</span>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:24px;">
          <a href="/track.html?orderNo=${order.orderNo}&phone=${order.customer.mobile}" class="btn-primary" id="btnTrackOrderConfirmed">
            Track Order Status
          </a>
          <a href="/api/invoices/${order.orderNo}" class="btn-whatsapp" id="btnDownloadInvoicePrep" target="_blank" download="Invoice-${order.orderNo}.pdf">
            📄 Download Invoice (PDF)
          </a>
        </div>

        <p style="font-size:0.8rem;color:var(--color-stock-in);font-weight:600;margin-top:20px;">
          ✓ Confirmation sent by SMS & WhatsApp to +91 ${order.customer.mobile}
        </p>
      </div>
    `;
  }

  function renderFailureScreen() {
    checkoutFormContainer.style.display = 'none';
    paymentResultArea.style.display = 'block';

    paymentResultArea.innerHTML = `
      <div class="checkout-card confirmation-card">
        <div class="conf-icon-wrap" style="background:#FEE2E2;color:#DC2626;">✕</div>
        <h1 class="font-heading" style="font-size:1.6rem;margin-bottom:6px;">Payment Failed or Cancelled</h1>
        <p style="color:var(--color-text-muted);font-size:0.95rem;max-width:440px;margin:0 auto 16px;">
          Your payment could not be processed. The reserved inventory has been safely returned to stock.
        </p>

        <div class="cart-alert-box" style="margin: 16px auto; max-width: 440px; text-align: left;">
          ✓ Your shopping cart has been kept intact. You can try again with another payment method.
        </div>

        <button class="btn-primary" id="btnTryAgain" style="margin: 20px auto 0;">
          Try Again
        </button>
      </div>
    `;

    document.getElementById('btnTryAgain').addEventListener('click', () => {
      paymentResultArea.style.display = 'none';
      checkoutFormContainer.style.display = 'grid';
      btnPayNow.disabled = false;
      payBtnText.textContent = 'Pay Now (Razorpay UPI / Card)';
    });
  }

  function renderPendingScreen() {
    checkoutFormContainer.style.display = 'none';
    paymentResultArea.style.display = 'block';

    paymentResultArea.innerHTML = `
      <div class="checkout-card confirmation-card">
        <div class="conf-icon-wrap" style="background:#FEF3C7;color:#D97706;">⏳</div>
        <h1 class="font-heading" style="font-size:1.6rem;margin-bottom:6px;">Payment Verification Pending</h1>
        <p style="color:var(--color-text-muted);font-size:0.95rem;max-width:440px;margin:0 auto 16px;">
          Your bank is taking longer than usual to confirm the transaction. Please do not re-pay.
        </p>

        <p style="font-size:0.85rem;color:var(--color-text);line-height:1.6;margin-bottom:20px;">
          Final confirmation is handled automatically via payment webhook. We will notify you via WhatsApp & SMS once received.
        </p>

        <a href="/" class="btn-primary" style="margin: 0 auto;">Return to Home</a>
      </div>
    `;
  }
});
