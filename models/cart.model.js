// models/Cart.js
const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Cart = sequelize.define('Cart', {
    cartId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true
    },

    items: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      get() {
        const raw = this.getDataValue('items');
        try {
          return JSON.parse(raw || '[]');
        } catch (e) {
          return [];
        }
      },
      set(value) {
        this.setDataValue('items', JSON.stringify(value || []));
      }
    },

    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const value = this.getDataValue('totalAmount');
        return parseFloat(value) || 0;
      }
    },
    itemCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    shippingAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const value = this.getDataValue('shippingAmount');
        return parseFloat(value) || 0;
      }
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const value = this.getDataValue('taxAmount');
        return parseFloat(value) || 0;
      }
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const value = this.getDataValue('discountAmount');
        return parseFloat(value) || 0;
      }
    },
    grandTotal: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      get() {
        const value = this.getDataValue('grandTotal');
        return parseFloat(value) || 0;
      }
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    couponCode: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'carts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId'],
        where: {
          userId: {
            [Op.ne]: null
          }
        }
      },
      {
        unique: true,
        fields: ['sessionId'],
        where: {
          sessionId: {
            [Op.ne]: null
          }
        }
      }
    ]
  });

  Cart.associate = (models) => {
    Cart.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Cart;
};

