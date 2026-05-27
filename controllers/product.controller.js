const ProductService = require('../services/product.service');
const CartService = require('../services/cart.service');
const WishlistService = require('../services/wishlist.service');
const ComparisonService = require('../services/comparison.service');
const OrderService = require('../services/order.service');
const OdooService = require('../services/odoo.service');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ProductController {
  constructor(models) {
    console.log('=== ProductController Constructor ===');
    console.log('Models received:', Object.keys(models || {}));
    console.log('Category model exists:', !!models?.Category);
    console.log('Product model exists:', !!models?.Product);
    
    if (!models || !models.Category) {
      console.error('❌ ERROR: Category model is missing!');
      console.error('Models object:', models);
    }

    this.productService = new ProductService(models);
    this.cartService = new CartService(models);
    this.wishlistService = new WishlistService(models);
    this.comparisonService = new ComparisonService(models);
    this.orderService = new OrderService(models);
    this.odooService = new OdooService({
      baseURL: process.env.ODOO_BASE_URL,
      database: process.env.ODOO_DATABASE,
      username: process.env.ODOO_USERNAME,
      password: process.env.ODOO_PASSWORD
    });
    
    this.models = models;

    // Initialize file upload configuration
    this.initializeUploadConfig();

    // Test the service initialization
    console.log('ProductService created:', !!this.productService);
  }

  // ==================== IMAGE UPLOAD CONFIGURATION ====================

  initializeUploadConfig() {
    const uploadDir = 'uploads/products';
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Configure storage
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    // File filter for images
    const fileFilter = (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
      }
    };

    // Create multer instances
    this.upload = multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      }
    });

    // Middleware for multiple file uploads
    this.uploadMultiple = this.upload.array('images', 10);
    
    // Middleware for single file upload
    this.uploadSingle = this.upload.single('image');
  }

  // ==================== PRODUCT IMAGE MANAGEMENT ====================

  /**
   * Upload product images
   * POST /api/products/:productId/images
   */
  async uploadProductImages(req, res) {
    try {
      const { productId } = req.params;
      
      // Handle file upload
      this.uploadMultiple(req, res, async (err) => {
        if (err) {
          console.error('Upload error:', err);
          return res.status(400).json({
            success: false,
            message: err.message || 'File upload failed'
          });
        }

        try {
          // Check if files were uploaded
          if (!req.files || req.files.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'No files uploaded'
            });
          }

          // Get existing product
          const product = await this.productService.getProductById(productId);
          if (!product) {
            // Clean up uploaded files if product doesn't exist
            this.cleanupUploadedFiles(req.files);
            return res.status(404).json({
              success: false,
              message: 'Product not found'
            });
          }

          // Process uploaded files
          const uploadedImages = req.files.map(file => ({
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

          // If no thumbnail exists and we have images, set first as thumbnail
          let updateData = { images: updatedImages };
          if (!product.thumbnail && uploadedImages.length > 0) {
            updateData.thumbnail = uploadedImages[0].url;
            uploadedImages[0].isThumbnail = true;
          }

          // Update product
          const updatedProduct = await this.productService.updateProduct(productId, updateData);

          res.status(200).json({
            success: true,
            message: 'Images uploaded successfully',
            data: {
              product: updatedProduct,
              uploadedCount: uploadedImages.length,
              totalImages: updatedImages.length
            }
          });
        } catch (error) {
          // Clean up uploaded files on error
          this.cleanupUploadedFiles(req.files);
          
          console.error('Error processing upload:', error);
          res.status(500).json({
            success: false,
            message: 'Failed to process uploaded images',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      });
    } catch (error) {
      console.error('Error in uploadProductImages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload images',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Set product thumbnail
   * PUT /api/products/:productId/thumbnail
   */
  async setProductThumbnail(req, res) {
    try {
      const { productId } = req.params;
      const { imageUrl, imageIndex } = req.body;

      const product = await this.productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const images = product.images || [];
      let thumbnailUrl = null;

      if (imageUrl) {
        // Set thumbnail by URL
        thumbnailUrl = imageUrl;
        
        // Mark the image as thumbnail in the images array
        const updatedImages = images.map(img => ({
          ...img,
          isThumbnail: img.url === imageUrl
        }));
        
        // Update product
        await this.productService.updateProduct(productId, {
          thumbnail: thumbnailUrl,
          images: updatedImages
        });
      } else if (imageIndex !== undefined) {
        // Set thumbnail by index
        if (imageIndex < 0 || imageIndex >= images.length) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image index'
          });
        }
        
        thumbnailUrl = images[imageIndex].url;
        
        // Mark the image as thumbnail in the images array
        const updatedImages = images.map((img, index) => ({
          ...img,
          isThumbnail: index === imageIndex
        }));
        
        // Update product
        await this.productService.updateProduct(productId, {
          thumbnail: thumbnailUrl,
          images: updatedImages
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either imageUrl or imageIndex is required'
        });
      }

      const updatedProduct = await this.productService.getProductById(productId);

      res.status(200).json({
        success: true,
        message: 'Thumbnail updated successfully',
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error setting thumbnail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to set thumbnail',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Delete product image
   * DELETE /api/products/:productId/images
   */
  async deleteProductImage(req, res) {
    try {
      const { productId } = req.params;
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Image URL is required'
        });
      }

      const product = await this.productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const images = product.images || [];
      const imageToDelete = images.find(img => img.url === imageUrl);
      
      if (!imageToDelete) {
        return res.status(404).json({
          success: false,
          message: 'Image not found'
        });
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
        fs.unlinkSync(imageToDelete.path);
      }

      // Update product
      const updatedProduct = await this.productService.updateProduct(productId, updateData);

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete image',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get product images
   * GET /api/products/:productId/images
   */
  async getProductImages(req, res) {
    try {
      const { productId } = req.params;
      
      const product = await this.productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Product images retrieved successfully',
        data: {
          images: product.images || [],
          thumbnail: product.thumbnail,
          totalImages: (product.images || []).length
        }
      });
    } catch (error) {
      console.error('Error getting product images:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve product images',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== ENHANCED CREATE PRODUCT (WITH IMAGES) ====================

  /**
   * Create new product with images (Admin only)
   * Enhanced to handle multipart/form-data with images
   */
  async createProduct(req, res) {
    try {
      console.log('📥 Received product creation request');
      console.log('📥 Content-Type:', req.headers['content-type']);
      console.log('📥 Has files:', req.files && req.files.length > 0);
      
      let productData = {};
      
      // Check if this is multipart/form-data
      const contentType = req.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');
      
      if (isMultipart && req.files && req.files.length > 0) {
        console.log('📥 Handling multipart request with files');
        
        // Get product data from form field
        if (req.body.productData) {
          try {
            productData = JSON.parse(req.body.productData);
          } catch (e) {
            console.error('❌ Error parsing productData:', e);
            return res.status(400).json({
              success: false,
              message: 'Invalid product data format'
            });
          }
        }
        
        // Process uploaded files
        const uploadedImages = req.files.map((file, index) => {
          const imageInfo = {
            url: `/uploads/products/${file.filename}`,
            path: file.path,
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            isThumbnail: false
          };
          
          // Check if this is the thumbnail
          const thumbnailIndex = req.body.thumbnailIndex ? parseInt(req.body.thumbnailIndex) : 0;
          if (index === thumbnailIndex) {
            imageInfo.isThumbnail = true;
            productData.thumbnail = imageInfo.url;
          }
          
          return imageInfo;
        });
        
        // Add images to product data
        productData.images = uploadedImages;
        
        // If no thumbnail was set, set first image as thumbnail
        if (!productData.thumbnail && uploadedImages.length > 0) {
          uploadedImages[0].isThumbnail = true;
          productData.thumbnail = uploadedImages[0].url;
        }
        
      } else {
        console.log('📥 Handling JSON request');
        // Regular JSON request
        productData = req.body;
        
        // Parse JSON fields if they're strings
        const jsonFields = ['specifications', 'tags', 'dimensions'];
        jsonFields.forEach(field => {
          if (productData[field] && typeof productData[field] === 'string') {
            try {
              productData[field] = JSON.parse(productData[field]);
            } catch (e) {
              console.warn(`⚠️ Field ${field} is not valid JSON:`, productData[field]);
            }
          }
        });
        
        // Ensure images array exists
        if (!productData.images) {
          productData.images = [];
        }
      }
      
      console.log('📥 Processed product data:', {
        name: productData.name,
        sku: productData.sku,
        price: productData.price,
        quantity: productData.quantity,
        imagesCount: productData.images?.length || 0
      });
      
      // Validate required fields
      const requiredFields = ['name', 'sku', 'price', 'quantity'];
      for (const field of requiredFields) {
        if (!productData[field]) {
          console.error(`❌ Missing required field: ${field}`);
          return res.status(400).json({
            success: false,
            message: `${field} is required`
          });
        }
      }
      
      // Validate SKU uniqueness
      const existingProduct = await this.productService.Product.findOne({
        where: { sku: productData.sku }
      });
      
      if (existingProduct) {
        console.error(`❌ SKU already exists: ${productData.sku}`);
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
      
      // Parse numeric fields
      productData.price = parseFloat(productData.price);
      productData.quantity = parseInt(productData.quantity);
      if (productData.comparePrice) productData.comparePrice = parseFloat(productData.comparePrice);
      if (productData.cost) productData.cost = parseFloat(productData.cost);
      if (productData.salePrice) productData.salePrice = parseFloat(productData.salePrice);
      if (productData.weight) productData.weight = parseFloat(productData.weight);
      
      // Parse boolean fields
      const booleanFields = ['isActive', 'isFeatured', 'isOnSale'];
      booleanFields.forEach(field => {
        if (productData[field] !== undefined) {
          productData[field] = productData[field] === true || productData[field] === 'true';
        }
      });
      
      // Parse date fields
      if (productData.saleStart) productData.saleStart = new Date(productData.saleStart);
      if (productData.saleEnd) productData.saleEnd = new Date(productData.saleEnd);
      
      // Validate price and quantity
      if (productData.price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be greater than 0'
        });
      }
      
      if (productData.quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }
      
      // Create the product
      const product = await this.productService.createProduct(productData);
      
      // Optionally sync to Odoo
      if (process.env.SYNC_TO_ODOO === 'true') {
        try {
          const odooResponse = await this.odooService.syncProductToOdoo(product);
          await product.update({
            odooProductId: odooResponse.id,
            lastSyncedAt: new Date()
          });
        } catch (odooError) {
          console.error('Odoo sync failed but product created:', odooError);
        }
      }
      
      console.log('✅ Product created successfully:', product.productId);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
      
    } catch (error) {
      console.error('❌ Error creating product:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
      
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message).join(', ');
        return res.status(400).json({
          success: false,
          message: `Validation error: ${validationErrors}`
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  // async createProduct(req, res) {
  //   try {
  //     console.log('📥 Received product creation request');
  //   console.log('📥 Headers:', req.headers);
  //   console.log('📥 Body keys:', Object.keys(req.body));
  //   console.log('📥 Files:', req.files);
    
  //   // Log all form fields
  //   Object.keys(req.body).forEach(key => {
  //     console.log(`📥 ${key}:`, req.body[key]);
  //   });
    
  //   // If it's multipart/form-data, parse the fields
  //   const productData = req.body;
    
  //   // Handle JSON strings in form fields
  //   const jsonFields = ['specifications', 'tags', 'dimensions', 'imageMetadata'];
  //   jsonFields.forEach(field => {
  //     if (productData[field] && typeof productData[field] === 'string') {
  //       try {
  //         productData[field] = JSON.parse(productData[field]);
  //       } catch (e) {
  //         console.warn(`⚠️ Field ${field} is not valid JSON:`, productData[field]);
  //       }
  //     }
  //   });
    
  //   console.log('📥 Processed product data:', productData);
    
  //   // Validate required fields
  //   const requiredFields = ['name', 'sku', 'price', 'quantity'];
  //   for (const field of requiredFields) {
  //     if (!productData[field]) {
  //       console.error(`❌ Missing required field: ${field}`);
  //       return res.status(400).json({
  //         success: false,
  //         message: `${field} is required`
  //       });
  //     }
  //   }

  //     // Check if this is a multipart request (has files)
  //     const contentType = req.headers['content-type'] || '';
  //     const isMultipart = contentType.includes('multipart/form-data');
      
  //     if (isMultipart) {
  //       return this.createProductWithImages(req, res);
  //     } else {
  //       return this.createProductJson(req, res);
  //     }
  //   } catch (error) {
  //     console.error('Error in createProduct:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to create product',
  //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
  //     });
  //   }
  // }

  /**
   * Create product with images (multipart/form-data)
   */
  async createProductWithImages(req, res) {
    this.uploadMultiple(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }

      try {
        // Parse product data from form fields
        const productData = this.parseProductFormData(req.body);
        
        // Validate required fields
        const requiredFields = ['name', 'sku', 'price', 'quantity'];
        for (const field of requiredFields) {
          if (!productData[field]) {
            // Clean up uploaded files if validation fails
            this.cleanupUploadedFiles(req.files);
            return res.status(400).json({
              success: false,
              message: `${field} is required`
            });
          }
        }

        // Process uploaded files if any
        let images = [];
        if (req.files && req.files.length > 0) {
          images = req.files.map((file, index) => ({
            url: `/uploads/products/${file.filename}`,
            path: file.path,
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            isThumbnail: index === 0 // First image is thumbnail by default
          }));

          // Set thumbnail to first image
          if (images.length > 0) {
            productData.thumbnail = images[0].url;
          }
        }

        // Add images to product data
        productData.images = images;

        // Create product
        const product = await this.productService.createProduct(productData);

        // Optionally sync to Odoo
        if (process.env.SYNC_TO_ODOO === 'true') {
          try {
            const odooResponse = await this.odooService.syncProductToOdoo(product);
            await product.update({
              odooProductId: odooResponse.id,
              lastSyncedAt: new Date()
            });
          } catch (odooError) {
            console.error('Odoo sync failed but product created:', odooError);
          }
        }

        res.status(201).json({
          success: true,
          message: 'Product created successfully',
          data: product
        });
      } catch (error) {
        // Clean up uploaded files on error
        this.cleanupUploadedFiles(req.files);
        
        console.error('Error creating product:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
          return res.status(400).json({
            success: false,
            message: 'SKU already exists'
          });
        }

        res.status(500).json({
          success: false,
          message: 'Failed to create product',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });
  }

  /**
   * Create product with JSON data (no files - backward compatible)
   */
  async createProductJson(req, res) {
    try {
      const productData = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'sku', 'price', 'quantity'];
      for (const field of requiredFields) {
        if (!productData[field]) {
          return res.status(400).json({
            success: false,
            message: `${field} is required`
          });
        }
      }

      const product = await this.productService.createProduct(productData);

      // Optionally sync to Odoo
      if (process.env.SYNC_TO_ODOO === 'true') {
        try {
          const odooResponse = await this.odooService.syncProductToOdoo(product);
          await product.update({
            odooProductId: odooResponse.id,
            lastSyncedAt: new Date()
          });
        } catch (odooError) {
          console.error('Odoo sync failed but product created:', odooError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      console.error('Error creating product:', error);
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== ENHANCED UPDATE PRODUCT ====================

  /**
   * Update product with optional images
   */
  async updateProduct(req, res) {
    try {
      const { productId } = req.params;
      
      // Check if this is a multipart request
      const contentType = req.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');
      
      if (isMultipart) {
        return this.updateProductWithImages(req, res);
      } else {
        return this.updateProductJson(req, res);
      }
    } catch (error) {
      console.error('Error in updateProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update product with images (multipart/form-data)
   */
  async updateProductWithImages(req, res) {
    const { productId } = req.params;
    
    this.uploadMultiple(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }

      try {
        // Parse update data
        const updateData = this.parseProductFormData(req.body);
        
        // Get existing product
        const existingProduct = await this.productService.getProductById(productId);
        if (!existingProduct) {
          this.cleanupUploadedFiles(req.files);
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }

        // Process uploaded files if any
        if (req.files && req.files.length > 0) {
          const uploadedImages = req.files.map(file => ({
            url: `/uploads/products/${file.filename}`,
            path: file.path,
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            isThumbnail: false
          }));

          // Get existing images
          const existingImages = existingProduct.images || [];
          const updatedImages = [...existingImages, ...uploadedImages];
          
          updateData.images = updatedImages;
          
          // If no thumbnail exists, set first new image as thumbnail
          if (!existingProduct.thumbnail && uploadedImages.length > 0) {
            updateData.thumbnail = uploadedImages[0].url;
            uploadedImages[0].isThumbnail = true;
          }
        }

        // Update product
        const product = await this.productService.updateProduct(productId, updateData);

        res.status(200).json({
          success: true,
          message: 'Product updated successfully',
          data: product
        });
      } catch (error) {
        // Clean up uploaded files on error
        this.cleanupUploadedFiles(req.files);
        
        console.error('Error updating product:', error);
        
        if (error.message === 'Product not found') {
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }

        res.status(500).json({
          success: false,
          message: 'Failed to update product',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });
  }

  /**
   * Update product with JSON data (no files - backward compatible)
   */
  async updateProductJson(req, res) {
    try {
      const { productId } = req.params;
      const updateData = req.body;

      const product = await this.productService.updateProduct(productId, updateData);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      console.error('Error updating product:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== ENHANCED DELETE PRODUCT ====================

  /**
   * Delete product with image cleanup
   */
  async deleteProduct(req, res) {
    try {
      const { productId } = req.params;
      
      // Get product first to check for images
      const product = await this.productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Clean up images if they exist
      if (product.images && Array.isArray(product.images)) {
        for (const image of product.images) {
          if (image.path && fs.existsSync(image.path)) {
            try {
              fs.unlinkSync(image.path);
            } catch (fileError) {
              console.error('Failed to delete image file:', fileError);
              // Continue even if file deletion fails
            }
          }
        }
      }

      // Delete the product from database
      await this.productService.deleteProduct(productId);

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clean up uploaded files
   */
  cleanupUploadedFiles(files) {
    if (files && Array.isArray(files)) {
      files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error('Error cleaning up file:', error);
          }
        }
      });
    }
  }

  /**
   * Parse product form data (handles JSON strings in form fields)
   */
  parseProductFormData(formData) {
    const parsedData = { ...formData };
    
    // Parse numeric fields
    const numericFields = ['price', 'comparePrice', 'cost', 'quantity', 'weight', 'salePrice'];
    numericFields.forEach(field => {
      if (parsedData[field] && parsedData[field] !== '') {
        parsedData[field] = parseFloat(parsedData[field]);
      }
    });
    
    // Parse integer fields
    if (parsedData.quantity) parsedData.quantity = parseInt(parsedData.quantity);
    
    // Parse boolean fields
    const booleanFields = ['isActive', 'isFeatured', 'isOnSale'];
    booleanFields.forEach(field => {
      if (parsedData[field] !== undefined) {
        parsedData[field] = parsedData[field] === 'true' || parsedData[field] === true;
      }
    });
    
    // Parse JSON fields if they're sent as strings
    const jsonFields = ['specifications', 'tags', 'dimensions'];
    jsonFields.forEach(field => {
      if (parsedData[field] && typeof parsedData[field] === 'string') {
        try {
          parsedData[field] = JSON.parse(parsedData[field]);
        } catch (e) {
          console.warn(`Field ${field} is not valid JSON:`, parsedData[field]);
          // Keep as string if not valid JSON
        }
      }
    });
    
    // Parse date fields
    const dateFields = ['saleStart', 'saleEnd'];
    dateFields.forEach(field => {
      if (parsedData[field]) {
        parsedData[field] = new Date(parsedData[field]);
      }
    });
    
    return parsedData;
  }

  // ==================== KEEP ALL YOUR EXISTING METHODS (UNCHANGED) ====================
  
  // All your existing methods remain exactly as they were:
  
  // PRODUCT RELATED CONTROLLERS
  async getProducts(req, res) {
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
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      page = 1,
      limit = 20
    } = req.query;

    const filters = {
      categoryId,
      subCategoryId,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      brand,
      search,
      tags: tags ? tags.split(',') : undefined,
      isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : undefined,
      isOnSale: isOnSale === 'true' ? true : isOnSale === 'false' ? false : undefined,
      inStock: inStock === 'true' ? true : inStock === 'false' ? false : undefined,
      sortBy,
      sortOrder: sortOrder.toUpperCase(),
      page: parseInt(page),
      limit: parseInt(limit)
    };

    console.log('📥 Fetching products with filters:', filters);
    
    const result = await this.productService.getProducts(filters);

    // Log what's being returned
    console.log('📤 Returning products:', {
      total: result.count,
      returned: result.rows.length,
      firstProduct: result.rows.length > 0 ? {
        id: result.rows[0].productId,
        name: result.rows[0].name,
        imagesCount: result.rows[0].images?.length || 0,
        thumbnail: result.rows[0].thumbnail,
        images: result.rows[0].images
      } : null
    });

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products: result.rows,
        pagination: {
          totalItems: result.count,
          totalPages: Math.ceil(result.count / filters.limit),
          currentPage: filters.page,
          pageSize: filters.limit,
          hasNextPage: filters.page * filters.limit < result.count,
          hasPreviousPage: filters.page > 1
        },
        filters
      }
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  
  async getProductById(req, res) {
    try {
      const { productId } = req.params;
      const product = await this.productService.getProductById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Product retrieved successfully',
        data: product
      });
    } catch (error) {
      console.error('Error getting product:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve product',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getProductsByCategory(req, res) {
    try {
      const { categorySlug } = req.params;
      const {
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        page,
        limit
      } = req.query;

      const result = await this.productService.getProductsByCategory(
        categorySlug,
        {
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          sortBy,
          sortOrder,
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20
        }
      );

      res.status(200).json({
        success: true,
        message: 'Products retrieved successfully',
        data: {
          products: result.products,
          category: result.category,
          pagination: result.pagination
        }
      });
    } catch (error) {
      console.error('Error getting products by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getFeaturedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;
      const products = await this.productService.getFeaturedProducts(parseInt(limit));

      res.status(200).json({
        success: true,
        message: 'Featured products retrieved successfully',
        data: products
      });
    } catch (error) {
      console.error('Error getting featured products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve featured products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getSaleProducts(req, res) {
    try {
      const { limit = 10 } = req.query;
      const products = await this.productService.getSaleProducts(parseInt(limit));

      res.status(200).json({
        success: true,
        message: 'Sale products retrieved successfully',
        data: products
      });
    } catch (error) {
      console.error('Error getting sale products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sale products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async searchProducts(req, res) {
    try {
      const { query } = req.query;
      const { page = 1, limit = 20 } = req.query;

      if (!query || query.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const result = await this.productService.searchProducts(query.trim(), {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          products: result.rows,
          pagination: {
            total: result.count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(result.count / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getRelatedProducts(req, res) {
    // ... keep your existing getRelatedProducts method exactly as it was ...
    try {
      const { productId } = req.params;
      const { limit = 5 } = req.query;

      const products = await this.productService.getRelatedProducts(
        parseInt(productId),
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        message: 'Related products retrieved successfully',
        data: products
      });
    } catch (error) {
      console.error('Error getting related products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve related products',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // CART RELATED CONTROLLERS

  async getAuthInfo(req, res) {
    // ... keep your existing getAuthInfo method exactly as it was ...
    try {
      res.status(200).json({
        success: true,
        message: 'Authentication info',
        data: {
          userId: req.userId || null,
          sessionId: req.sessionId || null,
          user: req.user || null,
          authType: req.authType || 'none',
          isAuthenticated: req.isAuthenticated || false,
          headers: {
            'x-user-id': req.headers['x-user-id'] || null,
            'x-session-id': req.headers['x-session-id'] || null,
            'authorization': req.headers.authorization ? 'Present' : 'Missing'
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get auth info',
        error: error.message
      });
    }
  }

  async getCart(req, res) {
    // ... keep your existing getCart method exactly as it was ...
    try {
      console.log('=== Cart Request ===');
      console.log('User:', req.user);
      console.log('Headers:', req.headers);
      
      const userId = req.user?.userId || req.headers['x-user-id'] || null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      console.log('Extracted - userId:', userId, 'sessionId:', sessionId);
      
      if (!userId && !sessionId) {
        console.log('No user or session - returning empty cart');
        return res.status(200).json({
          success: true,
          message: 'Cart retrieved successfully',
          data: {
            items: [],
            totalAmount: 0,
            itemCount: 0,
            shippingAmount: 0,
            taxAmount: 0,
            discountAmount: 0,
            grandTotal: 0,
            currency: 'USD',
            userId: null,
            sessionId: null
          }
        });
      }
      
      const cart = await this.cartService.getUserCart(userId, sessionId);
      
      res.status(200).json({
        success: true,
        message: 'Cart retrieved successfully',
        data: cart
      });
    } catch (error) {
      console.error('Error getting cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cart',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }



  async addToCart(req, res) {
  console.log('=== BACKEND /cart/add CONTROLLER ===');
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Get userId from multiple possible sources
    const userId = req.user?.userId || // From auth middleware (if you have it)
                    req.headers['x-user-id'] || // From headers (frontend sends this)
                    null;
    
    const { productId, quantity = 1, sessionId } = req.body;

    console.log('Extracted parameters:', {
      userId,
      productId,
      quantity,
      sessionId,
      hasUserId: !!userId,
      hasSessionId: !!sessionId
    });

    // Validate required fields
    if (!productId) {
      console.error('❌ Product ID is missing');
      return res.status(400).json({
        success: false,
        message: 'Product ID is required',
        receivedData: req.body
      });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      console.error('❌ Invalid quantity:', quantity);
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number',
        receivedQuantity: quantity
      });
    }

    // Check that we have at least one identifier
    if (!userId && !sessionId) {
      console.error('❌ No userId or sessionId provided');
      return res.status(400).json({
        success: false,
        message: 'Either authenticated user or session ID is required',
        help: 'For authenticated users, include X-User-ID header. For guests, include sessionId in body.'
      });
    }

    console.log('✅ Validation passed, calling cartService.addToCart...');

    // Call the cart service
    const cart = await this.cartService.addToCart(
      userId, 
      productId, 
      parsedQuantity,
      sessionId
    );

    console.log('✅ cartService.addToCart successful:', {
      cartId: cart?.cartId,
      itemsCount: cart?.items?.length
    });

    res.status(200).json({
      success: true,
      message: 'Product added to cart successfully',
      data: cart
    });
    
  } catch (error) {
    console.error('❌ ERROR in addToCart controller:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error full:', error);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (error.message === 'Insufficient stock' || error.message.includes('Only')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Product ID is required' || 
        error.message === 'Quantity must be a positive number') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add product to cart',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
  
  // async addToCart(req, res) {
  //   // ... keep your existing addToCart method exactly as it was ...
  //   try {
  //     const userId = req.user?.userId || req.headers['x-user-id'] || null;
  //     const { productId, quantity = 1, sessionId } = req.body;

  //     if (!productId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Product ID is required'
  //       });
  //     }

  //     if (!userId && !sessionId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Either authenticated user or session ID is required'
  //       });
  //     }

  //     const cart = await this.cartService.addToCart(
  //       userId, 
  //       productId, 
  //       parseInt(quantity),
  //       sessionId
  //     );

  //     res.status(200).json({
  //       success: true,
  //       message: 'Product added to cart successfully',
  //       data: cart
  //     });
  //   } catch (error) {
  //     console.error('Error adding to cart:', error);
      
  //     if (error.message === 'Product not found') {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Product not found'
  //       });
  //     }
      
  //     if (error.message === 'Insufficient stock') {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Insufficient stock available'
  //       });
  //     }

  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to add product to cart',
  //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
  //     });
  //   }
  // }

  async updateCartItem(req, res) {
    // ... keep your existing updateCartItem method exactly as it was ...
    try {
      const userId = req.user?.userId || req.headers['x-user-id'] || null;
      const { productId, quantity, sessionId } = req.body;

      if (!productId || quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and quantity are required'
        });
      }

      if (quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }

      if (!userId && !sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Either authenticated user or session ID is required'
        });
      }

      const cart = await this.cartService.updateCartItem(
        userId,
        productId,
        parseInt(quantity),
        sessionId
      );

      res.status(200).json({
        success: true,
        message: 'Cart item updated successfully',
        data: cart
      });
    } catch (error) {
      console.error('Error updating cart item:', error);
      
      if (error.message === 'Item not found in cart') {
        return res.status(404).json({
          success: false,
          message: 'Item not found in cart'
        });
      }
      
      if (error.message === 'Insufficient stock') {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock available'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update cart item',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async removeFromCart(req, res) {
    // ... keep your existing removeFromCart method exactly as it was ...
    try {
      const userId = req.user?.userId || req.headers['x-user-id'] || null;
      const { productId, sessionId } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      if (!userId && !sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Either authenticated user or session ID is required'
        });
      }

      const cart = await this.cartService.removeFromCart(
        userId, 
        productId, 
        sessionId
      );

      res.status(200).json({
        success: true,
        message: 'Product removed from cart successfully',
        data: cart
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      
      if (error.message === 'Item not found in cart') {
        return res.status(404).json({
          success: false,
          message: 'Item not found in cart'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove product from cart',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async clearCart(req, res) {
    // ... keep your existing clearCart method exactly as it was ...
    try {
      const userId = req.user?.userId || req.headers['x-user-id'] || null;
      const { sessionId } = req.body;

      if (!userId && !sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Either authenticated user or session ID is required'
        });
      }

      await this.cartService.clearCart(userId, sessionId);

      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cart',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getCartSummary(req, res) {
    // ... keep your existing getCartSummary method exactly as it was ...
    try {
      const userId = req.user?.userId || req.headers['x-user-id'] || null;
      const sessionId = req.headers['x-session-id'] || req.query.sessionId;

      if (!userId && !sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Either authenticated user or session ID is required'
        });
      }

      const summary = await this.cartService.getCartSummary(userId, sessionId);

      res.status(200).json({
        success: true,
        message: 'Cart summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      console.error('Error getting cart summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cart summary',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async createGuestCart(req, res) {
    // ... keep your existing createGuestCart method exactly as it was ...
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const cart = await this.cartService.getUserCart(null, sessionId);

      res.status(200).json({
        success: true,
        message: 'Guest cart created successfully',
        data: cart
      });
    } catch (error) {
      console.error('Error creating guest cart:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create guest cart',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async mergeCarts(req, res) {
    // ... keep your existing mergeCarts method exactly as it was ...
    try {
      const userId = req.user?.userId;
      const { sessionId } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const cart = await this.cartService.mergeCarts(userId, sessionId);

      res.status(200).json({
        success: true,
        message: 'Carts merged successfully',
        data: cart
      });
    } catch (error) {
      console.error('Error merging carts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to merge carts',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  // WISHLIST RELATED CONTROLLERS

  async getWishlists(req, res) {
    // ... keep your existing getWishlists method exactly as it was ...
    try {
      const userId = req.user.userId;
      const wishlists = await this.wishlistService.getUserWishlists(userId);

      res.status(200).json({
        success: true,
        message: 'Wishlists retrieved successfully',
        data: wishlists
      });
    } catch (error) {
      console.error('Error getting wishlists:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve wishlists',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async addToWishlist(req, res) {
    // ... keep your existing addToWishlist method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { productId, wishlistName = 'My Wishlist' } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const wishlist = await this.wishlistService.addToWishlist(
        userId,
        productId,
        wishlistName
      );

      res.status(200).json({
        success: true,
        message: 'Product added to wishlist successfully',
        data: wishlist
      });
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      if (error.message === 'Product already in wishlist') {
        return res.status(400).json({
          success: false,
          message: 'Product already exists in wishlist'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add product to wishlist',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async removeFromWishlist(req, res) {
    // ... keep your existing removeFromWishlist method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { productId, wishlistId } = req.body;

      if (!productId || !wishlistId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and Wishlist ID are required'
        });
      }

      const wishlist = await this.wishlistService.removeFromWishlist(
        userId,
        wishlistId,
        productId
      );

      res.status(200).json({
        success: true,
        message: 'Product removed from wishlist successfully',
        data: wishlist
      });
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      
      if (error.message === 'Product not found in wishlist') {
        return res.status(404).json({
          success: false,
          message: 'Product not found in wishlist'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove product from wishlist',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async moveWishlistToCart(req, res) {
    // ... keep your existing moveWishlistToCart method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { wishlistId, productId } = req.body;

      if (!wishlistId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'Wishlist ID and Product ID are required'
        });
      }

      const result = await this.wishlistService.moveToCart(
        userId,
        wishlistId,
        productId
      );

      res.status(200).json({
        success: true,
        message: 'Product moved to cart successfully',
        data: {
          cart: result.cart,
          wishlist: result.wishlist
        }
      });
    } catch (error) {
      console.error('Error moving wishlist to cart:', error);
      
      if (error.message === 'Product not found in wishlist') {
        return res.status(404).json({
          success: false,
          message: 'Product not found in wishlist'
        });
      }
      
      if (error.message === 'Product already in cart') {
        return res.status(400).json({
          success: false,
          message: 'Product already exists in cart'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to move product to cart',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async createWishlist(req, res) {
    // ... keep your existing createWishlist method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { name, isPrivate = true } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Wishlist name is required'
        });
      }

      const wishlist = await this.wishlistService.createWishlist(
        userId,
        name,
        isPrivate
      );

      res.status(201).json({
        success: true,
        message: 'Wishlist created successfully',
        data: wishlist
      });
    } catch (error) {
      console.error('Error creating wishlist:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create wishlist',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // COMPARISON RELATED CONTROLLERS

  async addToComparison(req, res) {
    // ... keep your existing addToComparison method exactly as it was ...
    try {
      const userId = req.user?.userId;
      const sessionId = req.session?.id;
      const { productIds, name = 'Product Comparison' } = req.body;

      if (!productIds || !Array.isArray(productIds)) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required'
        });
      }

      if (productIds.length > 4) {
        return res.status(400).json({
          success: false,
          message: 'Cannot compare more than 4 products'
        });
      }

      const comparison = await this.comparisonService.addToComparison(
        userId,
        sessionId,
        productIds,
        name
      );

      res.status(200).json({
        success: true,
        message: 'Products added to comparison successfully',
        data: comparison
      });
    } catch (error) {
      console.error('Error adding to comparison:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'One or more products not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add products to comparison',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getComparison(req, res) {
    // ... keep your existing getComparison method exactly as it was ...
    try {
      const userId = req.user?.userId;
      const sessionId = req.session?.id;
      const { comparisonId } = req.params;

      let comparison;
      if (comparisonId) {
        comparison = await this.comparisonService.getComparisonById(comparisonId);
      } else {
        comparison = await this.comparisonService.getUserComparison(userId, sessionId);
      }

      if (!comparison) {
        return res.status(404).json({
          success: false,
          message: 'Comparison not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Comparison retrieved successfully',
        data: comparison
      });
    } catch (error) {
      console.error('Error getting comparison:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve comparison',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async removeFromComparison(req, res) {
    // ... keep your existing removeFromComparison method exactly as it was ...
    try {
      const { comparisonId } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const comparison = await this.comparisonService.removeFromComparison(
        comparisonId,
        productId
      );

      res.status(200).json({
        success: true,
        message: 'Product removed from comparison successfully',
        data: comparison
      });
    } catch (error) {
      console.error('Error removing from comparison:', error);
      
      if (error.message === 'Comparison not found') {
        return res.status(404).json({
          success: false,
          message: 'Comparison not found'
        });
      }
      
      if (error.message === 'Product not found in comparison') {
        return res.status(404).json({
          success: false,
          message: 'Product not found in comparison'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to remove product from comparison',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async clearComparison(req, res) {
    // ... keep your existing clearComparison method exactly as it was ...
    try {
      const { comparisonId } = req.params;
      await this.comparisonService.clearComparison(comparisonId);

      res.status(200).json({
        success: true,
        message: 'Comparison cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing comparison:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear comparison',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ORDER & CHECKOUT CONTROLLERS

  async checkout(req, res) {
    // ... keep your existing checkout method exactly as it was ...
    try {
      const userId = req.user.userId;
      const {
        shippingAddress,
        billingAddress,
        customerNotes,
        paymentMethod,
        couponCode
      } = req.body;

      if (!shippingAddress) {
        return res.status(400).json({
          success: false,
          message: 'Shipping address is required'
        });
      }

      if (!paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Payment method is required'
        });
      }

      const order = await this.orderService.processCheckout(
        userId,
        {
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          customerNotes,
          paymentMethod,
          couponCode
        }
      );

      if (order.status === 'processing' || order.status === 'completed') {
        await this.cartService.clearCart(userId);
      }

      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: {
          order,
          paymentRedirect: order.paymentRedirect
        }
      });
    } catch (error) {
      console.error('Error during checkout:', error);
      
      if (error.message === 'Cart is empty') {
        return res.status(400).json({
          success: false,
          message: 'Cannot checkout with empty cart'
        });
      }
      
      if (error.message === 'Insufficient stock') {
        return res.status(400).json({
          success: false,
          message: 'One or more products are out of stock'
        });
      }
      
      if (error.message === 'Invalid coupon') {
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Checkout failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async syncOrderToOdoo(req, res) {
    // ... keep your existing syncOrderToOdoo method exactly as it was ...
    try {
      const { orderId } = req.params;
      
      const order = await this.models.Order.findByPk(orderId, {
        include: [
          {
            model: this.models.User,
            as: 'user',
            attributes: ['userId', 'userName', 'email']
          }
        ]
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const odooOrderData = {
        userId: order.userId,
        user: order.user,
        items: order.items,
        totalAmount: order.totalAmount,
        taxAmount: order.taxAmount,
        shippingAmount: order.shippingAmount,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        customerNotes: order.customerNotes
      };

      const odooResponse = await this.odooService.syncOrderToOdoo(odooOrderData);

      await order.update({
        odooOrderId: odooResponse.id,
        odooSyncStatus: 'synced',
        odooSyncResponse: odooResponse,
        odooSyncedAt: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'Order synced to Odoo successfully',
        data: {
          order,
          odooResponse
        }
      });
    } catch (error) {
      console.error('Error syncing order to Odoo:', error);
      
      if (req.params.orderId) {
        await this.models.Order.update({
          odooSyncStatus: 'failed',
          odooSyncResponse: { error: error.message }
        }, {
          where: { orderId: req.params.orderId }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to sync order to Odoo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getUserOrders(req, res) {
    // ... keep your existing getUserOrders method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { 
        status,
        startDate,
        endDate,
        page = 1,
        limit = 10
      } = req.query;

      const filters = {
        status,
        startDate,
        endDate,
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const orders = await this.orderService.getUserOrders(userId, filters);

      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: {
          orders: orders.rows,
          pagination: {
            total: orders.count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(orders.count / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error getting user orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve orders',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getOrderDetails(req, res) {
    // ... keep your existing getOrderDetails method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { orderId } = req.params;

      const order = await this.orderService.getOrderDetails(orderId, userId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Order details retrieved successfully',
        data: order
      });
    } catch (error) {
      console.error('Error getting order details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve order details',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async cancelOrder(req, res) {
    // ... keep your existing cancelOrder method exactly as it was ...
    try {
      const userId = req.user.userId;
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await this.orderService.cancelOrder(orderId, userId, reason);

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: order
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      
      if (error.message === 'Order not found') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      if (error.message === 'Cannot cancel order') {
        return res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // CATEGORY RELATED CONTROLLERS

  async createCategory(req, res) {
    try {
      const categoryData = req.body;
      
      // Validate required fields
      if (!categoryData.name || !categoryData.slug) {
        return res.status(400).json({
          success: false,
          message: 'Name and slug are required fields'
        });
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(categoryData.slug)) {
        return res.status(400).json({
          success: false,
          message: 'Slug can only contain lowercase letters, numbers, and hyphens'
        });
      }

      const category = await this.productService.createCategory(categoryData);

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
      });
    } catch (error) {
      console.error('Error creating category:', error);
      
      let statusCode = 500;
      let message = 'Failed to create category';
      
      if (error.message.includes('required') || error.message.includes('unique')) {
        statusCode = 400;
        message = error.message;
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const categoryData = req.body;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid category ID is required'
        });
      }

      // Validate slug if provided
      if (categoryData.slug) {
        const slugRegex = /^[a-z0-9-]+$/;
        if (!slugRegex.test(categoryData.slug)) {
          return res.status(400).json({
            success: false,
            message: 'Slug can only contain lowercase letters, numbers, and hyphens'
          });
        }
      }

      const category = await this.productService.updateCategory(parseInt(id), categoryData);

      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: category
      });
    } catch (error) {
      console.error('Error updating category:', error);
      
      let statusCode = 500;
      let message = 'Failed to update category';
      
      if (error.message.includes('not found')) {
        statusCode = 404;
        message = error.message;
      } else if (error.message.includes('unique')) {
        statusCode = 400;
        message = error.message;
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid category ID is required'
        });
      }

      const result = await this.productService.deleteCategory(parseInt(id));

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      
      let statusCode = 500;
      let message = 'Failed to delete category';
      
      if (error.message.includes('not found')) {
        statusCode = 404;
        message = error.message;
      } else if (error.message.includes('Cannot delete')) {
        statusCode = 400;
        message = error.message;
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await this.productService.getCategoriesWithHierarchy();

      res.status(200).json({
        success: true,
        message: 'Categories retrieved successfully',
        data: categories
      });
    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve categories',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getCategoryBySlug(req, res) {
    try {
      const { slug } = req.params;
      const category = await this.productService.getCategoryBySlug(slug);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Category retrieved successfully',
        data: category
      });
    } catch (error) {
      console.error('Error getting category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve category',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ADMIN CONTROLLERS
  async getAllOrders(req, res) {
    try {
      const {
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        status,
        startDate,
        endDate,
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const orders = await this.orderService.getAllOrders(filters);

      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: {
          orders: orders.rows,
          pagination: {
            total: orders.count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(orders.count / parseInt(limit))
          }
        }
      });
    } catch (error) {
      console.error('Error getting all orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve orders',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async updateOrderStatus(req, res) {
    // ... keep your existing updateOrderStatus method exactly as it was ...
    try {
      const { orderId } = req.params;
      const { status, adminNotes } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const order = await this.orderService.updateOrderStatus(
        orderId,
        status,
        adminNotes
      );

      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: order
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      
      if (error.message === 'Order not found') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getDashboardStats(req, res) {
    // ... keep your existing getDashboardStats method exactly as it was ...
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await this.orderService.getDashboardStats({
        startDate,
        endDate
      });

      res.status(200).json({
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ProductController;



