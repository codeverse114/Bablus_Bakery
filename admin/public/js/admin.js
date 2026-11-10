/**
 * BACKREY BASES - ADMIN & KITCHEN OPERATIONS CONTROLLER
 */

const API_BASE = '/api/admin';
let currentUser = null;
let currentProducts = [];
let currentInventory = [];
let posCart = [];
let posPaymentMode = 'Cash';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('bb_admin_token');
  const savedUser = localStorage.getItem('bb_admin_user');

  if (savedToken && savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      enterAppShell();
      return;
    } catch (e) {
      localStorage.removeItem('bb_admin_token');
      localStorage.removeItem('bb_admin_user');
    }
  }

  showLoginView();
});

// Auth helper
function getAuthHeaders() {
  const token = localStorage.getItem('bb_admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ==========================================
// LOGIN & AUTH
// ==========================================
function quickFillLogin(email, password) {
  document.getElementById('adminEmail').value = email;
  document.getElementById('adminPassword').value = password;
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('loginAlert');
  alertEl.style.display = 'none';

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alertEl.textContent = data.error || 'Login failed. Please check credentials.';
      alertEl.style.display = 'flex';
      return;
    }

    localStorage.setItem('bb_admin_token', data.token);
    localStorage.setItem('bb_admin_user', JSON.stringify(data.user));
    currentUser = data.user;

    enterAppShell();
  } catch (err) {
    alertEl.textContent = 'Server connection error. Please try again.';
    alertEl.style.display = 'flex';
  }
});

function logoutAdmin() {
  localStorage.removeItem('bb_admin_token');
  localStorage.removeItem('bb_admin_user');
  currentUser = null;
  showLoginView();
}

function showLoginView() {
  document.getElementById('loginView').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}

function enterAppShell() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';

  document.getElementById('currentUserName').textContent = currentUser.name || currentUser.email;
  const roleEl = document.getElementById('currentUserRole');
  roleEl.textContent = (currentUser.role || 'staff').toUpperCase();
  roleEl.className = `user-role-badge role-${currentUser.role}`;

  // Role-based UI gating (Security Rule 2 & Test X7)
  const isOwner = currentUser.role === 'owner';
  document.querySelectorAll('.owner-only').forEach(el => {
    el.style.display = isOwner ? 'flex' : 'none';
  });

  switchTab('dashboard');
}

// ==========================================
// TAB SWITCHING
// ==========================================
function switchTab(tabId) {
  // If staff tries to click an owner-only tab, deny
  if (['wholesale', 'reports', 'settings'].includes(tabId) && currentUser.role !== 'owner') {
    alert('Access Denied: Restricted to Owner role only.');
    return;
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = pane.id === `tab-${tabId}` ? 'block' : 'none';
  });

  const titles = {
    dashboard: 'Operations Dashboard',
    orders: 'Orders & Fulfillment',
    pos: 'Point of Sale (POS) Counter Entry',
    inventory: 'Commercial Inventory & Tamper-Proof Audit',
    products: 'Products & Recipe Catalog',
    invoices: 'Tax Invoices Registry (Sequential, No Gaps)',
    wholesale: 'Wholesale B2B Clients & Custom Pricing',
    reports: 'Sales & Accounting Reports',
    settings: 'Bakery Configuration & Staff'
  };
  document.getElementById('pageTitle').textContent = titles[tabId] || 'Bakery Console';

  if (tabId === 'dashboard') loadDashboard();
  if (tabId === 'orders') loadOrders();
  if (tabId === 'pos') initPos();
  if (tabId === 'inventory') loadInventory();
  if (tabId === 'products') loadProducts();
  if (tabId === 'invoices') loadInvoices();
  if (tabId === 'wholesale') loadWholesaleClients();
  if (tabId === 'reports') loadReports();
  if (tabId === 'settings') loadSettings();
}

// ==========================================
// 1. DASHBOARD
// ==========================================
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`, { headers: getAuthHeaders() });
    if (res.status === 401) return logoutAdmin();
    const data = await res.json();
    if (!data.success) return;

    const m = data.metrics;
    document.getElementById('metricTodayOrders').textContent = m.today_orders;
    document.getElementById('metricTodayRevenue').textContent = `₹${m.today_revenue}`;
    document.getElementById('metricPendingPacking').textContent = m.pending_packing_count;
    document.getElementById('metricLowStock').textContent = m.low_stock_count;
    document.getElementById('metricOutOfStock').textContent = m.out_of_stock_count;
    document.getElementById('badgePendingOrders').textContent = m.pending_packing_count;

    // Render recent orders
    const tbody = document.getElementById('recentOrdersTbody');
    if (!data.recent_orders || data.recent_orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No recent orders.</td></tr>';
      return;
    }

    tbody.innerHTML = data.recent_orders.map(order => `
      <tr>
        <td><strong>${order.orderNo}</strong></td>
        <td>
          <div>${order.customer?.name || 'Walk-in'}</div>
          <small style="color:var(--muted);">${order.customer?.mobile || ''}</small>
        </td>
        <td>
          <span class="badge badge-channel ${(order.channel || order.tag || '').toLowerCase()}">
            ${order.channel || order.tag || 'Online'}
          </span>
        </td>
        <td><strong>₹${order.grand_total}</strong></td>
        <td><span class="badge badge-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
        <td>${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="switchTab('orders')">Manage</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ==========================================
// 2. ORDERS MANAGEMENT
// ==========================================
async function loadOrders() {
  try {
    const status = document.getElementById('orderStatusFilter').value;
    const channel = document.getElementById('orderChannelFilter').value;

    const query = new URLSearchParams();
    if (status && status !== 'All') query.set('status', status);
    if (channel && channel !== 'All') query.set('channel', channel);

    const res = await fetch(`${API_BASE}/orders?${query.toString()}`, { headers: getAuthHeaders() });
    if (res.status === 401) return logoutAdmin();
    const data = await res.json();

    const tbody = document.getElementById('ordersTbody');
    if (!data.orders || data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px;">No matching orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders.map(order => {
      const itemsDesc = (order.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');
      const nextStatus = getNextOrderStatus(order.status);

      return `
        <tr>
          <td>
            <strong>${order.orderNo}</strong>
            <div style="font-size:0.75rem; color:var(--muted);">${new Date(order.createdAt).toLocaleDateString()}</div>
          </td>
          <td>
            <div style="font-weight:600;">${order.customer?.name || 'Customer'}</div>
            ${order.customer?.mobile ? `<a href="tel:${order.customer.mobile}" style="color:var(--primary); font-size:0.85rem;">📞 +91 ${order.customer.mobile}</a>` : '—'}
          </td>
          <td>
            <span class="badge badge-channel ${(order.channel || order.tag || '').toLowerCase()}">
              ${order.channel || order.tag || 'Online'}
            </span>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">${order.paymentMode || 'Prepaid'}</div>
          </td>
          <td style="max-width: 240px; font-size: 0.85rem;">
            ${itemsDesc}
          </td>
          <td><strong style="color:var(--primary);">₹${order.grand_total}</strong></td>
          <td>
            <div style="margin-bottom: 6px;">
              <span class="badge badge-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span>
            </div>
            ${nextStatus ? `
              <button class="btn btn-primary btn-sm" onclick="advanceOrderStatus('${order.orderNo}', '${nextStatus}')">
                Mark as ${nextStatus} →
              </button>
            ` : '<span style="color:var(--success); font-size:0.82rem; font-weight:700;">✓ Completed</span>'}
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <a href="/api/admin/orders/${order.orderNo}/packing-slip" target="_blank" class="btn btn-outline btn-sm">
                🖨️ Packing Slip
              </a>
              <a href="/api/invoices/${order.orderNo}" target="_blank" class="btn btn-outline btn-sm">
                📄 Tax Invoice
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

function getNextOrderStatus(current) {
  const flow = {
    'Paid': 'Packed',
    'Packed': 'Out for delivery',
    'Out for delivery': 'Delivered'
  };
  return flow[current] || null;
}

async function advanceOrderStatus(orderNo, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderNo}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Could not update status');
      return;
    }
    loadOrders();
    loadDashboard();
  } catch (err) {
    alert('Server error updating status');
  }
}

// ==========================================
// 3. POS / WALK-IN SALES
// ==========================================
async function initPos() {
  await loadProductsForPos();
  renderPosCatalog();
  renderPosCart();
}

async function loadProductsForPos() {
  try {
    const res = await fetch(`${API_BASE}/products`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      currentProducts = data.products;
    }
  } catch (e) {}
}

function renderPosCatalog() {
  const grid = document.getElementById('posProductsGrid');
  const q = (document.getElementById('posSearchInput').value || '').toLowerCase();
  const filtered = currentProducts.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

  grid.innerHTML = filtered.map(p => `
    <div class="pos-product-card" onclick="addToPosCart('${p.id}')">
      <div>
        <img src="${p.image}" class="pos-product-img" onerror="this.src='/images/sourdough-pizza-base.jpg'" alt="${p.name}">
        <div class="pos-product-name">${p.name}</div>
        <div class="pos-product-stock">Stock: ${p.stock} units</div>
      </div>
      <div>
        <div class="pos-product-price">₹${p.retail_price}</div>
        <button class="btn btn-secondary btn-sm btn-block" style="margin-top:6px;">+ Add to Order</button>
      </div>
    </div>
  `).join('');
}

function addToPosCart(productId) {
  const p = currentProducts.find(item => item.id === productId);
  if (!p) return;

  if (p.stock <= 0) {
    alert(`${p.name} is currently out of stock!`);
    return;
  }

  const existing = posCart.find(item => item.productId === productId);
  if (existing) {
    if (existing.quantity >= p.stock) {
      alert(`Cannot add more than physical stock count (${p.stock}).`);
      return;
    }
    existing.quantity++;
  } else {
    posCart.push({
      productId: p.id,
      name: p.name,
      price: p.retail_price,
      quantity: 1,
      stock: p.stock
    });
  }
  renderPosCart();
}

function updatePosQty(productId, delta) {
  const item = posCart.find(i => i.productId === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity > item.stock) {
    alert(`Only ${item.stock} units available in stock.`);
    item.quantity = item.stock;
  }

  if (item.quantity <= 0) {
    posCart = posCart.filter(i => i.productId !== productId);
  }
  renderPosCart();
}

function renderPosCart() {
  const listEl = document.getElementById('posCartItemsList');
  if (posCart.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 30px 0;">No items added yet.<br>Click any product on the left to add.</div>';
    document.getElementById('posSubtotal').textContent = '₹0';
    document.getElementById('posGrandTotal').textContent = '₹0';
    return;
  }

  let total = 0;
  listEl.innerHTML = posCart.map(i => {
    const itemTotal = i.price * i.quantity;
    total += itemTotal;
    return `
      <div class="pos-cart-item">
        <div style="flex: 1; padding-right: 8px;">
          <div style="font-weight: 600; font-size: 0.88rem;">${i.name}</div>
          <div style="color: var(--muted); font-size: 0.78rem;">₹${i.price} each</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updatePosQty('${i.productId}', -1)">-</button>
          <span style="font-weight: 700; width: 20px; text-align: center;">${i.quantity}</span>
          <button class="qty-btn" onclick="updatePosQty('${i.productId}', 1)">+</button>
        </div>
        <div style="width: 60px; text-align: right; font-weight: 700; color: var(--primary);">
          ₹${itemTotal}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('posSubtotal').textContent = `₹${total}`;
  document.getElementById('posGrandTotal').textContent = `₹${total}`;
}

function setPosPaymentMode(mode, btn) {
  posPaymentMode = mode;
  document.querySelectorAll('.pos-pay-mode').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function recordPosSale() {
  if (posCart.length === 0) {
    alert('Please add at least one product to the POS cart.');
    return;
  }

  const name = document.getElementById('posCustomerName').value.trim() || 'Walk-in Counter Customer';
  const mobile = document.getElementById('posCustomerMobile').value.trim();

  const btn = document.getElementById('btnRecordPosSale');
  btn.disabled = true;
  btn.textContent = 'Processing Sale...';

  try {
    const payload = {
      items: posCart.map(i => ({ productId: i.productId, quantity: i.quantity })),
      customer: { name, mobile },
      paymentMode: posPaymentMode
    };

    const res = await fetch(`${API_BASE}/orders/offline`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to record offline sale');
      btn.disabled = false;
      btn.textContent = '⚡ Record Sale & Deduct Stock';
      return;
    }

    alert(`Sale recorded successfully! Order #${data.order.orderNo}. Stock has been deducted.`);
    posCart = [];
    document.getElementById('posCustomerName').value = '';
    document.getElementById('posCustomerMobile').value = '';
    renderPosCart();
    await loadProductsForPos();
    renderPosCatalog();
    loadDashboard();
  } catch (err) {
    alert('Server error recording POS order');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Record Sale & Deduct Stock';
  }
}

// ==========================================
// 4. INVENTORY & AUDIT TRAIL
// ==========================================
async function loadInventory() {
  try {
    const res = await fetch(`${API_BASE}/inventory`, { headers: getAuthHeaders() });
    const data = await res.json();
    currentInventory = data.inventory || [];

    const tbody = document.getElementById('inventoryTbody');
    tbody.innerHTML = currentInventory.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.category}</td>
        <td>${item.pack_size}</td>
        <td><strong style="font-size:1.1rem;">${item.stock}</strong> units</td>
        <td>
          <span class="badge badge-${item.status.toLowerCase().replace(/\s+/g, '-')}">
            ${item.status}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-success btn-sm" onclick="openRestockModal('${item.id}', '${item.name}')">+ Restock</button>
            <button class="btn btn-outline btn-sm" onclick="openAdjustModal('${item.id}', '${item.name}', ${item.stock})">Adjust / Discrepancy</button>
          </div>
        </td>
      </tr>
    `).join('');

    loadInventoryLog();
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

async function loadInventoryLog() {
  try {
    const res = await fetch(`${API_BASE}/inventory/log`, { headers: getAuthHeaders() });
    const data = await res.json();

    const tbody = document.getElementById('inventoryLogTbody');
    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No inventory log entries yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map(log => `
      <tr>
        <td style="font-size:0.8rem; color:var(--muted);">${new Date(log.timestamp).toLocaleString()}</td>
        <td><strong>${log.productName}</strong></td>
        <td><span class="badge" style="background:#FAF6F0; font-size:0.75rem;">${log.type}</span></td>
        <td style="font-weight:700; color:${log.quantityChange >= 0 ? 'var(--success)' : 'var(--danger)'};">
          ${log.quantityChange > 0 ? '+' : ''}${log.quantityChange}
        </td>
        <td>${log.previousStock} → ${log.newStock}</td>
        <td style="font-size:0.85rem;">${log.reason || '—'}</td>
        <td style="font-size:0.8rem; color:var(--muted);">${log.user || 'System'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading inventory logs:', err);
  }
}

function openRestockModal(productId, productName) {
  document.getElementById('restockProductId').value = productId;
  document.getElementById('restockProductName').textContent = `Adding fresh bakery stock for: ${productName}`;
  document.getElementById('restockQuantity').value = '';
  document.getElementById('restockNotes').value = '';
  document.getElementById('restockModal').style.display = 'flex';
}

async function submitRestock(e) {
  e.preventDefault();
  const productId = document.getElementById('restockProductId').value;
  const quantity = parseInt(document.getElementById('restockQuantity').value);
  const notes = document.getElementById('restockNotes').value;

  try {
    const res = await fetch(`${API_BASE}/inventory/restock`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ productId, quantity, notes })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to restock');
      return;
    }
    closeModal('restockModal');
    loadInventory();
  } catch (err) {
    alert('Server error restocking product');
  }
}

function openAdjustModal(productId, productName, currentStock) {
  document.getElementById('adjustProductId').value = productId;
  document.getElementById('adjustProductName').textContent = `Correct physical count for: ${productName} (Current: ${currentStock})`;
  document.getElementById('adjustNewStock').value = currentStock;
  document.getElementById('adjustReason').value = '';
  document.getElementById('adjustModal').style.display = 'flex';
}

async function submitAdjustStock(e) {
  e.preventDefault();
  const productId = document.getElementById('adjustProductId').value;
  const newStock = parseInt(document.getElementById('adjustNewStock').value);
  const reason = document.getElementById('adjustReason').value.trim();

  if (!reason) {
    alert('Correction reason is mandatory.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ productId, newStock, reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to adjust stock');
      return;
    }
    closeModal('adjustModal');
    loadInventory();
  } catch (err) {
    alert('Server error updating stock');
  }
}

// ==========================================
// 5. PRODUCTS CATALOG & TOGGLE
// ==========================================
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`, { headers: getAuthHeaders() });
    const data = await res.json();
    currentProducts = data.products || [];

    const tbody = document.getElementById('productsTbody');
    tbody.innerHTML = currentProducts.map(p => `
      <tr>
        <td>
          <img src="${p.image}" onerror="this.src='/images/sourdough-pizza-base.jpg'" style="width:48px; height:48px; object-fit:cover; border-radius:4px;" alt="${p.name}">
        </td>
        <td><code>${p.code || p.id}</code></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category}</td>
        <td>₹${p.retail_price}</td>
        <td>₹${p.wholesale_price}</td>
        <td><strong>${p.stock}</strong></td>
        <td>
          <label class="switch">
            <input type="checkbox" ${p.is_live ? 'checked' : ''} onchange="toggleProductLive('${p.id}', this.checked)">
            <span class="slider"></span>
          </label>
          <span style="font-size:0.75rem; margin-left:6px; font-weight:600; color:${p.is_live ? 'var(--success)' : 'var(--muted)'};">
            ${p.is_live ? 'Live' : 'Offline'}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

async function toggleProductLive(productId, isLive) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_live: isLive })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to toggle product status');
      loadProducts();
    }
  } catch (e) {
    alert('Server error toggling status');
    loadProducts();
  }
}

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('modalProductId').value = '';
  document.getElementById('modalProductName').value = '';
  document.getElementById('modalProductCode').value = '';
  document.getElementById('modalProductCategory').value = 'Pizza bases';
  document.getElementById('modalProductPackSize').value = 'Pack of 2';
  document.getElementById('modalProductRetailPrice').value = '180';
  document.getElementById('modalProductWholesalePrice').value = '130';
  document.getElementById('modalProductStock').value = '100';
  document.getElementById('modalProductMoq').value = '10';
  document.getElementById('modalProductImage').value = '/images/sourdough-pizza-base.jpg';
  document.getElementById('modalProductDescription').value = '';
  document.getElementById('productModal').style.display = 'flex';
}

function editProduct(productId) {
  const p = currentProducts.find(item => item.id === productId);
  if (!p) return;

  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('modalProductId').value = p.id;
  document.getElementById('modalProductName').value = p.name;
  document.getElementById('modalProductCode').value = p.code || '';
  document.getElementById('modalProductCategory').value = p.category;
  document.getElementById('modalProductPackSize').value = p.pack_size;
  document.getElementById('modalProductRetailPrice').value = p.retail_price;
  document.getElementById('modalProductWholesalePrice').value = p.wholesale_price;
  document.getElementById('modalProductStock').value = p.stock;
  document.getElementById('modalProductMoq').value = p.min_wholesale_qty || 10;
  document.getElementById('modalProductImage').value = p.image || '';
  document.getElementById('modalProductDescription').value = p.description || '';
  document.getElementById('productModal').style.display = 'flex';
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('modalProductId').value;
  const payload = {
    name: document.getElementById('modalProductName').value.trim(),
    code: document.getElementById('modalProductCode').value.trim(),
    category: document.getElementById('modalProductCategory').value,
    pack_size: document.getElementById('modalProductPackSize').value.trim(),
    retail_price: parseFloat(document.getElementById('modalProductRetailPrice').value),
    wholesale_price: parseFloat(document.getElementById('modalProductWholesalePrice').value),
    stock: parseInt(document.getElementById('modalProductStock').value),
    min_wholesale_qty: parseInt(document.getElementById('modalProductMoq').value),
    image: document.getElementById('modalProductImage').value.trim(),
    description: document.getElementById('modalProductDescription').value.trim()
  };

  try {
    const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to save product');
      return;
    }

    closeModal('productModal');
    loadProducts();
  } catch (err) {
    alert('Server error saving product');
  }
}

// ==========================================
// 6. WHOLESALE CLIENTS (Owner Only)
// ==========================================
async function loadWholesaleClients() {
  try {
    const res = await fetch(`${API_BASE}/wholesale/customers`, { headers: getAuthHeaders() });
    if (res.status === 403) return alert('Restricted to Owner only.');
    const data = await res.json();

    const tbody = document.getElementById('wholesaleTbody');
    if (!data.wholesalers || data.wholesalers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No wholesale clients registered yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.wholesalers.map(w => {
      const overridesCount = Object.keys(w.price_overrides || {}).length;
      return `
        <tr>
          <td><strong>${w.shop_name}</strong></td>
          <td>
            <div>${w.owner_name}</div>
            <a href="tel:${w.mobile}" style="color:var(--primary); font-size:0.85rem;">📞 +91 ${w.mobile}</a>
          </td>
          <td><code>${w.gstin || '—'}</code></td>
          <td>${w.state || 'Karnataka'}</td>
          <td><strong>${w.total_orders}</strong></td>
          <td><strong>₹${w.total_spend}</strong></td>
          <td>
            <span class="badge ${overridesCount > 0 ? 'badge-in-stock' : ''}">
              ${overridesCount} custom rate(s)
            </span>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openPriceOverrideModal('${w.id}', '${w.shop_name}')">
              Set Price Overrides
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading wholesale clients:', err);
  }
}

function openPriceOverrideModal(wholesalerId, shopName) {
  document.getElementById('overrideWholesalerId').value = wholesalerId;
  document.getElementById('overrideShopName').textContent = `Setting agreed wholesale pricing for: ${shopName}`;

  const select = document.getElementById('overrideProductSelect');
  select.innerHTML = currentProducts.map(p => `
    <option value="${p.id}">${p.name} (Base Wholesale: ₹${p.wholesale_price})</option>
  `).join('');

  document.getElementById('overridePriceInput').value = '';
  document.getElementById('overrideModal').style.display = 'flex';
}

async function submitPriceOverride(e) {
  e.preventDefault();
  const wholesalerId = document.getElementById('overrideWholesalerId').value;
  const productId = document.getElementById('overrideProductSelect').value;
  const overridePrice = parseFloat(document.getElementById('overridePriceInput').value);

  try {
    const res = await fetch(`${API_BASE}/wholesale/price-override`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ wholesalerId, productId, overridePrice })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to set price override');
      return;
    }

    alert('Wholesale price override updated successfully.');
    closeModal('overrideModal');
    loadWholesaleClients();
  } catch (err) {
    alert('Server error saving price override');
  }
}

// ==========================================
// 6.5. INVOICES (Sequential & Tax)
// ==========================================
async function loadInvoices() {
  try {
    const res = await fetch(`${API_BASE}/invoices`, { headers: getAuthHeaders() });
    if (res.status === 401) return logoutAdmin();
    const data = await res.json();

    const tbody = document.getElementById('invoicesTbody');
    if (!data.invoices || data.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">No tax invoices recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.invoices.map(inv => `
      <tr>
        <td><strong>${inv.invoiceNo || inv.orderNo}</strong></td>
        <td>${new Date(inv.date).toLocaleDateString()}</td>
        <td>
          <div>${inv.customerName}</div>
          <small style="color:var(--muted);">${inv.customerMobile || ''}</small>
        </td>
        <td><span class="badge badge-channel ${(inv.channel || '').toLowerCase()}">${inv.channel}</span></td>
        <td><strong>₹${inv.amount}</strong></td>
        <td>${inv.tax_gst ? `₹${inv.tax_gst}` : '0% (On Hold)'}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <a href="/api/invoices/${inv.orderNo}" target="_blank" class="btn btn-outline btn-sm">📄 PDF</a>
            <button class="btn btn-secondary btn-sm" onclick="resendInvoicePrompt('${inv.orderNo}')">📲 Resend</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

async function resendInvoicePrompt(orderNo) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${orderNo}/resend`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success && data.whatsappUrl) {
      if (confirm(`${data.message}\n\nOpen WhatsApp to share directly?`)) {
        window.open(data.whatsappUrl, '_blank');
      }
    } else {
      alert(data.message || 'Invoice dispatched.');
    }
  } catch (e) {
    alert('Server error dispatching invoice.');
  }
}

// ==========================================
// 7. REPORTS & EXPORTS (Owner Only)
// ==========================================
async function loadReports() {
  try {
    const startDate = document.getElementById('reportStartDate')?.value || '';
    const endDate = document.getElementById('reportEndDate')?.value || '';

    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);

    const res = await fetch(`${API_BASE}/reports/monthly?${query.toString()}`, { headers: getAuthHeaders() });
    if (res.status === 403) return alert('Restricted to Owner only.');
    const data = await res.json();

    const s = data.summary;
    document.getElementById('reportTotalOrders').textContent = s.total_orders;
    document.getElementById('reportTotalRevenue').textContent = `₹${s.revenue}`;
    document.getElementById('reportInShopOrders').textContent = s.in_shop_orders;
    document.getElementById('reportWholesaleOrders').textContent = s.wholesale_orders;
  } catch (err) {
    console.error('Error loading reports:', err);
  }
}

function downloadConsolidatedCSV() {
  const token = localStorage.getItem('bb_admin_token') || '';
  const startDate = document.getElementById('reportStartDate')?.value || '';
  const endDate = document.getElementById('reportEndDate')?.value || '';
  window.open(`${API_BASE}/reports/monthly?format=csv&startDate=${startDate}&endDate=${endDate}&authorization=Bearer ${token}`, '_blank');
}

function downloadInvoicesZip() {
  const token = localStorage.getItem('bb_admin_token') || '';
  window.open(`${API_BASE}/reports/invoices.zip?authorization=Bearer ${token}`, '_blank');
}

// ==========================================
// 8. SETTINGS & STAFF (Owner Only)
// ==========================================
async function loadSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() });
    if (res.status === 403) return alert('Restricted to Owner only.');
    const data = await res.json();

    const s = data.settings;
    document.getElementById('settingBusinessName').value = s.business_name || '';
    document.getElementById('settingBusinessAddress').value = s.business_address || '';
    document.getElementById('settingWhatsApp').value = s.notifications?.whatsapp_number || s.phone || '8219775396';
    document.getElementById('settingHoldMinutes').value = s.stock_hold_minutes || 10;

    loadStaff();
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    business_name: document.getElementById('settingBusinessName').value.trim(),
    business_address: document.getElementById('settingBusinessAddress').value.trim(),
    phone: document.getElementById('settingWhatsApp').value.trim(),
    stock_hold_minutes: parseInt(document.getElementById('settingHoldMinutes').value),
    notifications: {
      whatsapp_enabled: true,
      whatsapp_number: document.getElementById('settingWhatsApp').value.trim()
    }
  };

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to update settings');
      return;
    }
    alert('Settings saved successfully.');
  } catch (err) {
    alert('Server error saving settings');
  }
}

async function loadStaff() {
  try {
    const res = await fetch(`${API_BASE}/staff`, { headers: getAuthHeaders() });
    const data = await res.json();

    const tbody = document.getElementById('staffTbody');
    tbody.innerHTML = (data.staff || []).map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="user-role-badge role-${u.role}">${u.role.toUpperCase()}</span>
        </td>
        <td style="font-size:0.85rem; color:var(--muted);">
          ${u.role === 'owner' ? 'Full Access (All Tabs, Reports, Prices)' : 'Restricted (Orders, Inventory, POS only)'}
        </td>
      </tr>
    `).join('');
  } catch (e) {}
}

function openAddStaffModal() {
  document.getElementById('staffName').value = '';
  document.getElementById('staffEmail').value = '';
  document.getElementById('staffPassword').value = '';
  document.getElementById('staffRole').value = 'staff';
  document.getElementById('staffModal').style.display = 'flex';
}

async function submitAddStaff(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staffName').value.trim(),
    email: document.getElementById('staffEmail').value.trim(),
    password: document.getElementById('staffPassword').value,
    role: document.getElementById('staffRole').value
  };

  try {
    const res = await fetch(`${API_BASE}/staff`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to create staff account');
      return;
    }
    alert('Staff account created successfully.');
    closeModal('staffModal');
    loadStaff();
  } catch (e) {
    alert('Server error creating staff account');
  }
}

// ==========================================
// UTILITY
// ==========================================
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// =========================================================================
// BLUEPRINT ADDENDUM: SECTIONS (FACTORY, SHOPKEEPERS, REGULAR) LOGIC
// =========================================================================
let currentActiveSection = 'factory';
let currentActiveInnerTab = 'Standard';

function openSectionPage(section) {
  currentActiveSection = section.toLowerCase();
  
  // Highlight sidebar
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-tab') === `section-${currentActiveSection}`);
  });

  // Show section console tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = pane.id === 'tab-section-console' ? 'block' : 'none';
  });

  const sectionLabels = {
    factory: 'Factory Section (Direct Bulk Buyers)',
    shopkeeper: 'Shopkeepers Section (Area Resellers)',
    regular: 'Regular (Shop) Section (Retail Public)'
  };

  const badgeLabels = {
    factory: 'FACTORY SECTION',
    shopkeeper: 'SHOPKEEPERS SECTION',
    regular: 'REGULAR (SHOP) SECTION'
  };

  document.getElementById('sectionBadge').textContent = badgeLabels[currentActiveSection] || 'CUSTOMER SECTION';
  document.getElementById('sectionConsoleTitle').textContent = sectionLabels[currentActiveSection] || 'Customer Section';
  document.getElementById('pageTitle').textContent = `${sectionLabels[currentActiveSection]} - Management`;

  switchSectionInnerTab(currentActiveInnerTab);
}

function switchSectionInnerTab(innerTab) {
  currentActiveInnerTab = innerTab;

  document.querySelectorAll('.section-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `secTab-${innerTab}`);
  });

  ['Standard', 'Special', 'Customers', 'Billing'].forEach(tab => {
    const pane = document.getElementById(`secInnerPane-${tab}`);
    if (pane) pane.style.display = tab === innerTab ? 'block' : 'none';
  });

  if (innerTab === 'Standard') loadSectionStandardPrices();
  if (innerTab === 'Special') loadSectionSpecialCustomers();
  if (innerTab === 'Customers') loadSectionCustomers();
  if (innerTab === 'Billing') loadSectionBilling();
}

async function loadSectionStandardPrices() {
  const tbody = document.getElementById('sectionStandardPricesTbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading standard price list...</td></tr>';

  try {
    const stdListId = `pl-${currentActiveSection.slice(0, 3)}-std`;
    const res = await fetch(`${API_BASE}/price-lists/${stdListId}`, { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok || !data.success) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">${data.error || 'Failed to load prices'}</td></tr>`;
      return;
    }

    const items = data.items || [];
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No products configured for this price list.</td></tr>';
      return;
    }

    // Also get count of special customers with overrides
    const custRes = await fetch(`${API_BASE}/sections/${currentActiveSection}/customers`, { headers: getAuthHeaders() });
    const custData = await custRes.json();
    const specialCount = (custData.customers || []).filter(c => c.price_list_id).length;

    tbody.innerHTML = items.map(item => {
      const prod = currentProducts.find(p => p.id === item.product_id) || { name: item.product_id, code: '' };
      return `
        <tr>
          <td>
            <strong>${prod.name || item.product_id}</strong>
            <div style="font-size:0.75rem; color:var(--muted);">${prod.code || ''}</div>
          </td>
          <td>
            <span class="badge" style="background:#FAF6F0; color:var(--dark); font-weight:600;">
              ${item.unit === 'pack' ? `Pack of ${item.pack_size || 10}` : 'Per piece'}
            </span>
          </td>
          <td>
            <input type="number" class="form-input" style="max-width:110px; padding:4px 8px; font-weight:700;" value="${item.price}" id="price-${item.product_id}">
          </td>
          <td>
            <input type="number" class="form-input" style="max-width:90px; padding:4px 8px;" value="${item.moq || 1}" id="moq-${item.product_id}">
          </td>
          <td>
            <span style="font-size:0.85rem; color:var(--primary); font-weight:600;">
              ⭐ ${specialCount} Special accounts
            </span>
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="saveInlinePrice('${stdListId}', '${item.product_id}', '${item.unit}', ${item.pack_size || 1})">
              Save
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">Error loading price list: ${err.message}</td></tr>`;
  }
}

async function saveInlinePrice(listId, productId, unit, packSize) {
  const priceInput = document.getElementById(`price-${productId}`);
  const moqInput = document.getElementById(`moq-${productId}`);
  const price = parseFloat(priceInput.value);
  const moq = parseInt(moqInput.value, 10);

  if (isNaN(price) || price <= 0) return alert('Price must be greater than zero.');
  if (isNaN(moq) || moq < 1) return alert('MOQ must be at least 1.');

  try {
    const res = await fetch(`${API_BASE}/price-lists/${listId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        items: [{
          product_id: productId,
          price,
          moq,
          unit,
          pack_size: packSize,
          price_paise: Math.round(price * 100)
        }]
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save price');

    alert(`Price updated to ₹${price} (MOQ: ${moq}). Logged in price audit trail.`);
    loadSectionStandardPrices();
  } catch (e) {
    alert(e.message);
  }
}

async function loadSectionSpecialCustomers() {
  const tbody = document.getElementById('sectionSpecialCustomersTbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Loading special accounts...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/sections/${currentActiveSection}/customers`, { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok || !data.success) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">${data.error || 'Failed to load'}</td></tr>`;
      return;
    }

    const specialCustomers = (data.customers || []).filter(c => c.price_list_id);
    if (!specialCustomers.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No customers currently assigned to a Special price list. Click "Add Customer to Special" above.</td></tr>';
      return;
    }

    tbody.innerHTML = specialCustomers.map(c => `
      <tr>
        <td><strong>${c.mobile}</strong></td>
        <td>
          <div style="font-weight:600;">${c.name}</div>
          <div style="font-size:0.78rem; color:var(--muted);">${c.shop_name || 'Individual'}</div>
        </td>
        <td>
          <span class="badge" style="background:#FEF3C7; color:#92400E; font-weight:700;">
            ⭐ ${c.price_list_name || 'Special List'}
          </span>
        </td>
        <td><strong>${c.custom_price_count || 'Custom'} items</strong></td>
        <td>${c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : 'Never'}</td>
        <td>
          <span class="badge ${c.is_active ? 'badge-in-stock' : 'badge-out-of-stock'}">
            ${c.is_active ? 'Active' : 'Deactivated'}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="moveCustomerList('${c.id}', null)">
            Revert to Standard
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">${err.message}</td></tr>`;
  }
}

async function loadSectionCustomers() {
  const tbody = document.getElementById('sectionCustomersTbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Loading registered customers...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/sections/${currentActiveSection}/customers`, { headers: getAuthHeaders() });
    const data = await res.json();

    if (!res.ok || !data.success) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--danger);">${data.error || 'Failed to load'}</td></tr>`;
      return;
    }

    const customers = data.customers || [];
    if (!customers.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--muted);">No registered numbers in this section. Click "+ Register Customer" to whitelist an account.</td></tr>';
      return;
    }

    tbody.innerHTML = customers.map(c => `
      <tr>
        <td><strong>${c.mobile}</strong></td>
        <td>
          <div style="font-weight:600;">${c.name}</div>
          <div style="font-size:0.78rem; color:var(--muted);">${c.shop_name || c.address || '—'}</div>
        </td>
        <td>
          <span class="badge" style="background:${c.price_list_id ? '#FEF3C7' : '#EFF6FF'}; color:${c.price_list_id ? '#92400E' : '#1E40AF'}; font-weight:700;">
            ${c.price_list_id ? '⭐ Special' : 'Standard'}
          </span>
        </td>
        <td>${c.total_orders || 0}</td>
        <td><strong>₹${(c.total_spend || 0).toLocaleString()}</strong></td>
        <td>${c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : 'Never'}</td>
        <td>
          <button class="btn ${c.is_active ? 'btn-success' : 'btn-secondary'} btn-sm" onclick="toggleCustomerActive('${c.id}', ${!c.is_active})">
            ${c.is_active ? '✓ Active' : '✕ Disabled'}
          </button>
        </td>
        <td>
          ${c.price_list_id 
            ? `<button class="btn btn-outline btn-sm" onclick="moveCustomerList('${c.id}', null)">Move to Standard</button>`
            : `<button class="btn btn-outline btn-sm" onclick="moveCustomerList('${c.id}', 'pl-${currentActiveSection.slice(0, 3)}-spc-1')">Move to Special</button>`
          }
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--danger);">${err.message}</td></tr>`;
  }
}

async function loadSectionBilling() {
  const tbody = document.getElementById('sectionBillingTbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Loading section invoices...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
    const data = await res.json();
    const allOrders = data.orders || [];

    const sectionOrders = allOrders.filter(o => {
      const channel = (o.channel || o.tag || '').toLowerCase();
      if (currentActiveSection === 'factory') return channel.includes('factory');
      if (currentActiveSection === 'shopkeeper') return channel.includes('wholesale') || channel.includes('shopkeeper');
      return channel.includes('online') || channel.includes('in-shop') || channel.includes('retail');
    });

    if (!sectionOrders.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No orders or invoices recorded in this section yet.</td></tr>';
      return;
    }

    tbody.innerHTML = sectionOrders.map(o => `
      <tr>
        <td><strong>${o.invoiceNo || 'INV-' + o.orderNo}</strong></td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td>${(o.customer && o.customer.name) || 'Customer'}</td>
        <td><strong>₹${(o.grand_total || 0).toLocaleString()}</strong></td>
        <td><span class="badge" style="background:#FAF6F0; color:var(--dark);">${o.tag || 'Standard'}</span></td>
        <td>
          <a href="/api/invoices/${o.orderNo}" target="_blank" class="btn btn-outline btn-sm">PDF Invoice</a>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">${e.message}</td></tr>`;
  }
}

function openAddSectionCustomerModal(isSpecial = false) {
  document.getElementById('modalCustomerSection').value = currentActiveSection;
  document.getElementById('modalCustomerMobile').value = '';
  document.getElementById('modalCustomerName').value = '';
  document.getElementById('modalCustomerShopName').value = '';
  document.getElementById('modalCustomerAddress').value = '';
  document.getElementById('modalCustomerGstin').value = '';
  document.getElementById('addCustomerAlert').style.display = 'none';

  onSectionChangeInModal();

  if (isSpecial) {
    const specialSelect = document.getElementById('modalCustomerPriceList');
    if (specialSelect.options.length > 1) {
      specialSelect.selectedIndex = 1;
    }
  }

  document.getElementById('addCustomerModal').style.display = 'flex';
}

function onSectionChangeInModal() {
  const sec = document.getElementById('modalCustomerSection').value;
  const priceListSelect = document.getElementById('modalCustomerPriceList');
  priceListSelect.innerHTML = '<option value="">Standard Section Price List</option>';

  const specialListId = `pl-${sec.slice(0, 3)}-spc-1`;
  const opt = document.createElement('option');
  opt.value = specialListId;
  opt.textContent = `⭐ Special Price List (${sec.toUpperCase()} Custom)`;
  priceListSelect.appendChild(opt);
}

async function submitAddSectionCustomer(e) {
  e.preventDefault();
  const alertEl = document.getElementById('addCustomerAlert');
  alertEl.style.display = 'none';

  const section = document.getElementById('modalCustomerSection').value;
  const mobile = document.getElementById('modalCustomerMobile').value.trim();
  const name = document.getElementById('modalCustomerName').value.trim();
  const shop_name = document.getElementById('modalCustomerShopName').value.trim();
  const address = document.getElementById('modalCustomerAddress').value.trim();
  const gstin = document.getElementById('modalCustomerGstin').value.trim();
  const price_list_id = document.getElementById('modalCustomerPriceList').value || null;

  try {
    const res = await fetch(`${API_BASE}/sections/${section}/customers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        mobile,
        name,
        shop_name,
        address,
        gstin,
        price_list_id
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alertEl.textContent = data.error || 'Failed to register customer.';
      alertEl.style.display = 'flex';
      return;
    }

    closeModal('addCustomerModal');
    alert(`Customer ${name} (${mobile}) successfully registered in ${section.toUpperCase()} section.`);
    openSectionPage(section);
  } catch (err) {
    alertEl.textContent = 'Server error registering customer. Please try again.';
    alertEl.style.display = 'flex';
  }
}

async function toggleCustomerActive(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_active: newStatus, can_login: newStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update customer status');
    loadSectionCustomers();
  } catch (e) {
    alert(e.message);
  }
}

async function moveCustomerList(id, targetPriceListId) {
  try {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ price_list_id: targetPriceListId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update customer price list');
    alert(targetPriceListId ? 'Customer moved to Special Price List.' : 'Customer reverted to Standard Price List.');
    if (currentActiveInnerTab === 'Special') loadSectionSpecialCustomers();
    if (currentActiveInnerTab === 'Customers') loadSectionCustomers();
  } catch (e) {
    alert(e.message);
  }
}

function switchReportsSection(section) {
  switchTab('reports');
}

