module.exports = (sequelize, Sequelize) => {
  const Order = sequelize.define('order', {
    orderId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    orderNumber: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    status: {
      type: Sequelize.ENUM(
        'pending',
        'processing',
        'on_hold',
        'completed',
        'cancelled',
        'refunded',
        'failed',
        'synced_to_odoo',
        'odoo_confirmed'
      ),
      defaultValue: 'pending'
    },
    items: {
      type: Sequelize.JSON,
      allowNull: false,
      comment: 'Order items with product details'
    },
    subtotal: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    discountAmount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    },
    shippingAmount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    },
    taxAmount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    },
    totalAmount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: Sequelize.STRING(3),
      defaultValue: 'USD'
    },
    paymentMethod: {
      type: Sequelize.STRING(50),
      allowNull: true
    },
    paymentStatus: {
      type: Sequelize.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    shippingAddress: {
      type: Sequelize.JSON,
      allowNull: true
    },
    billingAddress: {
      type: Sequelize.JSON,
      allowNull: true
    },
    customerNotes: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    adminNotes: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    odooOrderId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Order ID from Odoo SaaS'
    },
    odooQuotationId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Quotation ID in Odoo'
    },
    odooCustomerId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Customer/Partner ID in Odoo'
    },
    odooSyncStatus: {
      type: Sequelize.ENUM('pending', 'syncing', 'synced', 'failed'),
      defaultValue: 'pending'
    },
    odooSyncResponse: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Response from Odoo API'
    },
    odooSyncedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    metadata: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional order metadata'
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    indexes: [
      {
        name: 'idx_order_user',
        fields: ['userId']
      },
      {
        name: 'idx_order_number',
        fields: ['orderNumber'],
        unique: true
      },
      {
        name: 'idx_order_status',
        fields: ['status']
      },
      {
        name: 'idx_order_odoo',
        fields: ['odooOrderId']
      }
    ]
  });

  return Order;
};