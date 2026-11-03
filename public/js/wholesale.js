/**
 * BACKREY BASES - WHOLESALE CONTROLLER
 * Blueprint 3.8 (Register & Login), 3.9 (Dashboard), 3.10 (Wholesale Cart), 3.11 (Order History)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Tabs & Views
  const authView = document.getElementById('authView');
  const dashboardView = document.getElementById('dashboardView');
  const tabBtnLogin = document.getElementById('tabBtnLogin');
  const tabBtnRegister = document.getElementById('tabBtnRegister');
  const wholesaleLoginForm = document.getElementById('wholesaleLoginForm');
  const wholesaleRegisterForm = document.getElementById('wholesaleRegisterForm');
  const btnHeaderLogout = document.getElementById('btnHeaderLogout');

  // Login inputs
  const loginIdentifier = document.getElementById('loginIdentifier');
  const loginPassword = document.getElementById('loginPassword');

  // Register inputs
  const regShopName = document.getElementById('regShopName');
  const regOwnerName = document.getElementById('regOwnerName');
  const regMobile = document.getElementById('regMobile');
  const regEmail = document.getElementById('regEmail');
  const regAddress = document.getElementById('regAddress');
  const regState = document.getElementById('regState');
  const regGSTIN = document.getElementById('regGSTIN');
  const regPassword = document.getElementById('regPassword');

  // Dashboard elements
  const dashShopName = document.getElementById('dashShopName');
  const dashOwnerMeta = document.getElementById('dashOwnerMeta');
  const btnQuickReorderLast = document.getElementById('btnQuickReorderLast');
  const lastOrderCard = document.getElementById('lastOrderCard');
  const lastOrderNo = document.getElementById('lastOrderNo');
  const lastOrderStatus = document.getElementById('lastOrderStatus');
  const lastOrderItemsList = document.getElementById('lastOrderItemsList');
  const lastOrderGrandTotal = document.getElementById('lastOrderGrandTotal');
  const btnRepeatLastOrder = document.getElementById('btnRepeatLastOrder');
  const ordersTableBody = document.getElementById('ordersTableBody');

  let currentWholesaleUser = null;
  let activeLastOrder = null;

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

  // Check existing session
  const token = localStorage.getItem('backrey_wholesale_token');
  if (token) {
    loadDashboard(token);
  } else {
    showAuthView();
  }

  // Tab switching
  tabBtnLogin.addEventListener('click', () => {
    tabBtnLogin.classList.add('active');
    tabBtnRegister.classList.remove('active');
    wholesaleLoginForm.style.display = 'block';
    wholesaleRegisterForm.style.display = 'none';
  });

  tabBtnRegister.addEventListener('click', () => {
    tabBtnRegister.classList.add('active');
    tabBtnLogin.classList.remove('active');
    wholesaleLoginForm.style.display = 'none';
    wholesaleRegisterForm.style.display = 'block';
  });

  // LOGIN HANDLER (Blueprint 3.8)
  wholesaleLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = loginIdentifier.value.trim();
    const password = loginPassword.value;

    try {
      const res = await fetch('/api/wholesale/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Login failed. Please check credentials.', 'error');
        return;
      }

      localStorage.setItem('backrey_wholesale_token', data.token);
      localStorage.setItem('backrey_wholesale_user', JSON.stringify(data.wholesaler));
      showToast(`Welcome back, ${data.wholesaler.shop_name}!`);
      loadDashboard(data.token);

    } catch (err) {
      showToast('Network error during login.', 'error');
    }
  });

  // REGISTER HANDLER (Blueprint 3.8: Active immediately, no approval)
  wholesaleRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      shop_name: regShopName.value.trim(),
      owner_name: regOwnerName.value.trim(),
      mobile: regMobile.value.trim(),
      email: regEmail.value.trim(),
      address: regAddress.value.trim(),
      state: regState.value.trim(),
      gstin: regGSTIN.value.trim(),
      password: regPassword.value
    };

    try {
      const res = await fetch('/api/wholesale/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Registration failed.', 'error');
        return;
      }

      localStorage.setItem('backrey_wholesale_token', data.token);
      localStorage.setItem('backrey_wholesale_user', JSON.stringify(data.wholesaler));
      showToast('Wholesale account activated immediately! Welcome aboard.');
      loadDashboard(data.token);

    } catch (err) {
      showToast('Network error during registration.', 'error');
    }
  });

  // LOAD DASHBOARD (Blueprint 3.9)
  async function loadDashboard(authToken) {
    try {
      const res = await fetch('/api/wholesale/dashboard', {
        headers: { 'x-wholesale-token': authToken }
      });

      if (!res.ok) {
        logout();
        return;
      }

      const data = await res.json();
      currentWholesaleUser = data.profile;
      activeLastOrder = data.last_order;

      // Update UI
      authView.style.display = 'none';
      dashboardView.style.display = 'block';
      btnHeaderLogout.style.display = 'inline-flex';

      dashShopName.textContent = currentWholesaleUser.shop_name;
      dashOwnerMeta.textContent = `Owner: ${currentWholesaleUser.owner_name} • ${currentWholesaleUser.state} • Ph: +91 ${currentWholesaleUser.mobile}`;

      // Render Last Order card
      if (activeLastOrder) {
        lastOrderCard.style.display = 'block';
        btnQuickReorderLast.style.display = 'inline-flex';
        lastOrderNo.textContent = `Order #${activeLastOrder.orderNo}`;
        lastOrderStatus.textContent = activeLastOrder.status || 'Paid';
        lastOrderGrandTotal.textContent = window.API.formatINR(activeLastOrder.grand_total);

        lastOrderItemsList.innerHTML = '';
        (activeLastOrder.items || []).forEach(item => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.innerHTML = `
            <span>${item.name} (${item.pack_size || ''}) × ${item.quantity}</span>
            <strong>${window.API.formatINR(item.total)}</strong>
          `;
          lastOrderItemsList.appendChild(row);
        });
      } else {
        lastOrderCard.style.display = 'none';
        btnQuickReorderLast.style.display = 'none';
      }

      // Render Order History Table (Blueprint 3.11)
      renderOrderHistory(data.recent_orders || []);

    } catch (err) {
      console.error(err);
      showToast('Failed to load wholesale dashboard.', 'error');
    }
  }

  function renderOrderHistory(orders) {
    ordersTableBody.innerHTML = '';
    if (!orders || orders.length === 0) {
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-muted);">
            No previous wholesale orders found. Browse catalog to place your first batch order!
          </td>
        </tr>
      `;
      return;
    }

    orders.forEach(order => {
      const tr = document.createElement('tr');
      const dateStr = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const itemsSummary = (order.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');

      tr.innerHTML = `
        <td><strong>${order.orderNo}</strong></td>
        <td>${dateStr}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemsSummary}">${itemsSummary}</td>
        <td><strong>${window.API.formatINR(order.grand_total)}</strong></td>
        <td><span class="stock-badge badge-in-stock">${order.status || 'Paid'}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn-wholesale-link btn-table-reorder" data-orderno="${order.orderNo}" style="padding:4px 10px;min-height:30px;font-size:0.75rem;">
            Re-order
          </button>
          <a href="/api/invoices/${order.orderNo}" class="btn-wholesale-link" target="_blank" download="Invoice-${order.orderNo}.pdf" style="padding:4px 8px;min-height:30px;font-size:0.75rem;margin-left:4px;">
            📄 Invoice
          </a>
        </td>
      `;

      tr.querySelector('.btn-table-reorder').addEventListener('click', () => {
        executeReorder(order.orderNo);
      });

      ordersTableBody.appendChild(tr);
    });
  }

  // Monthly Statement Downloads (Blueprint 3.12 & Test R5)
  const selectStatementMonth = document.getElementById('selectStatementMonth');
  const btnDownloadStatementPdf = document.getElementById('btnDownloadStatementPdf');
  const btnDownloadStatementCsv = document.getElementById('btnDownloadStatementCsv');

  async function downloadStatement(format) {
    const authToken = localStorage.getItem('backrey_wholesale_token');
    const month = selectStatementMonth ? selectStatementMonth.value : 'All';
    showToast(`Generating ${month} statement in ${format.toUpperCase()}...`);

    try {
      const res = await fetch(`/api/wholesale/statement?month=${encodeURIComponent(month)}&format=${format}`, {
        headers: { 'x-wholesale-token': authToken }
      });

      if (!res.ok) {
        showToast('Failed to download statement', 'error');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Statement-${month.replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Statement downloaded successfully!`);
    } catch (err) {
      showToast('Error downloading statement', 'error');
    }
  }

  if (btnDownloadStatementPdf) {
    btnDownloadStatementPdf.addEventListener('click', () => downloadStatement('pdf'));
  }
  if (btnDownloadStatementCsv) {
    btnDownloadStatementCsv.addEventListener('click', () => downloadStatement('csv'));
  }

  // REORDER LOGIC (Blueprint 3.9 & Test W7: Re-order -> Cart refilled)
  async function executeReorder(orderNo) {
    const authToken = localStorage.getItem('backrey_wholesale_token');
    try {
      const res = await fetch(`/api/wholesale/reorder/${encodeURIComponent(orderNo)}`, {
        method: 'POST',
        headers: { 'x-wholesale-token': authToken }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Could not re-order this batch.', 'error');
        return;
      }

      // Refill cart items
      window.cartManager.clearCart();
      for (const item of data.items) {
        window.cartManager.addItem(item, item.quantity);
      }

      showToast(`Refilled cart with ${data.items.length} items from Order #${data.orderNo}!`);
      
      // Redirect to checkout with saved address pre-fill
      setTimeout(() => {
        window.location.href = '/checkout.html';
      }, 800);

    } catch (err) {
      showToast('Network error during re-order.', 'error');
    }
  }

  btnQuickReorderLast.addEventListener('click', () => {
    if (activeLastOrder) executeReorder(activeLastOrder.orderNo);
  });

  btnRepeatLastOrder.addEventListener('click', () => {
    if (activeLastOrder) executeReorder(activeLastOrder.orderNo);
  });

  function showAuthView() {
    authView.style.display = 'block';
    dashboardView.style.display = 'none';
    btnHeaderLogout.style.display = 'none';
  }

  function logout() {
    localStorage.removeItem('backrey_wholesale_token');
    localStorage.removeItem('backrey_wholesale_user');
    showAuthView();
    showToast('Logged out of wholesale portal.');
  }

  btnHeaderLogout.addEventListener('click', logout);
});
