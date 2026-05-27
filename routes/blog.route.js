const express = require('express');
const router = express.Router();

module.exports = (blogController) => {
  // Validate controller
  if (!blogController) {
    throw new Error('BlogController is required for blog routes');
  }
  
  console.log('✅ Setting up blog routes with controller:', {
    hasUploadMiddleware: !!blogController.upload,
    controllerMethods: Object.keys(blogController).filter(key => typeof blogController[key] === 'function')
  });

  // Debug middleware to see what's coming in
  router.use((req, res, next) => {
    if (req.method === 'POST' && req.url === '/') {
      console.log('=== INCOMING BLOG REQUEST ===');
      console.log('Headers:', req.headers['content-type']);
      console.log('Body size:', req.headers['content-length']);
      console.log('Method:', req.method);
      console.log('URL:', req.url);
    }
    next();
  });

  // Create blog - use the upload middleware from controller
  router.post('/', blogController.upload, (req, res) => {
    console.log('📝 Blog creation route called');
    console.log('📦 After upload middleware:');
    console.log('  Body keys:', Object.keys(req.body));
    console.log('  File:', req.file);
    
    // Log all body fields for debugging
    for (let key in req.body) {
      console.log(`  ${key}: "${req.body[key]}"`);
    }
    
    // Now call the controller method
    blogController.createBlog(req, res);
  });
  
  // Get all blogs
  router.get('/', (req, res) => {
    console.log('📋 GET /blogs route called');
    blogController.getAllBlogs(req, res);
  });
  
  // Get blog by ID or slug
  router.get('/:idOrSlug', (req, res) => {
    blogController.getBlog(req, res);
  });
  
  // Update blog - use upload middleware
  router.put('/:id', blogController.upload, (req, res) => {
    blogController.updateBlog(req, res);
  });
  
  // Delete blog
  router.delete('/:id', (req, res) => {
    blogController.deleteBlog(req, res);
  });


  router.post('/:identifier/views', (req, res) => {
  blogController.incrementViews(req, res);
  });

  // Also update like and share routes:
  router.post('/:identifier/like', (req, res) => {
    blogController.likeBlog(req, res);
  });

  router.post('/:identifier/share', (req, res) => {
    blogController.shareBlog(req, res);
  });
  
  // // Increment views
  // router.post('/:id/views', (req, res) => {
  //   blogController.incrementViews(req, res);
  // });
  
  // // Like blog
  // router.post('/:id/like', (req, res) => {
  //   blogController.likeBlog(req, res);
  // });
  
  // // Share blog
  // router.post('/:id/share', (req, res) => {
  //   blogController.shareBlog(req, res);
  // });
  
  // Get blogs by author
  router.get('/author/:authorId', (req, res) => {
    blogController.getBlogsByAuthor(req, res);
  });
  
  // Get featured blogs
  router.get('/featured/all', (req, res) => {
    blogController.getFeaturedBlogs(req, res);
  });
  
  // Search blogs
  router.get('/search/all', (req, res) => {
    blogController.searchBlogs(req, res);
  });
  
  // Get blog statistics
  router.get('/stats/all', (req, res) => {
    blogController.getBlogStats(req, res);
  });
  
  // Health check
  router.get('/health/check', (req, res) => {
    blogController.healthCheck(req, res);
  });
  
  // TEST ENDPOINT - No file upload
  router.post('/test-no-file', (req, res) => {
    console.log('🧪 Test endpoint (no file) called');
    console.log('Body:', req.body);
    res.json({
      success: true,
      message: 'Test successful',
      body: req.body
    });
  });
  
  // TEST ENDPOINT - With file using multer
  const multer = require('multer');
  const testUpload = multer().single('featuredImage');
  router.post('/test-with-file', testUpload, (req, res) => {
    console.log('🧪 Test endpoint (with file) called');
    console.log('Body:', req.body);
    console.log('File:', req.file);
    res.json({
      success: true,
      message: 'Test with file successful',
      body: req.body,
      file: req.file ? {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      } : null
    });
  });
  
  console.log('✅ Blog routes set up successfully');
  return router;
};
