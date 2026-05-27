module.exports = (sequelize, Sequelize) => {
  const Wishlist = sequelize.define('wishlist', {
    wishlistId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    name: {
      type: Sequelize.STRING(100),
      defaultValue: 'My Wishlist'
    },
    items: {
      type: Sequelize.JSON,
      defaultValue: [],
      comment: 'Array of product IDs or full product data'
    },
    isDefault: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    isPrivate: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'wishlists',
    timestamps: true,
    indexes: [
      {
        name: 'idx_wishlist_user',
        fields: ['userId']
      },
      {
        name: 'idx_wishlist_default',
        fields: ['userId', 'isDefault']
      }
    ]
  });

  return Wishlist;
};