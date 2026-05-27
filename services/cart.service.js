const { Op } = require('sequelize');

class CartService {
  constructor(models) {
    console.log('🛒 CartService constructor called');
    console.log('📦 Models type:', typeof models);
    console.log('🔑 Models keys:', models ? Object.keys(models) : 'models is null/undefined');
    
    // Validate models parameter
    if (!models) {
      console.error('❌ Models parameter is null or undefined');
      console.log('⚠️ Attempting to load models directly...');
      
      try {
        models = require('../models');
        console.log('✅ Models loaded successfully from require');
      } catch (error) {
        console.error('❌ Failed to load models:', error.message);
        // Create fallback models structure
        models = this.createFallbackModels();
      }
    }
    
    // Check if models has Cart property
    if (!models.Cart) {
      console.warn('⚠️ models.Cart is undefined. Checking available models...');
      console.log('📋 Available models:', Object.keys(models).filter(key => 
        !['sequelize', 'Sequelize', 'Op'].includes(key)
      ));
      
      // Try to find Cart model with different casing
      const modelKeys = Object.keys(models);
      const cartKey = modelKeys.find(key => 
        key.toLowerCase() === 'cart' || key === 'Cart'
      );
      
      if (cartKey) {
        console.log(`✅ Found Cart model as: ${cartKey}`);
        this.Cart = models[cartKey];
      } else {
        console.error('❌ Cart model not found in models object');
        console.log('📊 Creating fallback Cart model...');
        this.Cart = this.createFallbackCartModel();
      }
    } else {
      this.Cart = models.Cart;
      console.log('✅ Cart model initialized successfully');
    }
    
    // Initialize other models with fallbacks
    this.Product = models.Product || this.createFallbackProductModel();
    this.User = models.User || this.createFallbackUserModel();
    this.Order = models.Order || this.createFallbackOrderModel();
    
    console.log('🛒 CartService initialized');
    console.log('✅ Models initialized:', {
      Cart: !!this.Cart,
      Product: !!this.Product,
      User: !!this.User,
      Order: !!this.Order
    });
  }

  // Fallback model creation methods
  createFallbackModels() {
    return {
      Cart: this.createFallbackCartModel(),
      Product: this.createFallbackProductModel(),
      User: this.createFallbackUserModel(),
      Order: this.createFallbackOrderModel()
    };
  }

  createFallbackCartModel() {
    console.log('🛠️ Creating fallback Cart model');
    return {
      findOne: async (options) => {
        console.log('🛠️ Fallback Cart.findOne called:', options?.where);
        return null;
      },
      findAll: async () => [],
      create: async (data) => {
        console.log('🛠️ Fallback Cart.create called:', data);
        const cart = {
          ...data,
          cartId: Date.now(),
          totalAmount: 0,
          itemCount: 0,
          items: [],
          get: () => cart,
          update: async (updateData) => {
            Object.assign(cart, updateData);
            return [1];
          },
          destroy: async () => 1
        };
        return cart;
      },
      update: async () => [1],
      destroy: async () => 1
    };
  }

  createFallbackProductModel() {
    return {
      findOne: async () => null,
      findAll: async () => [],
      findByPk: async (id) => {
        console.log('🛠️ Fallback Product.findByPk called for id:', id);
        return null;
      }
    };
  }

  createFallbackUserModel() {
    return {
      findOne: async () => null
    };
  }

  createFallbackOrderModel() {
    return {
      findOne: async () => null
    };
  }

  // Create empty cart structure
  createEmptyCart() {
    return {
      cartId: null,
      userId: null,
      sessionId: null,
      totalAmount: 0,
      itemCount: 0,
      discountAmount: 0,
      shippingAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      couponCode: null,
      items: [],
      get: () => this.createEmptyCart()
    };
  }

  /**
   * Get or create cart for user OR session
   */
  async getUserCart(userId, sessionId = null) {
    try {
      console.log('📦 getUserCart called:', { userId, sessionId });
      
      // Check if Cart model is available
      if (!this.Cart || !this.Cart.findOne) {
        console.warn('⚠️ Cart model not available, returning empty cart');
        return this.createEmptyCart();
      }
      
      // Build where clause
      const where = {};
      if (userId) {
        where.userId = userId;
      } else if (sessionId) {
        where.sessionId = sessionId;
      } else {
        console.warn('⚠️ No userId or sessionId provided, returning empty cart');
        return this.createEmptyCart();
      }
      
      // Try to find existing cart
      let cart = await this.Cart.findOne({ where });
      
      if (!cart) {
        console.log('🛒 No cart found, creating new cart');
        // Create new cart with empty items array
        cart = await this.Cart.create({
          userId: userId || null,
          sessionId: sessionId || null,
          items: [], // Empty array
          totalAmount: 0,
          itemCount: 0,
          discountAmount: 0,
          shippingAmount: 0,
          taxAmount: 0,
          grandTotal: 0,
          currency: 'USD',
          couponCode: null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Convert cart to plain object
      const cartData = cart.get ? cart.get({ plain: true }) : cart;
      
      // Ensure items is always an array
      if (!Array.isArray(cartData.items)) {
        console.warn('⚠️ items is not an array, resetting to empty array');
        cartData.items = [];
      }
      
      // Calculate totals from items
      if (cartData.items && cartData.items.length > 0) {
        const recalculatedTotal = cartData.items.reduce((sum, item) => 
          sum + (item.total || (item.price * item.quantity) || 0), 0
        );
        const recalculatedCount = cartData.items.reduce((sum, item) => 
          sum + (item.quantity || 0), 0
        );
        
        // Update cart totals if they don't match
        if (cartData.totalAmount !== recalculatedTotal || cartData.itemCount !== recalculatedCount) {
          console.log('🔄 Recalculating cart totals...');
          cartData.totalAmount = recalculatedTotal;
          cartData.itemCount = recalculatedCount;
          cartData.grandTotal = recalculatedTotal - (cartData.discountAmount || 0);
        }
      }
      
      console.log('✅ Cart retrieved/created:', cartData.cartId, 'items:', cartData.items.length);
      return cartData;
      
    } catch (error) {
      console.error('❌ Error in getUserCart:', error);
      return this.createEmptyCart();
    }
  }

  /**
   * Add item to cart - USING JSON ITEMS FIELD
   */
  async addToCart(userId, productId, quantity = 1, sessionId = null) {
    try {
      console.log('➕ addToCart called:', { userId, productId, quantity, sessionId });
      
      if (!productId) {
        throw new Error('Product ID is required');
      }
      
      // Validate quantity
      quantity = parseInt(quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
      }
      
      // Get or create cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        throw new Error('Failed to retrieve or create cart');
      }
      
      // Get product
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      console.log('✅ Product found:', {
        id: product.productId,
        name: product.name,
        price: product.price,
        stock: product.quantity,
        isActive: product.isActive
      });
      
      // Check if product is active and in stock
      if (!product.isActive) {
        throw new Error('Product is not available');
      }
      
      if (product.quantity < quantity) {
        throw new Error(`Only ${product.quantity} items available`);
      }
      
      // Get current items from cart
      let items = cart.items || [];
      
      // Ensure items is an array
      if (!Array.isArray(items)) {
        console.warn('⚠️ items is not an array, resetting to empty array');
        items = [];
      }
      
      // Check if item already exists in cart
      const existingItemIndex = items.findIndex(item => item.productId == productId);
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        const newQuantity = items[existingItemIndex].quantity + quantity;
        
        if (product.quantity < newQuantity) {
          throw new Error(`Only ${product.quantity} items available. You already have ${items[existingItemIndex].quantity} in cart.`);
        }
        
        items[existingItemIndex].quantity = newQuantity;
        items[existingItemIndex].total = items[existingItemIndex].price * newQuantity;
        items[existingItemIndex].updatedAt = new Date().toISOString();
        
        console.log(`🔄 Updated existing cart item: ${productId}, new quantity: ${newQuantity}`);
      } else {
        // Add new item
        const newItem = {
          cartItemId: Date.now(), // Temporary ID
          productId: product.productId,
          name: product.name,
          price: parseFloat(product.price),
          thumbnail: product.thumbnail || '',
          quantity: quantity,
          total: parseFloat(product.price) * quantity,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sku: product.sku
        };
        
        items.push(newItem);
        console.log(`🆕 Added new item to cart:`, newItem);
      }
      
      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const grandTotal = totalAmount - (cart.discountAmount || 0) + (cart.shippingAmount || 0) + (cart.taxAmount || 0);
      
      console.log('📊 Cart totals:', { totalAmount, itemCount, grandTotal });
      
      // Update cart with new items and totals
      await this.Cart.update({
        items: items,
        totalAmount: totalAmount,
        itemCount: itemCount,
        grandTotal: grandTotal,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log('✅ Cart updated successfully');
      
      // Return updated cart
      return await this.getUserCart(userId, sessionId);
      
    } catch (error) {
      console.error('❌ Error in addToCart:', error);
      throw error;
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId, productId, quantity, sessionId = null) {
    try {
      console.log('✏️ updateCartItem called:', { userId, productId, quantity, sessionId });
      
      if (!productId || quantity === undefined) {
        throw new Error('Product ID and quantity are required');
      }
      
      quantity = parseInt(quantity);
      if (isNaN(quantity) || quantity < 0) {
        throw new Error('Quantity must be a non-negative number');
      }
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        throw new Error('Cart not found');
      }
      
      // Get current items
      let items = cart.items || [];
      if (!Array.isArray(items)) {
        items = [];
      }
      
      // Find item index
      const itemIndex = items.findIndex(item => item.productId == productId);
      
      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }
      
      if (quantity === 0) {
        // Remove item
        items.splice(itemIndex, 1);
        console.log(`🗑️ Removed item from cart: ${productId}`);
      } else {
        // Check product stock
        const product = await this.Product.findByPk(productId);
        if (!product) {
          throw new Error('Product not found');
        }
        
        if (product.quantity < quantity) {
          throw new Error(`Only ${product.quantity} items available`);
        }
        
        // Update quantity
        items[itemIndex].quantity = quantity;
        items[itemIndex].total = items[itemIndex].price * quantity;
        items[itemIndex].updatedAt = new Date().toISOString();
        
        console.log(`📝 Updated item quantity: ${productId} -> ${quantity}`);
      }
      
      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const grandTotal = totalAmount - (cart.discountAmount || 0) + (cart.shippingAmount || 0) + (cart.taxAmount || 0);
      
      // Update cart
      await this.Cart.update({
        items: items,
        totalAmount: totalAmount,
        itemCount: itemCount,
        grandTotal: grandTotal,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log('✅ Cart updated');
      
      // Return updated cart
      return await this.getUserCart(userId, sessionId);
      
    } catch (error) {
      console.error('❌ Error in updateCartItem:', error);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId, productId, sessionId = null) {
    try {
      console.log('🗑️ removeFromCart called:', { userId, productId, sessionId });
      
      if (!productId) {
        throw new Error('Product ID is required');
      }
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        throw new Error('Cart not found');
      }
      
      // Get current items
      let items = cart.items || [];
      if (!Array.isArray(items)) {
        items = [];
      }
      
      // Filter out the item to remove
      const initialLength = items.length;
      items = items.filter(item => item.productId != productId);
      
      if (items.length === initialLength) {
        throw new Error('Item not found in cart');
      }
      
      console.log(`✅ Removed item from cart: ${productId}`);
      
      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const grandTotal = totalAmount - (cart.discountAmount || 0) + (cart.shippingAmount || 0) + (cart.taxAmount || 0);
      
      // Update cart
      await this.Cart.update({
        items: items,
        totalAmount: totalAmount,
        itemCount: itemCount,
        grandTotal: grandTotal,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log('✅ Cart updated after removal');
      
      // Return updated cart
      return await this.getUserCart(userId, sessionId);
      
    } catch (error) {
      console.error('❌ Error in removeFromCart:', error);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  async clearCart(userId, sessionId = null) {
    try {
      console.log('🧹 clearCart called:', { userId, sessionId });
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        return true; // Nothing to clear
      }
      
      // Update cart to empty
      await this.Cart.update({
        items: [],
        totalAmount: 0,
        itemCount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        couponCode: null,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log(`✅ Cleared cart: ${cart.cartId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Error in clearCart:', error);
      throw error;
    }
  }

  /**
   * Get cart summary
   */
  async getCartSummary(userId, sessionId = null) {
    try {
      console.log('📊 getCartSummary called:', { userId, sessionId });
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      // If no cart or cart has no items, return empty summary
      if (!cart || !cart.items || cart.items.length === 0) {
        return this.createEmptyCart();
      }
      
      // Calculate totals from items
      const itemCount = cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalAmount = cart.items.reduce((sum, item) => sum + (item.total || 0), 0);
      
      // Format response
      return {
        cartId: cart.cartId,
        userId: cart.userId,
        sessionId: cart.sessionId,
        totalAmount: totalAmount,
        itemCount: itemCount,
        discountAmount: cart.discountAmount || 0,
        shippingAmount: cart.shippingAmount || 0,
        taxAmount: cart.taxAmount || 0,
        grandTotal: totalAmount - (cart.discountAmount || 0) + (cart.shippingAmount || 0) + (cart.taxAmount || 0),
        couponCode: cart.couponCode,
        items: cart.items ? cart.items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total || item.price * item.quantity,
          thumbnail: item.thumbnail,
          sku: item.sku,
          addedAt: item.addedAt,
          updatedAt: item.updatedAt
        })) : []
      };
      
    } catch (error) {
      console.error('❌ Error in getCartSummary:', error);
      return this.createEmptyCart();
    }
  }

  /**
   * Merge guest cart with user cart after login
   */
  async mergeCarts(userId, sessionId) {
    try {
      console.log('🔄 mergeCarts called:', { userId, sessionId });
      
      if (!userId || !sessionId) {
        throw new Error('Both userId and sessionId are required');
      }
      
      // Get both carts
      const userCart = await this.getUserCart(userId, null);
      const guestCart = await this.getUserCart(null, sessionId);
      
      // If guest cart has no items, return user cart
      if (!guestCart.items || guestCart.items.length === 0) {
        console.log('✅ Guest cart empty, returning user cart');
        return userCart;
      }
      
      // Start with user cart items
      let mergedItems = [...(userCart.items || [])];
      
      // Merge items from guest cart
      for (const guestItem of guestCart.items) {
        const existingItemIndex = mergedItems.findIndex(item => 
          item.productId == guestItem.productId
        );
        
        if (existingItemIndex >= 0) {
          // Update quantity
          mergedItems[existingItemIndex].quantity += guestItem.quantity;
          mergedItems[existingItemIndex].total = 
            mergedItems[existingItemIndex].price * mergedItems[existingItemIndex].quantity;
          mergedItems[existingItemIndex].updatedAt = new Date().toISOString();
          
          console.log(`🔄 Merged existing item: ${guestItem.productId}, new quantity: ${mergedItems[existingItemIndex].quantity}`);
        } else {
          // Add new item
          mergedItems.push({
            ...guestItem,
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log(`📝 Added new item from guest cart: ${guestItem.productId}`);
        }
      }
      
      // Calculate totals
      const totalAmount = mergedItems.reduce((sum, item) => sum + (item.total || 0), 0);
      const itemCount = mergedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const grandTotal = totalAmount - (userCart.discountAmount || 0) + (userCart.shippingAmount || 0) + (userCart.taxAmount || 0);
      
      // Update user cart
      await this.Cart.update({
        items: mergedItems,
        totalAmount: totalAmount,
        itemCount: itemCount,
        grandTotal: grandTotal,
        updatedAt: new Date()
      }, {
        where: { cartId: userCart.cartId }
      });
      
      // Delete guest cart
      await this.Cart.destroy({
        where: { cartId: guestCart.cartId }
      });
      
      console.log('✅ Carts merged successfully');
      
      // Return updated user cart
      return await this.getUserCart(userId, null);
      
    } catch (error) {
      console.error('❌ Error in mergeCarts:', error);
      throw error;
    }
  }

  /**
   * Recalculate cart totals
   */
  async recalculateCart(cartId) {
    try {
      console.log('🧮 recalculateCart called for cartId:', cartId);
      
      if (!cartId) {
        console.warn('⚠️ No cartId provided for recalculateCart');
        return;
      }
      
      // Get cart
      const cart = await this.Cart.findByPk(cartId);
      if (!cart) {
        console.warn('⚠️ Cart not found for recalculation');
        return;
      }
      
      const cartData = cart.get({ plain: true });
      const items = cartData.items || [];
      
      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
      const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const grandTotal = totalAmount - (cartData.discountAmount || 0) + (cartData.shippingAmount || 0) + (cartData.taxAmount || 0);
      
      // Update cart
      await this.Cart.update({
        totalAmount: totalAmount,
        itemCount: itemCount,
        grandTotal: grandTotal,
        updatedAt: new Date()
      }, {
        where: { cartId: cartId }
      });
      
      console.log(`✅ Cart ${cartId} recalculated: total=${totalAmount}, items=${itemCount}`);
      
    } catch (error) {
      console.error('❌ Error in recalculateCart:', error);
    }
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId, couponCode, sessionId = null) {
    try {
      console.log('🎫 applyCoupon called:', { userId, couponCode, sessionId });
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        throw new Error('Cart not found');
      }
      
      // For now, apply a simple 10% discount for testing
      const discountAmount = cart.totalAmount * 0.1;
      
      await this.Cart.update({
        discountAmount: discountAmount,
        grandTotal: cart.totalAmount - discountAmount,
        couponCode: couponCode,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log(`✅ Coupon applied: ${couponCode}, discount: ${discountAmount}`);
      return await this.getUserCart(userId, sessionId);
      
    } catch (error) {
      console.error('❌ Error in applyCoupon:', error);
      throw error;
    }
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId, sessionId = null) {
    try {
      console.log('🗑️ removeCoupon called:', { userId, sessionId });
      
      // Get cart
      const cart = await this.getUserCart(userId, sessionId);
      
      if (!cart || !cart.cartId) {
        throw new Error('Cart not found');
      }
      
      await this.Cart.update({
        discountAmount: 0,
        grandTotal: cart.totalAmount,
        couponCode: null,
        updatedAt: new Date()
      }, {
        where: { cartId: cart.cartId }
      });
      
      console.log('✅ Coupon removed');
      return await this.getUserCart(userId, sessionId);
      
    } catch (error) {
      console.error('❌ Error in removeCoupon:', error);
      throw error;
    }
  }
}

module.exports = CartService;


