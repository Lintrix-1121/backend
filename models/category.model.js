module.exports = (sequelize, Sequelize) => {
  const Category = sequelize.define('category', {
    categoryId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false
    },
    slug: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    parentId: {
      type: Sequelize.INTEGER, 
      allowNull: true,
      references: {
        model: 'categories',
        key: 'categoryId'
      }
    },
    image: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    displayOrder: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    metaTitle: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    metaDescription: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    odooCategoryId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Category ID from Odoo'
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    indexes: [
      {
        name: 'idx_category_slug',
        fields: ['slug'],
        unique: true
      },
      {
        name: 'idx_category_parent',
        fields: ['parentId']
      }
    ]
  });

  return Category;
};