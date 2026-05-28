module.exports = (sequelize, Sequelize) => {
  const Product = sequelize.define('product', {
    productId: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    sku: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    comparePrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Original price for discount display'
    },
    cost: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Product cost for margin calculation'
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    categoryId: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'categoryId'
      }
    },
    subCategoryId: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'categoryId'
      }
    },
    brand: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    images: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of image URLs'
    },
    thumbnail: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    weight: {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,
      comment: 'Weight in grams'
    },
    dimensions: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '{length, width, height} in cm'
    },
    specifications: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Product specifications JSON'
    },
    tags: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of tags for search/filter'
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    isFeatured: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    isOnSale: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    salePrice: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    },
    saleStart: {
      type: Sequelize.DATE,
      allowNull: true
    },
    saleEnd: {
      type: Sequelize.DATE,
      allowNull: true
    },
    metaTitle: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    metaDescription: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    odooProductId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      unique: true,
      comment: 'Product ID from Odoo SaaS database'
    },
    odooTemplateId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Product template ID from Odoo'
    },
    odooVariantId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Variant ID for Odoo'
    },
    lastSyncedAt: {
      type: Sequelize.DATE,
      allowNull: true
    }
  }, {
    tableName: 'products',
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        name: 'idx_product_name',
        fields: ['name']
      },
      {
        name: 'idx_product_category',
        fields: ['categoryId']
      },
      {
        name: 'idx_product_price',
        fields: ['price']
      },
      {
        name: 'idx_product_sku',
        fields: ['sku'],
        unique: true
      },
      {
        name: 'idx_product_active',
        fields: ['isActive']
      }
    ]
  });

  return Product;
};


