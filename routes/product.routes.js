const express = require('express');
const router = express.Router();
const authMiddleware = require('../controllers/auth.middleware');
const { optionalAuth } = require('../controllers/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ==================== FILE UPLOAD CONFIGURATION ====================

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
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const uploadMultiple = upload.array('images', 10);
const uploadSingle = upload.single('image');

// ==================== MIDDLEWARE FUNCTIONS ====================

// Multer error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed'
    });
  }
  next();
};


// ✅ Export as a function that receives the initialized productController
module.exports = (productController) => {
  console.log('=== Setting up product routes with single controller ===');
  
  if (!productController) {
    console.error('❌ ERROR: productController is required but not provided');
    throw new Error('productController is required');
  }
  
  console.log('✅ ProductController received:', productController.constructor.name);

  // PUBLIC PRODUCT ROUTES
   
  // Product browsing and searching
  router.get('/products', (req, res) => productController.getProducts(req, res));
  router.get('/products/search', (req, res) => productController.searchProducts(req, res));
  router.get('/products/featured', (req, res) => productController.getFeaturedProducts(req, res));
  router.get('/products/sale', (req, res) => productController.getSaleProducts(req, res));
  router.get('/products/:productId', (req, res) => productController.getProductById(req, res));
  router.get('/products/:productId/related', (req, res) => productController.getRelatedProducts(req, res));
  
  // Product images (public access)
  router.get('/products/:productId/images', (req, res) => productController.getProductImages(req, res));
  
  // Category browsing
  router.post('/categories', (req, res) => productController.createCategory(req, res));
  router.put('/categories/:id', (req, res) => productController.updateCategory(req, res));
  router.delete('/categories/:id', (req, res) => productController.deleteCategory(req, res));
  router.get('/categories', (req, res) => productController.getCategories(req, res));
  router.get('/categories/:slug', (req, res) => productController.getCategoryBySlug(req, res));
  router.get('/category/:categorySlug/products', (req, res) => productController.getProductsByCategory(req, res));

  //CART ROUTES (Optional Auth)
  
  router.get('/cart', optionalAuth, (req, res) => productController.getCart(req, res));
  router.post('/cart/guest', (req, res) => productController.createGuestCart(req, res));
  router.post('/cart/add', optionalAuth, (req, res) => productController.addToCart(req, res));
  router.put('/cart/update', optionalAuth, (req, res) => productController.updateCartItem(req, res));
  router.delete('/cart/remove', optionalAuth, (req, res) => productController.removeFromCart(req, res));
  router.delete('/cart/clear', optionalAuth, (req, res) => productController.clearCart(req, res));
  router.get('/cart/summary', optionalAuth, (req, res) => productController.getCartSummary(req, res));
  router.post('/cart/merge', optionalAuth, (req, res) => productController.mergeCarts(req, res));

  // Auth info endpoint (useful for debugging)
  router.get('/auth/info', optionalAuth, (req, res) => productController.getAuthInfo(req, res));

  // AUTHENTICATED ROUTES 
  
  // Apply authentication middleware for all routes below
  router.use(authMiddleware.authenticate);

  // WISHLIST ROUTES
  
  router.get('/wishlists', (req, res) => productController.getWishlists(req, res));
  router.post('/wishlists/add', (req, res) => productController.addToWishlist(req, res));
  router.delete('/wishlists/remove', (req, res) => productController.removeFromWishlist(req, res));
  router.post('/wishlists/move-to-cart', (req, res) => productController.moveWishlistToCart(req, res));
  router.post('/wishlists/create', (req, res) => productController.createWishlist(req, res));

  //COMPARISON ROUTES 
  
  router.post('/comparison/add', (req, res) => productController.addToComparison(req, res));
  router.get('/comparison', (req, res) => productController.getComparison(req, res));
  router.get('/comparison/:comparisonId', (req, res) => productController.getComparison(req, res));
  router.delete('/comparison/:comparisonId/remove', (req, res) => productController.removeFromComparison(req, res));
  router.delete('/comparison/:comparisonId/clear', (req, res) => productController.clearComparison(req, res));

  //ORDER & CHECKOUT ROUTES 
  
  router.post('/checkout', (req, res) => productController.checkout(req, res));
  router.get('/orders', (req, res) => productController.getUserOrders(req, res));
  router.get('/orders/:orderId', (req, res) => productController.getOrderDetails(req, res));
  router.post('/orders/:orderId/cancel', (req, res) => productController.cancelOrder(req, res));
  router.post('/orders/:orderId/sync-odoo', (req, res) => productController.syncOrderToOdoo(req, res));

  //ADMIN ROUTES 
  // Apply admin middleware for all admin routes
  router.use(authMiddleware.isAdmin);

  // Product Management with Image Upload Support
  router.post('/admin/products', 
    uploadMultiple,
    handleUploadError,
    (req, res) => productController.createProduct(req, res)
  );
  
  router.put('/admin/products/:productId', 
    uploadMultiple,
    handleUploadError,
    (req, res) => productController.updateProduct(req, res)
  );
  
  router.delete('/admin/products/:productId', (req, res) => 
    productController.deleteProduct(req, res)
  );

  // Product Image Management (Admin only)
  router.post('/admin/products/:productId/images', 
    uploadMultiple,
    handleUploadError,
    (req, res) => productController.uploadProductImages(req, res)
  );
  
  router.put('/admin/products/:productId/thumbnail', (req, res) => 
    productController.setProductThumbnail(req, res)
  );
  
  router.delete('/admin/products/:productId/images', (req, res) => 
    productController.deleteProductImage(req, res)
  );

  // Alternative single image upload endpoint
  router.post('/admin/products/:productId/image', 
    uploadSingle,
    handleUploadError,
    (req, res) => productController.uploadProductImages(req, res) // Same handler works
  );

  // Order Management
  router.get('/admin/orders', (req, res) => productController.getAllOrders(req, res));
  router.put('/admin/orders/:orderId/status', (req, res) => productController.updateOrderStatus(req, res));

  // Dashboard
  router.get('/admin/dashboard/stats', (req, res) => productController.getDashboardStats(req, res));

  console.log('✅ Product routes configured with single controller');
  console.log('✅ Image upload routes added with multer middleware');
  console.log('✅ Upload directory:', uploadDir);
  return router;
};






// const express = require('express');
// const router = express.Router();
// const authMiddleware = require('../controllers/auth.middleware');
//   // routes/index.js or wherever your cart routes are defined

// const CartController = require('../controllers/product.controller');
// const CartService = require('../services/cart.service');
// const { optionalAuth } = require('../controllers/auth.middleware');


// const cartService = new CartService();
// const cartController = new CartController(cartService);


// // ✅ Export as a function that receives the initialized productController
// module.exports = (productController) => {
//   console.log('=== Setting up product routes with single controller ===');
  
//   if (!productController) {
//     console.error('❌ ERROR: productController is required but not provided');
//     throw new Error('productController is required');
//   }
  
//   console.log('✅ ProductController received:', productController.constructor.name);

//   // Public routes
//   router.get('/products', (req, res) => productController.getProducts(req, res));
//   router.get('/products/search', (req, res) => productController.searchProducts(req, res));
//   router.get('/products/featured', (req, res) => productController.getFeaturedProducts(req, res));
//   router.get('/products/sale', (req, res) => productController.getSaleProducts(req, res));
//   router.get('/products/:productId', (req, res) => productController.getProductById(req, res));
//   router.get('/products/:productId/related', (req, res) => productController.getRelatedProducts(req, res));
//   router.get('/categories', (req, res) => productController.getCategories(req, res));
//   router.get('/categories/:slug', (req, res) => productController.getCategoryBySlug(req, res));
//   router.get('/categories/:categorySlug/products', (req, res) => productController.getProductsByCategory(req, res));

//   // Protected routes (require authentication)
//   router.use(authMiddleware.authenticate);





//   // AFTER (CORRECT - using optionalAuth):
// router.get('/cart', optionalAuth, (req, res) => productController.getCart(req, res));
// router.post('/cart/guest', (req, res) => productController.createGuestCart(req, res));
// router.post('/cart/add', optionalAuth, (req, res) => productController.addToCart(req, res));
// router.put('/cart/update', optionalAuth, (req, res) => productController.updateCartItem(req, res));
// router.delete('/cart/remove', optionalAuth, (req, res) => productController.removeFromCart(req, res));
// router.delete('/cart/clear', optionalAuth, (req, res) => productController.clearCart(req, res));
// router.get('/cart/summary', optionalAuth, (req, res) => productController.getCartSummary(req, res));

// // Add the new merge route if you added the method
// router.post('/cart/merge', optionalAuth, (req, res) => productController.mergeCarts(req, res));

//   // Cart routes - all handled by productController
//   router.get('/cart', (req, res) => productController.getCart(req, res));
//   router.post('/cart/add', (req, res) => productController.addToCart(req, res));
//   router.put('/cart/update', (req, res) => productController.updateCartItem(req, res));
//   router.delete('/cart/remove', (req, res) => productController.removeFromCart(req, res));
//   router.delete('/cart/clear', (req, res) => productController.clearCart(req, res));
//   router.get('/cart/summary', (req, res) => productController.getCartSummary(req, res));

//   // Wishlist routes
//   router.get('/wishlists', (req, res) => productController.getWishlists(req, res));
//   router.post('/wishlists/add', (req, res) => productController.addToWishlist(req, res));
//   router.delete('/wishlists/remove', (req, res) => productController.removeFromWishlist(req, res));
//   router.post('/wishlists/move-to-cart', (req, res) => productController.moveWishlistToCart(req, res));
//   router.post('/wishlists/create', (req, res) => productController.createWishlist(req, res));

//   // Comparison routes
//   router.post('/comparison/add', (req, res) => productController.addToComparison(req, res));
//   router.get('/comparison', (req, res) => productController.getComparison(req, res));
//   router.get('/comparison/:comparisonId', (req, res) => productController.getComparison(req, res));
//   router.delete('/comparison/:comparisonId/remove', (req, res) => productController.removeFromComparison(req, res));
//   router.delete('/comparison/:comparisonId/clear', (req, res) => productController.clearComparison(req, res));

//   // Order & Checkout routes
//   router.post('/checkout', (req, res) => productController.checkout(req, res));
//   router.get('/orders', (req, res) => productController.getUserOrders(req, res));
//   router.get('/orders/:orderId', (req, res) => productController.getOrderDetails(req, res));
//   router.post('/orders/:orderId/cancel', (req, res) => productController.cancelOrder(req, res));
//   router.post('/orders/:orderId/sync-odoo', (req, res) => productController.syncOrderToOdoo(req, res));

//   // Admin routes
//   router.use(authMiddleware.isAdmin);
//   router.post('/admin/products', (req, res) => productController.createProduct(req, res));
//   router.put('/admin/products/:productId', (req, res) => productController.updateProduct(req, res));
//   router.delete('/admin/products/:productId', (req, res) => productController.deleteProduct(req, res));
//   router.get('/admin/orders', (req, res) => productController.getAllOrders(req, res));
//   router.put('/admin/orders/:orderId/status', (req, res) => productController.updateOrderStatus(req, res));
//   router.get('/admin/dashboard/stats', (req, res) => productController.getDashboardStats(req, res));

//   console.log('✅ Product routes configured with single controller');
//   return router;
// };





// const express = require('express');
// const router = express.Router();
// const { Product, Cart, Wishlist, Order, Comparison, Category } = require('../models/associations');
// const ProductController = require('../controllers/product.controller');
// const authMiddleware = require('../controllers/auth.middleware');

// // Initialize controller
// const productController = new ProductController({ Product, Cart, Wishlist, Order, Comparison, Category });

// // Public routes
// router.get('/products', productController.getProducts.bind(productController));
// router.get('/products/search', productController.searchProducts.bind(productController));
// router.get('/products/featured', productController.getFeaturedProducts.bind(productController));
// router.get('/products/sale', productController.getSaleProducts.bind(productController));
// router.get('/products/:productId', productController.getProductById.bind(productController));
// router.get('/products/:productId/related', productController.getRelatedProducts.bind(productController));
// router.get('/categories', productController.getCategories.bind(productController));
// router.get('/categories/:slug', productController.getCategoryBySlug.bind(productController));
// router.get('/categories/:categorySlug/products', productController.getProductsByCategory.bind(productController));

// // Protected routes (require authentication)
// router.use(authMiddleware.authenticate);

// // Cart routes
// router.get('/cart', productController.getCart.bind(productController));
// router.post('/cart/add', productController.addToCart.bind(productController));
// router.put('/cart/update', productController.updateCartItem.bind(productController));
// router.delete('/cart/remove', productController.removeFromCart.bind(productController));
// router.delete('/cart/clear', productController.clearCart.bind(productController));
// router.get('/cart/summary', productController.getCartSummary.bind(productController));

// // Wishlist routes
// router.get('/wishlists', productController.getWishlists.bind(productController));
// router.post('/wishlists/add', productController.addToWishlist.bind(productController));
// router.delete('/wishlists/remove', productController.removeFromWishlist.bind(productController));
// router.post('/wishlists/move-to-cart', productController.moveWishlistToCart.bind(productController));
// router.post('/wishlists/create', productController.createWishlist.bind(productController));

// // Comparison routes
// router.post('/comparison/add', productController.addToComparison.bind(productController));
// router.get('/comparison', productController.getComparison.bind(productController));
// router.get('/comparison/:comparisonId', productController.getComparison.bind(productController));
// router.delete('/comparison/:comparisonId/remove', productController.removeFromComparison.bind(productController));
// router.delete('/comparison/:comparisonId/clear', productController.clearComparison.bind(productController));

// // Order & Checkout routes
// router.post('/checkout', productController.checkout.bind(productController));
// router.get('/orders', productController.getUserOrders.bind(productController));
// router.get('/orders/:orderId', productController.getOrderDetails.bind(productController));
// router.post('/orders/:orderId/cancel', productController.cancelOrder.bind(productController));
// router.post('/orders/:orderId/sync-odoo', productController.syncOrderToOdoo.bind(productController));

// // Admin routes
// router.use(authMiddleware.isAdmin);
// router.post('/admin/products', productController.createProduct.bind(productController));
// router.put('/admin/products/:productId', productController.updateProduct.bind(productController));
// router.delete('/admin/products/:productId', productController.deleteProduct.bind(productController));
// router.get('/admin/orders', productController.getAllOrders.bind(productController));
// router.put('/admin/orders/:orderId/status', productController.updateOrderStatus.bind(productController));
// router.get('/admin/dashboard/stats', productController.getDashboardStats.bind(productController));

// module.exports = router;




