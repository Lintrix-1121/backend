const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

class ProductService {
  constructor(models) {
    console.log('=== ProductService Constructor ===');
    console.log('Models keys:', Object.keys(models || {}));
    
    // Debug: Show what's actually in models
    if (models) {
      for (const key in models) {
        console.log(`  ${key}: ${models[key]?.constructor?.name || typeof models[key]}`);
      }
    }
    
    // Make sure models are properly passed
    this.Product = models.Product || models.product;
    this.Category = models.Category || models.category;
    this.User = models.User || models.user;
    this.Sequelize = models.Sequelize || { Op };
    
    console.log('Service models initialized:', {
      Product: !!this.Product,
      Category: !!this.Category,
      User: !!this.User,
      Sequelize: !!this.Sequelize
    });
    
    // Test if Category has findAll method
    if (this.Category && typeof this.Category.findAll === 'function') {
      console.log('✅ Category.findAll is available');
    } else {
      console.error('❌ Category.findAll is NOT a function');
      console.error('Category value:', this.Category);
    }
  }

  //ENHANCED PRODUCT CRUD WITH IMAGES
  async createProduct(productData) {
    try {
      console.log('Creating product with data:', JSON.stringify(productData, null, 2));

      // Validate required fields
      const requiredFields = ['name', 'sku', 'price', 'quantity'];
      for (const field of requiredFields) {
        if (!productData[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // Check if SKU already exists
      const existingProduct = await this.Product.findOne({
        where: { sku: productData.sku }
      });

      if (existingProduct) {
        throw new Error('SKU already exists');
      }

      // Validate price and quantity
      if (productData.price <= 0) {
        throw new Error('Price must be greater than 0');
      }

      if (productData.quantity < 0) {
        throw new Error('Quantity cannot be negative');
      }

      // Validate compare price if provided
      if (productData.comparePrice && productData.comparePrice <= productData.price) {
        throw new Error('Compare price must be greater than regular price');
      }

      // Validate sale price if provided
      if (productData.salePrice && productData.salePrice >= productData.price) {
        throw new Error('Sale price must be less than regular price');
      }

      // Validate images array if provided
      if (productData.images && !Array.isArray(productData.images)) {
        throw new Error('Images must be an array');
      }

      // Process images if provided
      let images = productData.images || [];
      if (images.length > 0) {
        // Validate each image object
        images = images.map((img, index) => {
          if (!img.url) {
            throw new Error(`Image at index ${index} must have a URL`);
          }
          return {
            url: img.url,
            path: img.path || null,
            filename: img.filename || path.basename(img.url),
            originalname: img.originalname || path.basename(img.url),
            mimetype: img.mimetype || 'image/jpeg',
            size: img.size || 0,
            isThumbnail: img.isThumbnail || (index === 0) // First image is thumbnail by default
          };
        });

        // Set thumbnail to first image if not explicitly set
        if (!productData.thumbnail && images.length > 0) {
          productData.thumbnail = images[0].url;
        }
      }

      // Prepare product data for creation
      const productToCreate = {
        name: productData.name.trim(),
        sku: productData.sku.trim(),
        price: parseFloat(productData.price),
        quantity: parseInt(productData.quantity),
        description: productData.description || null,
        categoryId: productData.categoryId || null,
        subCategoryId: productData.subCategoryId || null,
        brand: productData.brand || null,
        images: images,
        thumbnail: productData.thumbnail || null,
        specifications: productData.specifications || {},
        tags: productData.tags || [],
        isActive: productData.isActive !== undefined ? Boolean(productData.isActive) : true,
        isFeatured: Boolean(productData.isFeatured) || false,
        isOnSale: Boolean(productData.isOnSale) || false,
        comparePrice: productData.comparePrice ? parseFloat(productData.comparePrice) : null,
        cost: productData.cost ? parseFloat(productData.cost) : null,
        salePrice: productData.salePrice ? parseFloat(productData.salePrice) : null,
        saleStart: productData.saleStart || null,
        saleEnd: productData.saleEnd || null,
        weight: productData.weight ? parseFloat(productData.weight) : null,
        dimensions: productData.dimensions || {},
        metaTitle: productData.metaTitle || null,
        metaDescription: productData.metaDescription || null,
        odooProductId: productData.odooProductId || null,
        odooTemplateId: productData.odooTemplateId || null,
        odooVariantId: productData.odooVariantId || null
      };

      // Create the product
      const product = await this.Product.create(productToCreate);
      
      console.log('Product created successfully:', product.productId);
      return product;

    } catch (error) {
      console.error('Error in createProduct service:', error);
      
      // Handle Sequelize specific errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        if (error.fields && error.fields.includes('sku')) {
          throw new Error('SKU already exists');
        }
        throw new Error('Duplicate entry error');
      }
      
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message).join(', ');
        throw new Error(`Validation error: ${validationErrors}`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  async updateProduct(productId, productData) {
    try {
      console.log('Updating product:', productId);

      // Find the product
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Validate SKU uniqueness if SKU is being updated
      if (productData.sku && productData.sku !== product.sku) {
        const existingProduct = await this.Product.findOne({
          where: { sku: productData.sku }
        });
        if (existingProduct && existingProduct.productId !== productId) {
          throw new Error('SKU already exists');
        }
      }

      // Process images if provided in update
      if (productData.images !== undefined) {
        if (!Array.isArray(productData.images)) {
          throw new Error('Images must be an array');
        }

        // If images array is being replaced completely
        const newImages = productData.images.map((img, index) => {
          if (!img.url) {
            throw new Error(`Image at index ${index} must have a URL`);
          }
          return {
            url: img.url,
            path: img.path || null,
            filename: img.filename || path.basename(img.url),
            originalname: img.originalname || path.basename(img.url),
            mimetype: img.mimetype || 'image/jpeg',
            size: img.size || 0,
            isThumbnail: img.isThumbnail || false
          };
        });

        // If thumbnail is not set in update but we have images, check if we need to set it
        if (!productData.thumbnail && newImages.length > 0) {
          const currentThumbnail = product.thumbnail;
          const currentImages = product.images || [];
          
          // Find if thumbnail still exists in new images
          const thumbnailExists = newImages.some(img => img.url === currentThumbnail);
          
          // If thumbnail doesn't exist in new images, set first image as thumbnail
          if (!thumbnailExists) {
            productData.thumbnail = newImages[0].url;
            newImages[0].isThumbnail = true;
          }
        }

        productData.images = newImages;
      }

      // Update the product
      const updatedProduct = await product.update(productData);
      
      console.log('Product updated successfully:', productId);
      return updatedProduct;

    } catch (error) {
      console.error('Error in updateProduct service:', error);
      throw error;
    }
  }

  async deleteProduct(productId, deleteImages = true) {
    try {
      console.log('Deleting product:', productId);

      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Optionally delete physical image files
      if (deleteImages && product.images && Array.isArray(product.images)) {
        for (const image of product.images) {
          if (image.path && fs.existsSync(image.path)) {
            try {
              fs.unlinkSync(image.path);
              console.log('Deleted image file:', image.path);
            } catch (fileError) {
              console.error('Failed to delete image file:', image.path, fileError);
              // Continue even if file deletion fails
            }
          }
        }
      }

      // Soft delete (set isActive to false)
      await product.update({ isActive: false });
      
      console.log('Product soft deleted successfully:', productId);
      return { success: true };

    } catch (error) {
      console.error('Error in deleteProduct service:', error);
      throw error;
    }
  }

  // ==================== IMAGE MANAGEMENT METHODS ====================

  async addProductImages(productId, imageFiles) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Process uploaded files
      const uploadedImages = imageFiles.map(file => ({
        url: `/uploads/products/${file.filename}`,
        path: file.path,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        isThumbnail: false
      }));

      // Get existing images or initialize empty array
      const existingImages = product.images || [];
      const updatedImages = [...existingImages, ...uploadedImages];

      // If no thumbnail exists, set first new image as thumbnail
      let updateData = { images: updatedImages };
      if (!product.thumbnail && uploadedImages.length > 0) {
        updateData.thumbnail = uploadedImages[0].url;
        uploadedImages[0].isThumbnail = true;
      }

      // Update product
      const updatedProduct = await product.update(updateData);
      return {
        product: updatedProduct,
        uploadedCount: uploadedImages.length,
        totalImages: updatedImages.length
      };

    } catch (error) {
      console.error('Error in addProductImages:', error);
      
      // Clean up uploaded files on error
      if (imageFiles && Array.isArray(imageFiles)) {
        imageFiles.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (fileError) {
              console.error('Failed to cleanup file:', fileError);
            }
          }
        });
      }
      
      throw error;
    }
  }

  async setProductThumbnail(productId, imageUrl) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const images = product.images || [];
      const imageIndex = images.findIndex(img => img.url === imageUrl);
      
      if (imageIndex === -1) {
        throw new Error('Image not found in product images');
      }

      // Update all images to set isThumbnail correctly
      const updatedImages = images.map((img, index) => ({
        ...img,
        isThumbnail: index === imageIndex
      }));

      // Update product
      const updatedProduct = await product.update({
        thumbnail: imageUrl,
        images: updatedImages
      });

      return updatedProduct;

    } catch (error) {
      console.error('Error in setProductThumbnail:', error);
      throw error;
    }
  }

  async deleteProductImage(productId, imageUrl) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const images = product.images || [];
      const imageToDelete = images.find(img => img.url === imageUrl);
      
      if (!imageToDelete) {
        throw new Error('Image not found');
      }

      // Remove from array
      const updatedImages = images.filter(img => img.url !== imageUrl);
      
      // Check if we're deleting the thumbnail
      let updateData = { images: updatedImages };
      if (product.thumbnail === imageUrl) {
        // Set new thumbnail (first available image or null)
        const newThumbnail = updatedImages.length > 0 ? updatedImages[0].url : null;
        updateData.thumbnail = newThumbnail;
        
        // Update thumbnail flag in images array
        if (updatedImages.length > 0) {
          updatedImages[0].isThumbnail = true;
        }
      }

      // Delete physical file
      if (imageToDelete.path && fs.existsSync(imageToDelete.path)) {
        try {
          fs.unlinkSync(imageToDelete.path);
          console.log('Deleted physical image file:', imageToDelete.path);
        } catch (fileError) {
          console.error('Failed to delete physical file:', fileError);
          // Continue even if file deletion fails
        }
      }

      // Update product
      const updatedProduct = await product.update(updateData);
      return updatedProduct;

    } catch (error) {
      console.error('Error in deleteProductImage:', error);
      throw error;
    }
  }

  async reorderProductImages(productId, imageUrls) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const images = product.images || [];
      
      // Validate all URLs exist in current images
      for (const url of imageUrls) {
        if (!images.some(img => img.url === url)) {
          throw new Error(`Image with URL ${url} not found in product`);
        }
      }

      // Reorder images based on provided URLs
      const reorderedImages = [];
      for (const url of imageUrls) {
        const image = images.find(img => img.url === url);
        if (image) {
          reorderedImages.push(image);
        }
      }

      // Add any images not in the reorder list
      const remainingImages = images.filter(img => !imageUrls.includes(img.url));
      const finalImages = [...reorderedImages, ...remainingImages];

      // Update product
      const updatedProduct = await product.update({
        images: finalImages
      });

      return updatedProduct;

    } catch (error) {
      console.error('Error in reorderProductImages:', error);
      throw error;
    }
  }

  // // ==================== ENHANCED QUERY METHODS ====================
  async getProducts(filters = {}) {
    try {
      const {
        categoryId,
        subCategoryId,
        minPrice,
        maxPrice,
        brand,
        search,
        tags,
        isFeatured,
        isOnSale,
        inStock,
        hasImages,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 20
      } = filters;

      const where = {
        isActive: true
      };

      const offset = (page - 1) * limit;

      // Apply filters
      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (subCategoryId) {
        where.subCategoryId = subCategoryId;
      }

      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
        if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
      }

      if (brand) {
        where.brand = brand;
      }

      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { tags: { [Op.like]: `%${search}%` } }
        ];
      }

      if (tags && Array.isArray(tags)) {
        where.tags = {
          [Op.overlap]: tags
        };
      }

      if (isFeatured !== undefined) {
        where.isFeatured = isFeatured;
      }

      if (isOnSale !== undefined) {
        where.isOnSale = isOnSale;
        if (isOnSale) {
          const now = new Date();
          where[Op.and] = [
            { saleStart: { [Op.or]: [{ [Op.lte]: now }, { [Op.is]: null }] } },
            { saleEnd: { [Op.or]: [{ [Op.gte]: now }, { [Op.is]: null }] } }
          ];
        }
      }

      if (inStock !== undefined) {
        if (inStock) {
          where.quantity = { [Op.gt]: 0 };
        } else {
          where.quantity = { [Op.lte]: 0 };
        }
      }

      if (hasImages !== undefined) {
        if (hasImages) {
          where[Op.and] = [
            { images: { [Op.ne]: null } },
            { images: { [Op.ne]: '[]' } }
          ];
        }
      }

      // Handle sorting
      let order = [];
      switch (sortBy) {
        case 'price':
          order = [['price', sortOrder]];
          break;
        case 'name':
          order = [['name', sortOrder]];
          break;
        case 'createdAt':
          order = [['createdAt', sortOrder]];
          break;
        case 'popularity':
          order = [['createdAt', 'DESC']];
          break;
        case 'featured':
          order = [['isFeatured', 'DESC'], ['createdAt', 'DESC']];
          break;
        default:
          order = [[sortBy, sortOrder]];
      }

      const { count, rows } = await this.Product.findAndCountAll({
        where,
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          },
          {
            model: this.Category,
            as: 'subCategory',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order,
        limit,
        offset,
        raw: false // Make sure we get Sequelize instances, not raw objects
      });

      // ==================== PARSE JSON FIELDS ====================
      const processedRows = rows.map(product => {
        // Convert to plain object
        const productData = product.toJSON ? product.toJSON() : product;
        
        console.log(`🔍 Processing product ${productData.productId}:`, {
          rawImages: productData.images,
          imagesType: typeof productData.images,
          thumbnail: productData.thumbnail
        });

        // Parse images if they exist
        if (productData.images) {
          try {
            if (typeof productData.images === 'string') {
              productData.images = JSON.parse(productData.images);
            }
            // Ensure it's an array
            if (!Array.isArray(productData.images)) {
              console.warn(`⚠️ Images is not an array for product ${productData.productId}:`, productData.images);
              productData.images = [];
            }
          } catch (error) {
            console.error(`❌ Error parsing images for product ${productData.productId}:`, error);
            productData.images = [];
          }
        } else {
          productData.images = [];
        }

        // Parse other JSON fields
        const jsonFields = ['specifications', 'dimensions'];
        jsonFields.forEach(field => {
          if (productData[field] && typeof productData[field] === 'string') {
            try {
              productData[field] = JSON.parse(productData[field]);
            } catch (error) {
              console.error(`❌ Error parsing ${field} for product ${productData.productId}:`, error);
              productData[field] = {};
            }
          } else if (!productData[field]) {
            productData[field] = {};
          }
        });

        // Parse tags
        if (productData.tags) {
          try {
            if (typeof productData.tags === 'string') {
              productData.tags = JSON.parse(productData.tags);
            }
            // Ensure it's an array
            if (!Array.isArray(productData.tags)) {
              productData.tags = [];
            }
          } catch (error) {
            console.error(`❌ Error parsing tags for product ${productData.productId}:`, error);
            productData.tags = [];
          }
        } else {
          productData.tags = [];
        }

        // Ensure thumbnail is properly set
        if (!productData.thumbnail && productData.images.length > 0) {
          const firstImage = productData.images[0];
          productData.thumbnail = typeof firstImage === 'object' ? firstImage.url : firstImage;
        }

        // Convert dates to ISO strings
        const dateFields = ['createdAt', 'updatedAt', 'saleStart', 'saleEnd', 'lastSyncedAt'];
        dateFields.forEach(field => {
          if (productData[field] && productData[field] instanceof Date) {
            productData[field] = productData[field].toISOString();
          }
        });

        return productData;
      });

      // Debug logging
      console.log('📊 Products processed:', {
        total: processedRows.length,
        withImages: processedRows.filter(p => p.images && p.images.length > 0).length,
        sampleProduct: processedRows.length > 0 ? {
          id: processedRows[0].productId,
          name: processedRows[0].name,
          imagesCount: processedRows[0].images?.length || 0,
          thumbnail: processedRows[0].thumbnail,
          firstImage: processedRows[0].images?.[0]
        } : null
      });

      return { count, rows: processedRows };

    } catch (error) {
      console.error('Error in getProducts:', error);
      throw error;
    }
  }
  
  async getProductById(productId, includeCategory = true) {
    try {
      const options = {
        where: { 
          productId,
          isActive: true 
        }
      };

      if (includeCategory) {
        options.include = [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          },
          {
            model: this.Category,
            as: 'subCategory',
            attributes: ['categoryId', 'name', 'slug']
          }
        ];
      }

      const product = await this.Product.findOne(options);
      
      if (!product) {
        throw new Error('Product not found');
      }

      // Convert to plain object and parse JSON fields
      const productData = product.toJSON ? product.toJSON() : product;
      
      // Parse all JSON fields
      const jsonFields = ['images', 'specifications', 'dimensions', 'tags'];
      jsonFields.forEach(field => {
        if (productData[field] && typeof productData[field] === 'string') {
          try {
            productData[field] = JSON.parse(productData[field]);
          } catch (error) {
            console.error(`❌ Error parsing ${field} for product ${productId}:`, error);
            if (field === 'images') {
              productData[field] = [];
            } else if (field === 'tags') {
              productData[field] = [];
            } else {
              productData[field] = {};
            }
          }
        } else if (!productData[field]) {
          if (field === 'images' || field === 'tags') {
            productData[field] = [];
          } else {
            productData[field] = {};
          }
        }
      });

      // Ensure thumbnail
      if (!productData.thumbnail && productData.images && productData.images.length > 0) {
        const firstImage = productData.images[0];
        productData.thumbnail = typeof firstImage === 'object' ? firstImage.url : firstImage;
      }

      return productData;
    } catch (error) {
      console.error('Error in getProductById:', error);
      throw error;
    }
  }
  

  // UTILITY METHODS 
/**
 * Parse JSON fields in product data
 */
  parseProductJsonFields(productData) {
    if (!productData) return productData;
    
    const parsedData = { ...productData };
    
    const jsonFields = ['images', 'specifications', 'dimensions', 'tags'];
    
    jsonFields.forEach(field => {
      if (parsedData[field]) {
        try {
          if (typeof parsedData[field] === 'string') {
            parsedData[field] = JSON.parse(parsedData[field]);
          }
          
          // Set defaults if needed
          if ((field === 'images' || field === 'tags') && !Array.isArray(parsedData[field])) {
            parsedData[field] = [];
          } else if (field !== 'images' && field !== 'tags' && typeof parsedData[field] !== 'object') {
            parsedData[field] = {};
          }
        } catch (error) {
          console.error(`Error parsing ${field}:`, error);
          if (field === 'images' || field === 'tags') {
            parsedData[field] = [];
          } else {
            parsedData[field] = {};
          }
        }
      } else {
        // Set defaults for missing fields
        if (field === 'images' || field === 'tags') {
          parsedData[field] = [];
        } else {
          parsedData[field] = {};
        }
      }
    });
    
    // Ensure thumbnail
    if (!parsedData.thumbnail && parsedData.images.length > 0) {
      const firstImage = parsedData.images[0];
      parsedData.thumbnail = typeof firstImage === 'object' ? firstImage.url : firstImage;
    }
    
    return parsedData;
  }






  async getProductImages(productId) {
    try {
      const product = await this.Product.findByPk(productId, {
        attributes: ['productId', 'images', 'thumbnail']
      });
      
      if (!product) {
        throw new Error('Product not found');
      }

      return {
        images: product.images || [],
        thumbnail: product.thumbnail,
        totalImages: (product.images || []).length
      };
    } catch (error) {
      console.error('Error in getProductImages:', error);
      throw error;
    }
  }

  async getProductsByCategory(categorySlug, options = {}) {
    try {
      const {
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 20
      } = options;

      // Find category by slug
      const category = await this.Category.findOne({
        where: { slug: categorySlug, isActive: true }
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Build where clause
      const where = {
        isActive: true,
        [Op.or]: [
          { categoryId: category.categoryId },
          { subCategoryId: category.categoryId }
        ]
      };

      // Price filter
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
        if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
      }

      // Sorting
      let order = [];
      switch (sortBy) {
        case 'price':
          order = [['price', sortOrder]];
          break;
        case 'name':
          order = [['name', sortOrder]];
          break;
        case 'createdAt':
          order = [['createdAt', sortOrder]];
          break;
        default:
          order = [[sortBy, sortOrder]];
      }

      const offset = (page - 1) * limit;

      const { count, rows: products } = await this.Product.findAndCountAll({
        where,
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          },
          {
            model: this.Category,
            as: 'subCategory',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order,
        limit,
        offset
      });

      return {
        category,
        products,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit),
          hasNext: page * limit < count,
          hasPrevious: page > 1
        }
      };

    } catch (error) {
      console.error('Error in getProductsByCategory:', error);
      throw error;
    }
  }

  //EXISTING METHODS (UPDATED)


  async createCategory(categoryData) {
    try {
      // Validate required fields
      if (!categoryData.name || !categoryData.slug) {
        throw new Error('Name and slug are required');
      }

      // Check if slug already exists
      const existingCategory = await this.Category.findOne({
        where: { slug: categoryData.slug }
      });

      if (existingCategory) {
        throw new Error('Category slug must be unique');
      }

      // Create the category
      const category = await this.Category.create({
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description || null,
        parentId: categoryData.parentId || null,
        image: categoryData.image || null,
        isActive: categoryData.isActive !== undefined ? categoryData.isActive : true,
        displayOrder: categoryData.displayOrder || 0,
        metaTitle: categoryData.metaTitle || null,
        metaDescription: categoryData.metaDescription || null
      });

      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(id, categoryData) {
    try {
      const category = await this.Category.findByPk(id);
      
      if (!category) {
        throw new Error('Category not found');
      }

      // Check if new slug conflicts with other categories
      if (categoryData.slug && categoryData.slug !== category.slug) {
        const existingSlug = await this.Category.findOne({
          where: { 
            slug: categoryData.slug,
            categoryId: { [Op.ne]: id } // Not the current category
          }
        });

        if (existingSlug) {
          throw new Error('Category slug must be unique');
        }
      }

      // Update category
      await category.update({
        name: categoryData.name || category.name,
        slug: categoryData.slug || category.slug,
        description: categoryData.description !== undefined ? categoryData.description : category.description,
        parentId: categoryData.parentId !== undefined ? categoryData.parentId : category.parentId,
        image: categoryData.image !== undefined ? categoryData.image : category.image,
        isActive: categoryData.isActive !== undefined ? categoryData.isActive : category.isActive,
        displayOrder: categoryData.displayOrder !== undefined ? categoryData.displayOrder : category.displayOrder,
        metaTitle: categoryData.metaTitle !== undefined ? categoryData.metaTitle : category.metaTitle,
        metaDescription: categoryData.metaDescription !== undefined ? categoryData.metaDescription : category.metaDescription
      });

      return category;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id) {
    try {
      const category = await this.Category.findByPk(id);
      
      if (!category) {
        throw new Error('Category not found');
      }

      // Check if category has products
      const productCount = await this.Product.count({
        where: { categoryId: id }
      });

      if (productCount > 0) {
        // Option 1: Throw error
        throw new Error(`Cannot delete category with ${productCount} product(s). Move products first.`);
        
        // Option 2: Move products to uncategorized (implement if needed)
        // await this.Product.update(
        //   { categoryId: null },
        //   { where: { categoryId: id } }
        // );
      }

      // Check if category has sub-categories
      const childCount = await this.Category.count({
        where: { parentId: id }
      });

      if (childCount > 0) {
        // Option 1: Throw error
        throw new Error(`Cannot delete category with ${childCount} sub-category(ies). Delete or move sub-categories first.`);
        
        // Option 2: Cascade delete sub-categories (implement if needed)
        // await this.Category.destroy({ where: { parentId: id } });
      }

      // Delete the category
      await category.destroy();

      return { success: true, message: 'Category deleted successfully' };
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async getCategoriesWithHierarchy() {
    try {
      // Check if Category model exists
      if (!this.Category) {
        throw new Error('Category model is not initialized');
      }
      
      const categories = await this.Category.findAll({
        where: { isActive: true },
        order: [['parentId', 'ASC'], ['displayOrder', 'ASC']]
      });

      return categories;
    } catch (error) {
      console.error('Error in getCategoriesWithHierarchy:', error);
      console.error('this.Category value:', this.Category);
      throw error;
    }
  }

  async getCategoryBySlug(slug) {
    try {
      const category = await this.Category.findOne({
        where: { slug, isActive: true }
      });
      return category;
    } catch (error) {
      console.error('Error in getCategoryBySlug:', error);
      throw error;
    }
  }

  async getFeaturedProducts(limit = 10) {
    try {
      return await this.Product.findAll({
        where: {
          isFeatured: true,
          isActive: true,
          quantity: { [Op.gt]: 0 }
        },
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      });
    } catch (error) {
      console.error('Error in getFeaturedProducts:', error);
      throw error;
    }
  }

  async getSaleProducts(limit = 10) {
    try {
      const now = new Date();
      return await this.Product.findAll({
        where: {
          isOnSale: true,
          isActive: true,
          quantity: { [Op.gt]: 0 },
          [Op.and]: [
            { saleStart: { [Op.or]: [{ [Op.lte]: now }, { [Op.is]: null }] } },
            { saleEnd: { [Op.or]: [{ [Op.gte]: now }, { [Op.is]: null }] } }
          ]
        },
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('Error in getSaleProducts:', error);
      throw error;
    }
  }

  async searchProducts(query, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const { count, rows } = await this.Product.findAndCountAll({
        where: {
          isActive: true,
          [Op.or]: [
            { name: { [Op.like]: `%${query}%` } },
            { description: { [Op.like]: `%${query}%` } },
            { sku: { [Op.like]: `%${query}%` } },
            { brand: { [Op.like]: `%${query}%` } },
            { tags: { [Op.like]: `%${query}%` } }
          ]
        },
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return { count, rows };
    } catch (error) {
      console.error('Error in searchProducts:', error);
      throw error;
    }
  }

  async getRelatedProducts(productId, limit = 5) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const relatedProducts = await this.Product.findAll({
        where: {
          productId: { [Op.ne]: productId },
          isActive: true,
          quantity: { [Op.gt]: 0 },
          [Op.or]: [
            { categoryId: product.categoryId },
            { subCategoryId: product.subCategoryId },
            { brand: product.brand }
          ]
        },
        include: [
          {
            model: this.Category,
            as: 'category',
            attributes: ['categoryId', 'name', 'slug']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      });

      return relatedProducts;
    } catch (error) {
      console.error('Error in getRelatedProducts:', error);
      throw error;
    }
  }

  async getProductsForComparison(productIds) {
    try {
      return await this.Product.findAll({
        where: {
          productId: productIds,
          isActive: true
        },
        attributes: [
          'productId',
          'name',
          'price',
          'comparePrice',
          'salePrice',
          'description',
          'images',
          'thumbnail',
          'specifications',
          'brand',
          'sku',
          'quantity',
          'dimensions',
          'weight'
        ]
      });
    } catch (error) {
      console.error('Error in getProductsForComparison:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  async validateProductImages(images) {
    if (!images || !Array.isArray(images)) {
      return [];
    }

    const validImages = [];
    for (const img of images) {
      if (img && img.url) {
        validImages.push({
          url: img.url,
          path: img.path || null,
          filename: img.filename || path.basename(img.url),
          originalname: img.originalname || path.basename(img.url),
          mimetype: img.mimetype || 'image/jpeg',
          size: img.size || 0,
          isThumbnail: Boolean(img.isThumbnail)
        });
      }
    }
    return validImages;
  }

  async cleanupProductImages(productId) {
    try {
      const product = await this.Product.findByPk(productId);
      if (!product) {
        return;
      }

      const images = product.images || [];
      for (const image of images) {
        if (image.path && fs.existsSync(image.path)) {
          try {
            fs.unlinkSync(image.path);
            console.log('Cleaned up image file:', image.path);
          } catch (fileError) {
            console.error('Failed to cleanup image file:', fileError);
          }
        }
      }
    } catch (error) {
      console.error('Error in cleanupProductImages:', error);
    }
  }
}

module.exports = ProductService;

