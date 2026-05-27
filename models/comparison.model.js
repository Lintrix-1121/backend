module.exports = (sequelize, Sequelize) => {
  const Comparison = sequelize.define('comparison', {
    comparisonId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    sessionId: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    name: {
      type: Sequelize.STRING(100),
      defaultValue: 'Product Comparison'
    },
    productIds: {
      type: Sequelize.JSON,
      defaultValue: [],
      validate: {
        maxLength(value) {
          if (value && value.length > 4) {
            throw new Error('Cannot compare more than 4 products');
          }
        }
      }
    },
    categoryId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'categoryId'
      }
    },
    viewedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    expiresAt: {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'For session-based comparisons'
    }
  }, {
    tableName: 'comparisons',
    timestamps: true,
    indexes: [
      {
        name: 'idx_comparison_user',
        fields: ['userId']
      },
      {
        name: 'idx_comparison_session',
        fields: ['sessionId']
      }
    ]
  });

  return Comparison;
};