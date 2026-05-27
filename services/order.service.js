const { Op } = require('sequelize');

class OrderService {
  constructor(models) {
    this.Order = models.Order;
    this.Cart = models.Cart;
    this.Product = models.Product;
    this.User = models.User;
    this.OdooService = require('./odoo.service');
  }

  /**
   * Process checkout and create order
   */
  async processCheckout(userId, checkoutData) {
    const transaction = await this.Order.sequelize.transaction();
    
    try {
      // Get cart and validate
      const cart = await this.Cart.findOne({
        where: { userId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      // Validate stock availability
      await this.validateStockAvailability(cart.items, transaction);

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      // Calculate totals
      const subtotal = cart.totalAmount;
      const discountAmount = cart.discountAmount || 0;
      const shippingAmount = checkoutData.shippingAmount || 0;
      const taxAmount = checkoutData.taxAmount || 0;
      const totalAmount = subtotal - discountAmount + shippingAmount + taxAmount;

      // Create order
      const order = await this.Order.create({
        orderNumber,
        userId,
        status: 'pending',
        items: cart.items,
        subtotal,
        discountAmount,
        shippingAmount,
        taxAmount,
        totalAmount,
        currency: cart.currency || 'USD',
        paymentMethod: checkoutData.paymentMethod,
        paymentStatus: 'pending',
        shippingAddress: checkoutData.shippingAddress,
        billingAddress: checkoutData.billingAddress || checkoutData.shippingAddress,
        customerNotes: checkoutData.customerNotes,
        metadata: {
          cartId: cart.cartId,
          couponCode: cart.couponCode,
          checkoutData
        }
      }, { transaction });

      // Update product quantities
      await this.updateProductQuantities(cart.items, transaction);

      // Clear cart
      await cart.update({
        items: [],
        totalAmount: 0,
        itemCount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        grandTotal: 0
      }, { transaction });

      // Commit transaction
      await transaction.commit();

      // Process payment (placeholder - integrate with your payment gateway)
      const paymentResult = await this.processPayment(order, checkoutData.paymentMethod);

      // Update order with payment result
      if (paymentResult.success) {
        await order.update({
          paymentStatus: 'paid',
          status: 'processing',
          metadata: {
            ...order.metadata,
            paymentResult
          }
        });

        // Optionally sync to Odoo
        if (process.env.SYNC_TO_ODOO === 'true') {
          try {
            await this.syncOrderToOdoo(order);
          } catch (odooError) {
            console.error('Odoo sync failed:', odooError);
            // Don't fail the order if Odoo sync fails
          }
        }
      } else {
        await order.update({
          paymentStatus: 'failed',
          status: 'failed',
          adminNotes: `Payment failed: ${paymentResult.message}`
        });
      }

      return this.getOrderDetails(order.orderId, userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Validate stock availability
   */
  async validateStockAvailability(items, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    for (const item of items) {
      const product = await this.Product.findOne({
        where: {
          productId: item.productId,
          isActive: true
        },
        ...options
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
      }
    }
  }

  /**
   * Update product quantities after order
   */
  async updateProductQuantities(items, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    for (const item of items) {
      await this.Product.decrement('quantity', {
        by: item.quantity,
        where: { productId: item.productId },
        ...options
      });
    }
  }

  /**
   * Generate unique order number
   */
  generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Process payment (placeholder - implement with your payment gateway)
   */
  async processPayment(order, paymentMethod) {
    // Implement your payment gateway integration here
    // This is a placeholder that always succeeds for demo purposes
    
    return {
      success: true,
      transactionId: `TXN-${Date.now()}`,
      message: 'Payment processed successfully',
      gateway: paymentMethod,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Sync order to Odoo
   */
  async syncOrderToOdoo(order) {
    try {
      const odooService = new this.OdooService({
        baseURL: process.env.ODOO_BASE_URL,
        database: process.env.ODOO_DATABASE,
        username: process.env.ODOO_USERNAME,
        password: process.env.ODOO_PASSWORD
      });

      // Prepare Odoo order data
      const odooOrderData = {
        partner_id: await this.getOrCreateOdooCustomer(order.userId),
        order_line: order.items.map(async item => ({
          product_id: await this.getOrCreateOdooProduct(item.productId),
          product_uom_qty: item.quantity,
          price_unit: item.price,
          name: item.name
        })),
        amount_total: order.totalAmount,
        amount_tax: order.taxAmount,
        amount_untaxed: order.subtotal,
        note: order.customerNotes
      };

      const response = await odooService.syncOrderToOdoo(odooOrderData);

      // Update order with Odoo details
      await order.update({
        odooOrderId: response.id,
        odooQuotationId: response.quotation_id,
        odooSyncStatus: 'synced',
        odooSyncResponse: response,
        odooSyncedAt: new Date(),
        status: 'synced_to_odoo'
      });

      return response;
    } catch (error) {
      await order.update({
        odooSyncStatus: 'failed',
        odooSyncResponse: { error: error.message }
      });
      throw error;
    }
  }

  /**
   * Get or create Odoo customer
   */
  async getOrCreateOdooCustomer(userId) {
    // Implement Odoo customer sync logic
    // This should return Odoo partner_id
    return null; // Placeholder
  }

  /**
   * Get or create Odoo product
   */
  async getOrCreateOdooProduct(productId) {
    // Implement Odoo product sync logic
    // This should return Odoo product_id
    return null; // Placeholder
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId, filters = {}) {
    try {
      const {
        status,
        startDate,
        endDate,
        page = 1,
        limit = 10
      } = filters;

      const where = { userId };
      const offset = (page - 1) * limit;

      // Apply filters
      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const { count, rows } = await this.Order.findAndCountAll({
        where,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return { count, rows };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId, userId = null) {
    try {
      const where = { orderId };
      if (userId) {
        where.userId = userId;
      }

      const order = await this.Order.findOne({
        where,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName', 'email']
          }
        ]
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Enrich order items with product details
      if (order.items && order.items.length > 0) {
        const productIds = order.items.map(item => item.productId);
        const products = await this.Product.findAll({
          where: {
            productId: productIds
          },
          attributes: ['productId', 'name', 'sku', 'thumbnail']
        });

        const productMap = products.reduce((map, product) => {
          map[product.productId] = product;
          return map;
        }, {});

        order.items = order.items.map(item => ({
          ...item,
          product: productMap[item.productId] || null
        }));
      }

      return order;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, userId, reason) {
    const transaction = await this.Order.sequelize.transaction();
    
    try {
      const order = await this.Order.findOne({
        where: {
          orderId,
          userId
        },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Check if order can be cancelled
      const cancellableStatuses = ['pending', 'processing'];
      if (!cancellableStatuses.includes(order.status)) {
        throw new Error('Cannot cancel order in current status');
      }

      // Restore product quantities
      await this.restoreProductQuantities(order.items, transaction);

      // Update order status
      await order.update({
        status: 'cancelled',
        adminNotes: reason ? `Cancelled by user: ${reason}` : 'Cancelled by user',
        metadata: {
          ...order.metadata,
          cancelledAt: new Date().toISOString(),
          cancelledBy: userId
        }
      }, { transaction });

      // Process refund if payment was made
      if (order.paymentStatus === 'paid') {
        await this.processRefund(order, transaction);
      }

      await transaction.commit();
      return this.getOrderDetails(orderId, userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Restore product quantities after cancellation
   */
  async restoreProductQuantities(items, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    for (const item of items) {
      await this.Product.increment('quantity', {
        by: item.quantity,
        where: { productId: item.productId },
        ...options
      });
    }
  }

  /**
   * Process refund (placeholder)
   */
  async processRefund(order, transaction = null) {
    // Implement refund logic with your payment gateway
    return {
      success: true,
      refundId: `REF-${Date.now()}`,
      amount: order.totalAmount,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Update order status (Admin)
   */
  async updateOrderStatus(orderId, status, adminNotes = null) {
    try {
      const order = await this.Order.findByPk(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      const updates = { status };
      
      if (adminNotes) {
        updates.adminNotes = adminNotes;
      }

      // Update payment status based on order status
      if (status === 'completed') {
        updates.paymentStatus = 'paid';
      } else if (status === 'cancelled') {
        updates.paymentStatus = 'refunded';
      }

      await order.update(updates);
      return this.getOrderDetails(orderId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all orders (Admin)
   */
  async getAllOrders(filters = {}) {
    try {
      const {
        status,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 20
      } = filters;

      const where = {};
      const offset = (page - 1) * limit;

      // Apply filters
      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      if (search) {
        where[Op.or] = [
          { orderNumber: { [Op.like]: `%${search}%` } },
          { '$user.userName$': { [Op.like]: `%${search}%` } },
          { '$user.email$': { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows } = await this.Order.findAndCountAll({
        where,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return { count, rows };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(filters = {}) {
    try {
      const { startDate, endDate } = filters;
      
      const where = {};
      const dateWhere = {};

      if (startDate || endDate) {
        dateWhere.createdAt = {};
        if (startDate) dateWhere.createdAt[Op.gte] = new Date(startDate);
        if (endDate) dateWhere.createdAt[Op.lte] = new Date(endDate);
      }

      // Total orders
      const totalOrders = await this.Order.count({
        where: dateWhere
      });

      // Total revenue
      const revenueResult = await this.Order.sum('totalAmount', {
        where: {
          ...dateWhere,
          status: ['completed', 'processing']
        }
      });
      const totalRevenue = revenueResult || 0;

      // Average order value
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Orders by status
      const statusCounts = await this.Order.findAll({
        attributes: [
          'status',
          [this.Order.sequelize.fn('COUNT', this.Order.sequelize.col('status')), 'count']
        ],
        where: dateWhere,
        group: ['status']
      });

      // Recent orders
      const recentOrders = await this.Order.findAll({
        where: dateWhere,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userName', 'email']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      // Top products
      const allOrders = await this.Order.findAll({
        where: dateWhere,
        attributes: ['items']
      });

      const productSales = {};
      allOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (!productSales[item.productId]) {
              productSales[item.productId] = {
                productId: item.productId,
                name: item.name,
                quantity: 0,
                revenue: 0
              };
            }
            productSales[item.productId].quantity += item.quantity;
            productSales[item.productId].revenue += item.price * item.quantity;
          });
        }
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        summary: {
          totalOrders,
          totalRevenue,
          avgOrderValue,
          pendingOrders: statusCounts.find(s => s.status === 'pending')?.count || 0,
          completedOrders: statusCounts.find(s => s.status === 'completed')?.count || 0
        },
        statusDistribution: statusCounts,
        recentOrders,
        topProducts,
        dateRange: {
          startDate,
          endDate
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Resend order confirmation
   */
  async resendConfirmation(orderId, userId) {
    try {
      const order = await this.getOrderDetails(orderId, userId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      // Implement email sending logic here
      // This is a placeholder
      const emailSent = await this.sendOrderConfirmationEmail(order);

      return {
        success: emailSent,
        message: emailSent ? 'Confirmation email sent' : 'Failed to send email',
        order
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send order confirmation email (placeholder)
   */
  async sendOrderConfirmationEmail(order) {
    // Implement email sending logic
    return true; // Placeholder
  }

  /**
   * Track order shipment
   */
  async trackOrder(orderId, userId) {
    try {
      const order = await this.getOrderDetails(orderId, userId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      // Implement shipment tracking logic
      // This is a placeholder
      const trackingInfo = {
        orderId: order.orderId,
        status: order.status,
        estimatedDelivery: this.calculateEstimatedDelivery(order.createdAt),
        trackingNumber: `TRK-${order.orderNumber}`,
        carrier: 'Standard Shipping',
        lastUpdate: new Date().toISOString(),
        events: [
          {
            date: order.createdAt,
            status: 'Order Placed',
            location: 'Warehouse',
            description: 'Order received and being processed'
          }
        ]
      };

      if (order.status === 'processing') {
        trackingInfo.events.push({
          date: new Date(),
          status: 'Processing',
          location: 'Warehouse',
          description: 'Order is being prepared for shipment'
        });
      }

      return trackingInfo;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate estimated delivery date
   */
  calculateEstimatedDelivery(orderDate) {
    const deliveryDate = new Date(orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 7); // 7 days for standard shipping
    return deliveryDate.toISOString();
  }
}

module.exports = OrderService;