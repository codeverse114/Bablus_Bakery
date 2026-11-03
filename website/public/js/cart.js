/**
 * BACKREY BASES - CART STATE MANAGER
 * Client-side Cart with Server Re-validation (Blueprint Rule 1 & Rule 2)
 */

class CartManager {
  constructor() {
    this.storageKey = 'backrey_cart_v1';
    this.listeners = [];
    this.cartData = this.loadCart();
    this.validatedCart = null;
    this.isValidating = false;
  }

  loadCart() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading cart from localStorage', e);
    }
    return { items: [] };
  }

  saveCart() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cartData));
    } catch (e) {
      console.warn('Error saving cart to localStorage', e);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  getState() {
    const totalItems = this.cartData.items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      items: this.cartData.items,
      totalCount: totalItems,
      validated: this.validatedCart,
      isValidating: this.isValidating
    };
  }

  getItemQuantity(productId) {
    const item = this.cartData.items.find(i => i.id === productId);
    return item ? item.quantity : 0;
  }

  /**
   * Add or increment product in cart
   * Validates max available stock (Test G2: Add more than stock is BLOCKED)
   */
  addItem(product, qtyToAdd = 1) {
    if (!product || !product.id) return { success: false, error: 'Invalid product' };

    const maxStock = product.stock !== undefined ? product.stock : 999;
    if (maxStock <= 0) {
      return { success: false, error: `"${product.name}" is out of stock.` };
    }

    const existingIndex = this.cartData.items.findIndex(i => i.id === product.id);
    let targetQty = qtyToAdd;

    if (existingIndex > -1) {
      targetQty = this.cartData.items[existingIndex].quantity + qtyToAdd;
    }

    if (targetQty > maxStock) {
      return { 
        success: false, 
        error: `Cannot add more than available stock (${maxStock} units).` 
      };
    }

    if (existingIndex > -1) {
      this.cartData.items[existingIndex].quantity = targetQty;
      this.cartData.items[existingIndex].product = product; // local cache
    } else {
      this.cartData.items.push({
        id: product.id,
        quantity: targetQty,
        product: {
          id: product.id,
          name: product.name,
          pack_size: product.pack_size,
          retail_price: product.retail_price || product.price,
          stock: product.stock,
          image: product.image
        }
      });
    }

    this.saveCart();
    return { success: true, quantity: targetQty };
  }

  /**
   * Set specific quantity for an item
   */
  setItemQuantity(productId, newQty, productMeta = null) {
    if (newQty <= 0) {
      return this.removeItem(productId);
    }

    const existingIndex = this.cartData.items.findIndex(i => i.id === productId);
    const product = productMeta || (existingIndex > -1 ? this.cartData.items[existingIndex].product : null);
    const maxStock = product && product.stock !== undefined ? product.stock : 999;

    if (newQty > maxStock) {
      return { 
        success: false, 
        error: `Cannot exceed available stock of ${maxStock} units.` 
      };
    }

    if (existingIndex > -1) {
      this.cartData.items[existingIndex].quantity = newQty;
    } else if (product) {
      this.cartData.items.push({
        id: productId,
        quantity: newQty,
        product
      });
    }

    this.saveCart();
    return { success: true, quantity: newQty };
  }

  removeItem(productId) {
    this.cartData.items = this.cartData.items.filter(i => i.id !== productId);
    this.saveCart();
    return { success: true };
  }

  clearCart() {
    this.cartData.items = [];
    this.validatedCart = null;
    this.saveCart();
  }

  /**
   * Re-check cart against server (Blueprint Rule 2 & Section 3.4)
   * Stored in browser for guests, but verified against server truth
   */
  async revalidateWithServer() {
    if (this.cartData.items.length === 0) {
      this.validatedCart = {
        is_valid: true,
        items: [],
        subtotal: 0,
        delivery_charge: 0,
        tax_gst: 0,
        grand_total: 0
      };
      this.notify();
      return this.validatedCart;
    }

    this.isValidating = true;
    this.notify();

    try {
      const itemsPayload = this.cartData.items.map(item => ({
        id: item.id,
        quantity: item.quantity
      }));

      const res = await window.API.validateCart(itemsPayload);
      if (res && res.success) {
        this.validatedCart = res;
      }
    } catch (err) {
      console.error('Failed to validate cart with server:', err);
    } finally {
      this.isValidating = false;
      this.notify();
    }

    return this.validatedCart;
  }
}

window.cartManager = new CartManager();
