const { Op } = require('sequelize');

class ComparisonService {
  constructor(models) {
    this.Comparison = models.Comparison;
    this.Product = models.Product;
    this.Category = models.Category;
    this.User = models.User;
  }

  /**
   * Add products to comparison
   */
  async addToComparison(userId, sessionId, productIds, name = 'Product Comparison') {
    try {
      // Validate product IDs
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error('Product IDs array is required');
      }

      if (productIds.length > 4) {
        throw new Error('Cannot compare more than 4 products');
      }

      // Verify all products exist and are active
      const products = await this.Product.findAll({
        where: {
          productId: productIds,
          isActive: true
        },
        attributes: ['productId', 'categoryId']
      });

      if (products.length !== productIds.length) {
        throw new Error('One or more products not found');
      }

      // Check if all products are in same category
      const categories = [...new Set(products.map(p => p.categoryId))];
      const categoryId = categories.length === 1 ? categories[0] : null;

      // Find existing comparison for user/session
      let comparison = await this.Comparison.findOne({
        where: {
          [Op.or]: [
            { userId: userId || null },
            { sessionId: sessionId || null }
          ]
        },
        order: [['viewedAt', 'DESC']]
      });

      if (comparison) {
        // Update existing comparison
        const existingProductIds = [...new Set([...comparison.productIds, ...productIds])];
        
        if (existingProductIds.length > 4) {
          throw new Error('Cannot compare more than 4 products');
        }

        await comparison.update({
          productIds: existingProductIds,
          categoryId: categoryId || comparison.categoryId,
          viewedAt: new Date()
        });
      } else {
        // Create new comparison
        comparison = await this.Comparison.create({
          userId: userId || null,
          sessionId: sessionId || null,
          name,
          productIds,
          categoryId,
          viewedAt: new Date(),
          expiresAt: userId ? null : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours for guests
        });
      }

      return this.getComparisonWithProducts(comparison.comparisonId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's comparison
   */
  async getUserComparison(userId, sessionId = null) {
    try {
      const where = {
        [Op.or]: []
      };

      if (userId) {
        where[Op.or].push({ userId });
      }

      if (sessionId) {
        where[Op.or].push({ sessionId });
      }

      if (where[Op.or].length === 0) {
        return null;
      }

      const comparison = await this.Comparison.findOne({
        where,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName'],
            required: false
          },
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug'],
            required: false
          }
        ],
        order: [['viewedAt', 'DESC']]
      });

      if (!comparison) {
        return null;
      }

      return this.getComparisonWithProducts(comparison.comparisonId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get comparison by ID
   */
  async getComparisonById(comparisonId) {
    try {
      const comparison = await this.Comparison.findByPk(comparisonId, {
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName'],
            required: false
          },
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug'],
            required: false
          }
        ]
      });

      if (!comparison) {
        throw new Error('Comparison not found');
      }

      return this.getComparisonWithProducts(comparison.comparisonId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get comparison with enriched product details
   */
  async getComparisonWithProducts(comparisonId) {
    try {
      const comparison = await this.Comparison.findByPk(comparisonId, {
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName'],
            required: false
          },
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug'],
            required: false
          }
        ]
      });

      if (!comparison) {
        throw new Error('Comparison not found');
      }

      // Get product details
      const products = await this.Product.findAll({
        where: {
          productId: comparison.productIds,
          isActive: true
        },
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          },
          {
            model: this.Category,
            as: 'subCategory',
            attributes: ['categoryId', 'name', 'slug'],
            required: false
          }
        ],
        attributes: [
          'productId',
          'name',
          'description',
          'price',
          'comparePrice',
          'images',
          'thumbnail',
          'specifications',
          'brand',
          'sku',
          'quantity',
          'weight',
          'dimensions',
          'isOnSale',
          'salePrice',
          'saleStart',
          'saleEnd'
        ]
      });

      // Format specifications for comparison
      const formattedProducts = products.map(product => {
        const specs = product.specifications || {};
        const formattedSpecs = {};

        // Flatten specifications for easy comparison
        Object.keys(specs).forEach(key => {
          if (typeof specs[key] === 'object') {
            Object.keys(specs[key]).forEach(subKey => {
              formattedSpecs[`${key}.${subKey}`] = specs[key][subKey];
            });
          } else {
            formattedSpecs[key] = specs[key];
          }
        });

        return {
          ...product.toJSON(),
          specifications: formattedSpecs
        };
      });

      // Get all specification keys for comparison table
      const allSpecKeys = new Set();
      formattedProducts.forEach(product => {
        Object.keys(product.specifications || {}).forEach(key => {
          allSpecKeys.add(key);
        });
      });

      // Generate comparison table data
      const comparisonTable = {
        headers: ['Feature', ...formattedProducts.map(p => p.name)],
        rows: Array.from(allSpecKeys).map(specKey => {
          const row = [specKey];
          formattedProducts.forEach(product => {
            row.push(product.specifications[specKey] || '-');
          });
          return row;
        })
      };

      // Add basic info rows
      const basicInfo = [
        ['Price', ...formattedProducts.map(p => `$${p.price}`)],
        ['Brand', ...formattedProducts.map(p => p.brand || '-')],
        ['SKU', ...formattedProducts.map(p => p.sku)],
        ['Availability', ...formattedProducts.map(p => p.quantity > 0 ? 'In Stock' : 'Out of Stock')],
        ['Category', ...formattedProducts.map(p => p.category?.name || '-')]
      ];

      comparisonTable.rows = [...basicInfo, ...comparisonTable.rows];

      return {
        ...comparison.toJSON(),
        products: formattedProducts,
        comparisonTable,
        metadata: {
          totalProducts: formattedProducts.length,
          categoryName: comparison.category?.name,
          lastViewed: comparison.viewedAt
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove product from comparison
   */
  async removeFromComparison(comparisonId, productId) {
    try {
      const comparison = await this.Comparison.findByPk(comparisonId);
      
      if (!comparison) {
        throw new Error('Comparison not found');
      }

      const filteredProductIds = comparison.productIds.filter(id => id !== productId);
      
      if (filteredProductIds.length === comparison.productIds.length) {
        throw new Error('Product not found in comparison');
      }

      // Update category if needed
      let categoryId = comparison.categoryId;
      if (filteredProductIds.length > 0) {
        const remainingProducts = await this.Product.findAll({
          where: {
            productId: filteredProductIds
          },
          attributes: ['categoryId']
        });
        
        const categories = [...new Set(remainingProducts.map(p => p.categoryId))];
        categoryId = categories.length === 1 ? categories[0] : null;
      } else {
        categoryId = null;
      }

      await comparison.update({
        productIds: filteredProductIds,
        categoryId,
        viewedAt: new Date()
      });

      return this.getComparisonWithProducts(comparisonId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear comparison
   */
  async clearComparison(comparisonId) {
    try {
      const comparison = await this.Comparison.findByPk(comparisonId);
      
      if (!comparison) {
        throw new Error('Comparison not found');
      }

      await comparison.update({
        productIds: [],
        categoryId: null,
        viewedAt: new Date()
      });

      return comparison;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update comparison name
   */
  async updateComparisonName(comparisonId, name) {
    try {
      const comparison = await this.Comparison.findByPk(comparisonId);
      
      if (!comparison) {
        throw new Error('Comparison not found');
      }

      await comparison.update({
        name,
        viewedAt: new Date()
      });

      return this.getComparisonWithProducts(comparisonId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save comparison (for logged-in users)
   */
  async saveComparison(sessionId, userId) {
    try {
      const guestComparison = await this.Comparison.findOne({
        where: {
          sessionId,
          userId: null
        }
      });

      if (!guestComparison) {
        throw new Error('No comparison found for session');
      }

      // Check if user already has a comparison
      const userComparison = await this.Comparison.findOne({
        where: { userId }
      });

      if (userComparison) {
        // Merge product IDs
        const mergedProductIds = [...new Set([
          ...userComparison.productIds,
          ...guestComparison.productIds
        ])];

        if (mergedProductIds.length > 4) {
          throw new Error('Cannot have more than 4 products in comparison after merge');
        }

        await userComparison.update({
          productIds: mergedProductIds,
          viewedAt: new Date()
        });

        // Delete guest comparison
        await guestComparison.destroy();

        return this.getComparisonWithProducts(userComparison.comparisonId);
      } else {
        // Transfer guest comparison to user
        await guestComparison.update({
          userId,
          sessionId: null,
          expiresAt: null
        });

        return this.getComparisonWithProducts(guestComparison.comparisonId);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get popular comparisons
   */
  async getPopularComparisons(limit = 5) {
    try {
      const comparisons = await this.Comparison.findAll({
        where: {
          productIds: {
            [Op.not]: []
          },
          userId: { [Op.not]: null }
        },
        attributes: [
          'comparisonId',
          'name',
          'productIds',
          'categoryId',
          'viewedAt',
          [this.Comparison.sequelize.fn('COUNT', this.Comparison.sequelize.col('comparisonId')), 'viewCount']
        ],
        group: ['comparisonId'],
        order: [[this.Comparison.sequelize.literal('viewCount'), 'DESC']],
        limit
      });

      // Get product names for each comparison
      for (const comparison of comparisons) {
        if (comparison.productIds && comparison.productIds.length > 0) {
          const products = await this.Product.findAll({
            where: {
              productId: comparison.productIds.slice(0, 2) // Show first 2 products
            },
            attributes: ['name', 'thumbnail']
          });
          comparison.dataValues.productNames = products.map(p => p.name);
          comparison.dataValues.productThumbnails = products.map(p => p.thumbnail);
        }
      }

      return comparisons;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean up expired comparisons (for guest users)
   */
  async cleanupExpiredComparisons() {
    try {
      const deleted = await this.Comparison.destroy({
        where: {
          userId: null,
          expiresAt: {
            [Op.lt]: new Date()
          }
        }
      });

      return deleted;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ComparisonService;