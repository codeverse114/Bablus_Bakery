/**
 * BACKREY BASES - API CLIENT
 */

const API = {
  baseUrl: '/api',

  // Indian Rupee number formatting (Blueprint Section 7: always in ₹ with Indian number formatting)
  formatINR(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  },

  getAuthHeaders(extra = {}) {
    const token = localStorage.getItem('backrey_wholesale_token') || localStorage.getItem('backrey_customer_token');
    const headers = { ...extra };
    if (token) {
      headers['x-customer-token'] = token;
      headers['x-wholesale-token'] = token;
    }
    return headers;
  },

  async getProducts(category = 'All', search = '') {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);

    const res = await fetch(`${this.baseUrl}/products?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Failed to load products: ${res.statusText}`);
    }
    return await res.json();
  },

  async getProductDetail(id) {
    const res = await fetch(`${this.baseUrl}/products/${encodeURIComponent(id)}`, {
      headers: this.getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error(`Product not found or unavailable.`);
    }
    return await res.json();
  },

  async validateCart(items) {
    const headers = this.getAuthHeaders({ 'Content-Type': 'application/json' });

    const res = await fetch(`${this.baseUrl}/cart/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items })
    });

    if (!res.ok) {
      throw new Error(`Cart validation failed: ${res.statusText}`);
    }
    return await res.json();
  },

  async startCheckout(items, customer, inShop = false) {
    const headers = this.getAuthHeaders({ 'Content-Type': 'application/json' });

    const res = await fetch(`${this.baseUrl}/checkout/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items, customer, inShop })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Checkout initiation failed.');
    }
    return data;
  },

  async cancelCheckout(reservationId) {
    const res = await fetch(`${this.baseUrl}/checkout/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId })
    });
    return await res.json();
  },

  async submitPaymentWebhook(payload) {
    const res = await fetch(`${this.baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Payment confirmation failed.');
    }
    return data;
  },

  async trackOrder(orderNo, phone = '') {
    const params = new URLSearchParams();
    if (phone) params.append('phone', phone);
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(orderNo)}?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to find order.');
    }
    return data;
  }
};

window.API = API;
