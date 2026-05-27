const { Op } = require('sequelize');

class WishlistService {
  constructor(models) {
    this.Wishlist = models.Wishlist;
    this.Product = models.Product;
    this.User = models.User;
    this.Cart = models.Cart;
  }

  /**
   * Get user's wishlists
   */
  async getUserWishlists(userId) {
    try {
      const wishlists = await this.Wishlist.findAll({
        where: { userId },
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName']
          }
        ],
        order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
      });

      // Enrich wishlist items with product details
      for (const wishlist of wishlists) {
        if (wishlist.items && wishlist.items.length > 0) {
          const productIds = wishlist.items.map(item => 
            typeof item === 'number' ? item : item.productId
          );
          
          const products = await this.Product.findAll({
            where: {
              productId: productIds,
              isActive: true
            },
            attributes: [
              'productId',
              'name',
              'price',
              'comparePrice',
              'thumbnail',
              'isOnSale',
              'salePrice',
              'quantity'
            ]
          });

          wishlist.items = products;
        }
      }

      return wishlists;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get default wishlist for user
   */
  async getDefaultWishlist(userId) {
    try {
      let wishlist = await this.Wishlist.findOne({
        where: {
          userId,
          isDefault: true
        }
      });

      if (!wishlist) {
        wishlist = await this.Wishlist.create({
          userId,
          name: 'My Wishlist',
          items: [],
          isDefault: true,
          isPrivate: true
        });
      }

      // Enrich items with product details
      if (wishlist.items && wishlist.items.length > 0) {
        const productIds = wishlist.items.map(item => 
          typeof item === 'number' ? item : item.productId
        );
        
        const products = await this.Product.findAll({
          where: {
            productId: productIds,
            isActive: true
          },
          attributes: [
            'productId',
            'name',
            'price',
            'comparePrice',
            'thumbnail',
            'isOnSale',
            'salePrice',
            'quantity',
            'categoryId'
          ]
        });

        wishlist.items = products;
      }

      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add product to wishlist
   */
  async addToWishlist(userId, productId, wishlistName = 'My Wishlist') {
    try {
      // Validate product exists and is active
      const product = await this.Product.findOne({
        where: {
          productId,
          isActive: true
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Get or create wishlist
      let wishlist = await this.Wishlist.findOne({
        where: {
          userId,
          name: wishlistName
        }
      });

      if (!wishlist) {
        // Check if it should be default
        const defaultWishlist = await this.Wishlist.findOne({
          where: {
            userId,
            isDefault: true
          }
        });

        wishlist = await this.Wishlist.create({
          userId,
          name: wishlistName,
          items: [],
          isDefault: !defaultWishlist,
          isPrivate: true
        });
      }

      // Check if product already in wishlist
      const currentItems = wishlist.items || [];
      const existingItemIndex = currentItems.findIndex(item => 
        (typeof item === 'number' && item === productId) ||
        (typeof item === 'object' && item.productId === productId)
      );

      if (existingItemIndex >= 0) {
        throw new Error('Product already in wishlist');
      }

      // Add product to wishlist
      currentItems.push({
        productId: product.productId,
        addedAt: new Date().toISOString()
      });

      await wishlist.update({
        items: currentItems
      });

      return this.getWishlistById(wishlist.wishlistId, userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove product from wishlist
   */
  async removeFromWishlist(userId, wishlistId, productId) {
    try {
      const wishlist = await this.Wishlist.findOne({
        where: {
          wishlistId,
          userId
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      const currentItems = wishlist.items || [];
      const filteredItems = currentItems.filter(item => 
        (typeof item === 'number' && item !== productId) ||
        (typeof item === 'object' && item.productId !== productId)
      );

      if (filteredItems.length === currentItems.length) {
        throw new Error('Product not found in wishlist');
      }

      await wishlist.update({
        items: filteredItems
      });

      return this.getWishlistById(wishlistId, userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Move item from wishlist to cart
   */
  async moveToCart(userId, wishlistId, productId) {
    try {
      // Get wishlist
      const wishlist = await this.Wishlist.findOne({
        where: {
          wishlistId,
          userId
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      // Check if product exists in wishlist
      const currentItems = wishlist.items || [];
      const productInWishlist = currentItems.find(item => 
        (typeof item === 'number' && item === productId) ||
        (typeof item === 'object' && item.productId === productId)
      );

      if (!productInWishlist) {
        throw new Error('Product not found in wishlist');
      }

      // Get product details
      const product = await this.Product.findOne({
        where: {
          productId,
          isActive: true
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      // Add to cart using CartService
      const cartService = new CartService({ Cart: this.Cart, Product: this.Product });
      const cart = await cartService.addToCart(userId, productId, 1);

      // Remove from wishlist
      await this.removeFromWishlist(userId, wishlistId, productId);

      return {
        cart,
        wishlist: await this.getWishlistById(wishlistId, userId)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new wishlist
   */
  async createWishlist(userId, name, isPrivate = true) {
    try {
      // Check if wishlist with same name exists
      const existingWishlist = await this.Wishlist.findOne({
        where: {
          userId,
          name
        }
      });

      if (existingWishlist) {
        throw new Error('Wishlist with this name already exists');
      }

      // Create new wishlist
      const wishlist = await this.Wishlist.create({
        userId,
        name,
        items: [],
        isDefault: false,
        isPrivate
      });

      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete wishlist
   */
  async deleteWishlist(userId, wishlistId) {
    try {
      const wishlist = await this.Wishlist.findOne({
        where: {
          wishlistId,
          userId
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      if (wishlist.isDefault) {
        throw new Error('Cannot delete default wishlist');
      }

      await wishlist.destroy();
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update wishlist
   */
  async updateWishlist(userId, wishlistId, updates) {
    try {
      const wishlist = await this.Wishlist.findOne({
        where: {
          wishlistId,
          userId
        }
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      // Prevent updating isDefault if another default exists
      if (updates.isDefault === true) {
        await this.Wishlist.update(
          { isDefault: false },
          {
            where: {
              userId,
              isDefault: true,
              wishlistId: { [Op.ne]: wishlistId }
            }
          }
        );
      }

      await wishlist.update(updates);
      return this.getWishlistById(wishlistId, userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if product is in any wishlist
   */
  async isProductInWishlist(userId, productId) {
    try {
      const wishlists = await this.Wishlist.findAll({
        where: { userId }
      });

      for (const wishlist of wishlists) {
        const items = wishlist.items || [];
        const found = items.some(item => 
          (typeof item === 'number' && item === productId) ||
          (typeof item === 'object' && item.productId === productId)
        );

        if (found) {
          return {
            inWishlist: true,
            wishlistId: wishlist.wishlistId,
            wishlistName: wishlist.name
          };
        }
      }

      return { inWishlist: false };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get wishlist by ID
   */
  async getWishlistById(wishlistId, userId = null) {
    try {
      const where = { wishlistId };
      if (userId) {
        where.userId = userId;
      }

      const wishlist = await this.Wishlist.findOne({
        where,
        include: [
          {
            model: this.User,
            as: 'user',
            attributes: ['userId', 'userName']
          }
        ]
      });

      if (!wishlist) {
        throw new Error('Wishlist not found');
      }

      // Enrich items with product details
      if (wishlist.items && wishlist.items.length > 0) {
        const productIds = wishlist.items.map(item => 
          typeof item === 'number' ? item : item.productId
        );
        
        const products = await this.Product.findAll({
          where: {
            productId: productIds,
            isActive: true
          },
          attributes: [
            'productId',
            'name',
            'price',
            'comparePrice',
            'thumbnail',
            'isOnSale',
            'salePrice',
            'quantity',
            'categoryId'
          ]
        });

        wishlist.items = products.map(product => ({
          ...product.toJSON(),
          addedAt: wishlist.items.find(item => 
            (typeof item === 'number' && item === product.productId) ||
            (typeof item === 'object' && item.productId === product.productId)
          )?.addedAt || new Date().toISOString()
        }));
      }

      return wishlist;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get wishlist count for user
   */
  async getWishlistCount(userId) {
    try {
      const count = await this.Wishlist.count({
        where: { userId }
      });

      // Get total items across all wishlists
      const wishlists = await this.Wishlist.findAll({
        where: { userId },
        attributes: ['items']
      });

      let totalItems = 0;
      for (const wishlist of wishlists) {
        if (wishlist.items) {
          totalItems += wishlist.items.length;
        }
      }

      return {
        wishlistCount: count,
        totalItems
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = WishlistService;