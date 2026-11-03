/**
 * BACKREY BASES - MAIN APPLICATION LOGIC
 * Implements Blueprint Screens:
 * 3.1 Home
 * 3.2 Products List (Tests S1, S2, S4)
 * 3.3 Product Detail
 * 3.4 Cart Drawer (Tests G1, G2)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const productsGrid = document.getElementById('productsGrid');
  const skeletonGrid = document.getElementById('skeletonGrid');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  const retryBtn = document.getElementById('retryBtn');
  const categoryTabs = document.getElementById('categoryTabs');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const productsCountEl = document.getElementById('productsCount');

  // Header & Navigation
  const headerCartBtn = document.getElementById('headerCartBtn');
  const headerCartBadge = document.getElementById('headerCartBadge');
  const mobileCartBar = document.getElementById('mobileCartBar');
  const mobileCartCount = document.getElementById('mobileCartCount');
  const mobileCartTotal = document.getElementById('mobileCartTotal');
  const mobileCartOpenBtn = document.getElementById('mobileCartOpenBtn');

  // Cart Drawer Elements
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const closeCartBtn = document.getElementById('closeCartBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartDeliveryEl = document.getElementById('cartDelivery');
  const cartTaxEl = document.getElementById('cartTax');
  const cartGrandTotalEl = document.getElementById('cartGrandTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const cartAlertArea = document.getElementById('cartAlertArea');

  // Product Detail Modal Elements
  const productModal = document.getElementById('productModal');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalImg = document.getElementById('modalImg');
  const modalCategory = document.getElementById('modalCategory');
  const modalTitle = document.getElementById('modalTitle');
  const modalPack = document.getElementById('modalPack');
  const modalStockBadge = document.getElementById('modalStockBadge');
  const modalDesc = document.getElementById('modalDesc');
  const modalPrice = document.getElementById('modalPrice');
  const modalStepperMinus = document.getElementById('modalStepperMinus');
  const modalStepperPlus = document.getElementById('modalStepperPlus');
  const modalStepperVal = document.getElementById('modalStepperVal');
  const modalAddCartBtn = document.getElementById('modalAddCartBtn');

  // State
  let currentCategory = 'All';
  let searchQuery = '';
  let cachedProducts = [];
  let activeModalProduct = null;
  let modalSelectedQty = 1;

  // Check QR In-Shop parameter (Blueprint Section 2 & Milestone 8)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tag') === 'in-shop' || window.location.pathname === '/qr') {
    localStorage.setItem('backrey_order_tag', 'In-shop');
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      const qrBanner = document.createElement('div');
      qrBanner.className = 'cart-alert-box';
      qrBanner.style.background = '#DCFCE7';
      qrBanner.style.color = '#15803D';
      qrBanner.style.borderColor = 'rgba(21, 128, 61, 0.3)';
      qrBanner.style.marginBottom = '16px';
      qrBanner.innerHTML = '📱 <strong>In-Shop QR Active:</strong> Your order will be tagged for immediate in-shop bakery preparation.';
      heroContent.prepend(qrBanner);
    }
  }

  // =========================================
  // TOAST NOTIFICATIONS
  // =========================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `
      <span>${type === 'error' ? '⚠️' : '✓'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // =========================================
  // PRODUCTS FETCHING & RENDERING
  // =========================================
  async function loadProducts() {
    skeletonGrid.style.display = 'grid';
    productsGrid.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';

    try {
      const res = await window.API.getProducts(currentCategory, searchQuery);
      cachedProducts = res.products || [];

      renderProducts(cachedProducts);
    } catch (err) {
      console.error(err);
      skeletonGrid.style.display = 'none';
      errorState.style.display = 'block';
    }
  }

  function renderProducts(products) {
    skeletonGrid.style.display = 'none';

    if (!products || products.length === 0) {
      productsGrid.style.display = 'none';
      emptyState.style.display = 'block';
      productsCountEl.textContent = '0 products';
      return;
    }

    productsCountEl.textContent = `${products.length} product${products.length > 1 ? 's' : ''}`;
    emptyState.style.display = 'none';
    productsGrid.style.display = 'grid';
    productsGrid.innerHTML = '';

    products.forEach(product => {
      const card = createProductCard(product);
      productsGrid.appendChild(card);
    });
  }

  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.id = `product-card-${product.id}`;

    // Stock Badge Styling (Blueprint 3.2: In stock / Low stock / Out of stock)
    let badgeClass = 'badge-in-stock';
    let badgeIcon = '●';
    if (product.stock <= 0) {
      badgeClass = 'badge-out-of-stock';
    } else if (product.stock_code === 'LOW_STOCK') {
      badgeClass = 'badge-low-stock';
    }

    const currentQtyInCart = window.cartManager.getItemQuantity(product.id);
    const isOutOfStock = product.stock <= 0;

    card.innerHTML = `
      <div class="product-image-wrap" data-id="${product.id}">
        <img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="pack-badge">${product.pack_size}</span>
        <span class="stock-badge ${badgeClass}" id="stock-badge-${product.id}">
          <i>${badgeIcon}</i> ${product.stock_status}
        </span>
      </div>
      <div class="product-body">
        <span class="product-category-meta">${product.category}</span>
        <h3 class="product-name" data-id="${product.id}">${product.name}</h3>
        <p class="product-tagline">${product.tagline || product.description}</p>
        
        <div class="product-footer">
          <div class="price-container">
            <span class="price-label">Price</span>
            <span class="price-val" id="price-val-${product.id}">${window.API.formatINR(product.price)}</span>
          </div>
          
          <div class="action-btn-wrap" id="action-wrap-${product.id}">
            ${renderCardButton(product, currentQtyInCart)}
          </div>
        </div>
      </div>
    `;

    // Click on image or title opens Product Detail Modal (Blueprint 3.3)
    card.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', () => openProductModal(product));
    });

    // Attach stepper & add button listeners
    bindCardActions(card, product);

    return card;
  }

  function renderCardButton(product, qty) {
    if (product.stock <= 0) {
      return `
        <button class="btn-add-cart" id="btn-add-${product.id}" disabled>
          Out of Stock
        </button>
      `;
    }

    if (qty > 0) {
      return `
        <div class="card-stepper" id="stepper-${product.id}">
          <button class="stepper-btn btn-minus" data-id="${product.id}" aria-label="Decrease quantity">−</button>
          <span class="stepper-val" id="stepper-val-${product.id}">${qty}</span>
          <button class="stepper-btn btn-plus" data-id="${product.id}" aria-label="Increase quantity">+</button>
        </div>
      `;
    }

    return `
      <button class="btn-add-cart" id="btn-add-${product.id}">
        <span>+ Add</span>
      </button>
    `;
  }

  function bindCardActions(card, product) {
    const addBtn = card.querySelector(`#btn-add-${product.id}`);
    if (addBtn && !addBtn.disabled) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const res = window.cartManager.addItem(product, 1);
        if (res.success) {
          showToast(`Added ${product.name} to cart`);
        } else {
          showToast(res.error, 'error');
        }
      });
    }

    const minusBtn = card.querySelector('.btn-minus');
    if (minusBtn) {
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = window.cartManager.getItemQuantity(product.id);
        window.cartManager.setItemQuantity(product.id, current - 1, product);
      });
    }

    const plusBtn = card.querySelector('.btn-plus');
    if (plusBtn) {
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = window.cartManager.getItemQuantity(product.id);
        const res = window.cartManager.addItem(product, 1);
        if (!res.success) {
          showToast(res.error, 'error');
        }
      });
    }
  }

  function updateCardButton(product) {
    const wrap = document.getElementById(`action-wrap-${product.id}`);
    if (!wrap) return;
    const qty = window.cartManager.getItemQuantity(product.id);
    wrap.innerHTML = renderCardButton(product, qty);
    const card = document.getElementById(`product-card-${product.id}`);
    if (card) {
      bindCardActions(card, product);
    }
  }

  // =========================================
  // PRODUCT DETAIL MODAL (Blueprint 3.3)
  // =========================================
  function openProductModal(product) {
    activeModalProduct = product;
    modalSelectedQty = 1;

    modalImg.src = product.image;
    modalImg.alt = product.name;
    modalCategory.textContent = product.category;
    modalTitle.textContent = product.name;
    modalPack.textContent = product.pack_size;
    modalDesc.textContent = product.description;
    modalPrice.textContent = window.API.formatINR(product.price);
    modalStepperVal.textContent = modalSelectedQty;

    // Stock Badge
    let badgeClass = 'badge-in-stock';
    if (product.stock <= 0) {
      badgeClass = 'badge-out-of-stock';
    } else if (product.stock_code === 'LOW_STOCK') {
      badgeClass = 'badge-low-stock';
    }
    modalStockBadge.className = `stock-badge ${badgeClass}`;
    modalStockBadge.innerHTML = `● ${product.stock_status}`;

    // Disabled state if out of stock
    if (product.stock <= 0) {
      modalAddCartBtn.disabled = true;
      modalAddCartBtn.textContent = 'Out of Stock';
      modalStepperMinus.disabled = true;
      modalStepperPlus.disabled = true;
    } else {
      modalAddCartBtn.disabled = false;
      modalAddCartBtn.textContent = `Add to Cart • ${window.API.formatINR(product.price * modalSelectedQty)}`;
      modalStepperMinus.disabled = modalSelectedQty <= 1;
      modalStepperPlus.disabled = modalSelectedQty >= product.stock;
    }

    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    activeModalProduct = null;
  }

  modalStepperMinus.addEventListener('click', () => {
    if (!activeModalProduct || modalSelectedQty <= 1) return;
    modalSelectedQty--;
    updateModalQtyUI();
  });

  modalStepperPlus.addEventListener('click', () => {
    if (!activeModalProduct) return;
    if (modalSelectedQty >= activeModalProduct.stock) {
      showToast(`Cannot exceed available stock (${activeModalProduct.stock})`, 'error');
      return;
    }
    modalSelectedQty++;
    updateModalQtyUI();
  });

  function updateModalQtyUI() {
    modalStepperVal.textContent = modalSelectedQty;
    modalStepperMinus.disabled = modalSelectedQty <= 1;
    modalStepperPlus.disabled = modalSelectedQty >= activeModalProduct.stock;
    modalAddCartBtn.textContent = `Add to Cart • ${window.API.formatINR(activeModalProduct.price * modalSelectedQty)}`;
  }

  modalAddCartBtn.addEventListener('click', () => {
    if (!activeModalProduct || activeModalProduct.stock <= 0) return;
    const res = window.cartManager.addItem(activeModalProduct, modalSelectedQty);
    if (res.success) {
      showToast(`Added ${modalSelectedQty}x ${activeModalProduct.name} to cart`);
      closeProductModal();
    } else {
      showToast(res.error, 'error');
    }
  });

  closeModalBtn.addEventListener('click', closeProductModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeProductModal();
  });

  // =========================================
  // CART DRAWER (Blueprint 3.4)
  // =========================================
  async function openCart() {
    cartBackdrop.classList.add('open');
    cartDrawer.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Re-check prices & stock on server whenever cart opens (Blueprint Rule 2)
    await window.cartManager.revalidateWithServer();
    renderCartDrawer();
  }

  function closeCart() {
    cartBackdrop.classList.remove('open');
    cartDrawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderCartDrawer() {
    const state = window.cartManager.getState();
    const validated = state.validated;

    if (!state.items || state.items.length === 0) {
      cartItemsList.innerHTML = `
        <div class="state-box" style="margin: auto 0;">
          <div class="state-icon">🛒</div>
          <div class="state-title">Your cart is empty</div>
          <div class="state-desc">Explore our fresh artisanal pizza and burger bases to start your order.</div>
          <button class="btn-primary" id="btnBrowseProducts" style="margin: 0 auto;">Browse Products</button>
        </div>
      `;
      const browseBtn = document.getElementById('btnBrowseProducts');
      if (browseBtn) browseBtn.addEventListener('click', closeCart);

      cartSubtotalEl.textContent = '₹0';
      cartDeliveryEl.textContent = '₹0';
      cartTaxEl.textContent = '—'; // GST on hold as per Rule 6
      cartGrandTotalEl.textContent = '₹0';
      checkoutBtn.disabled = true;
      cartAlertArea.innerHTML = '';
      return;
    }

    // Render items list
    cartItemsList.innerHTML = '';
    let hasBlockedItems = false;
    let alertMessages = [];

    const displayItems = (validated && validated.items) ? validated.items : state.items.map(i => ({
      id: i.id,
      name: i.product?.name || i.id,
      pack_size: i.product?.pack_size || '',
      image: i.product?.image || '/images/sourdough-pizza-base.jpg',
      unit_price: i.product?.retail_price || 0,
      quantity: i.quantity,
      total: (i.product?.retail_price || 0) * i.quantity,
      is_valid: true
    }));

    displayItems.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'cart-item-row';
      itemRow.id = `cart-item-${item.id}`;

      if (!item.is_valid) {
        hasBlockedItems = true;
        alertMessages.push(item.error || `${item.name} is currently unavailable.`);
      }

      itemRow.innerHTML = `
        <img class="cart-item-thumb" src="${item.image || '/images/sourdough-pizza-base.jpg'}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">${item.pack_size || ''}</div>
          ${!item.is_valid ? `<span style="color:var(--color-stock-out);font-size:0.75rem;font-weight:700;">${item.error}</span>` : ''}
          <div class="cart-item-stepper-row">
            <div class="card-stepper">
              <button class="stepper-btn btn-cart-minus" data-id="${item.id}">−</button>
              <span class="stepper-val">${item.quantity}</span>
              <button class="stepper-btn btn-cart-plus" data-id="${item.id}">+</button>
            </div>
            <div class="cart-item-price-col">
              <span class="cart-item-total">${window.API.formatINR(item.total)}</span>
              <span class="cart-item-unit-price">${window.API.formatINR(item.unit_price)} each</span>
              <button class="btn-remove-item" data-id="${item.id}">Remove</button>
            </div>
          </div>
        </div>
      `;

      // Steppers inside drawer
      itemRow.querySelector('.btn-cart-minus').addEventListener('click', async () => {
        window.cartManager.setItemQuantity(item.id, item.quantity - 1);
        await window.cartManager.revalidateWithServer();
        renderCartDrawer();
      });

      itemRow.querySelector('.btn-cart-plus').addEventListener('click', async () => {
        const prod = cachedProducts.find(p => p.id === item.id);
        const res = window.cartManager.addItem(prod || { id: item.id, name: item.name, stock: item.stock || 999 }, 1);
        if (!res.success) {
          showToast(res.error, 'error');
        } else {
          await window.cartManager.revalidateWithServer();
          renderCartDrawer();
        }
      });

      itemRow.querySelector('.btn-remove-item').addEventListener('click', async () => {
        window.cartManager.removeItem(item.id);
        await window.cartManager.revalidateWithServer();
        renderCartDrawer();
      });

      cartItemsList.appendChild(itemRow);
    });

    // Alert area for out of stock / offline items
    if (alertMessages.length > 0) {
      cartAlertArea.innerHTML = `
        <div class="cart-alert-box">
          ⚠️ Some items in your cart need attention before continuing to checkout.
        </div>
      `;
    } else {
      cartAlertArea.innerHTML = '';
    }

    // Totals
    const subtotal = validated ? validated.subtotal : displayItems.reduce((acc, i) => acc + i.total, 0);
    const delivery = validated ? validated.delivery_charge : 0;
    const grandTotal = validated ? validated.grand_total : subtotal + delivery;

    cartSubtotalEl.textContent = window.API.formatINR(subtotal);
    cartDeliveryEl.textContent = delivery === 0 ? 'Free' : window.API.formatINR(delivery);
    cartTaxEl.textContent = '—'; // HSN and GST on hold as per Rule 6
    cartGrandTotalEl.textContent = window.API.formatINR(grandTotal);

    checkoutBtn.disabled = hasBlockedItems || displayItems.length === 0;
  }

  checkoutBtn.addEventListener('click', () => {
    window.location.href = '/checkout.html';
  });

  headerCartBtn.addEventListener('click', openCart);
  closeCartBtn.addEventListener('click', closeCart);
  cartBackdrop.addEventListener('click', closeCart);
  mobileCartOpenBtn.addEventListener('click', openCart);

  // Subscribe cart changes to update badges and cards
  window.cartManager.subscribe(state => {
    headerCartBadge.textContent = state.totalCount;

    if (state.totalCount > 0) {
      mobileCartBar.classList.add('visible');
      mobileCartCount.textContent = `${state.totalCount} item${state.totalCount > 1 ? 's' : ''}`;
      const approxTotal = state.items.reduce((sum, item) => sum + ((item.product?.retail_price || 0) * item.quantity), 0);
      mobileCartTotal.textContent = window.API.formatINR(state.validated ? state.validated.grand_total : approxTotal);
    } else {
      mobileCartBar.classList.remove('visible');
    }

    // Refresh buttons on visible product cards
    cachedProducts.forEach(p => updateCardButton(p));
  });

  // =========================================
  // CATEGORY TABS & FILTERING
  // =========================================
  categoryTabs.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      categoryTabs.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category || 'All';
      loadProducts();
    });
  });

  // Search handling
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
    debounce(() => loadProducts(), 300)();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    loadProducts();
  });

  retryBtn.addEventListener('click', loadProducts);

  // WhatsApp Order / Chat Button
  const whatsappBtns = document.querySelectorAll('.btn-whatsapp');
  whatsappBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = encodeURIComponent("Hello Backrey Bases! I want to inquire about your pizza bases and burger buns.");
      window.open(`https://wa.me/918219775396?text=${msg}`, '_blank');
    });
  });

  // Utility Debounce
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // Count-up Stats Animation
  function initCountUp() {
    const counters = document.querySelectorAll('.countup-number');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target') || '0', 10);
          const suffix = el.getAttribute('data-suffix') || '';
          animateNumber(el, target, suffix);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(c => observer.observe(c));
  }

  function animateNumber(element, target, suffix) {
    let start = 0;
    const duration = 1600;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(easeOutQuad * target);

      element.textContent = `${current.toLocaleString()}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = `${target.toLocaleString()}${suffix}`;
      }
    }

    requestAnimationFrame(step);
  }

  initCountUp();

  // Initial Load
  loadProducts();
});
