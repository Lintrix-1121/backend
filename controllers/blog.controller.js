const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User } = require('../models/user.model');

class BlogController {
  constructor(blogService) {
    console.log('🔧 BlogController constructor called');
    if (!blogService) {
      console.error('❌ BlogService is undefined in BlogController constructor');
      throw new Error('BlogService is required for BlogController');
    }

    if (!blogService.User && this.User) {
    // Pass the User model to blogService if it doesn't have it
      blogService.User = this.User;
    }

    console.log('📦 BlogService type:', typeof blogService);
    console.log('✅ BlogController initialized');

    this.blogService = blogService;

    // Create upload middleware - store it as a property
    this.upload = this.createUploadMiddleware();
  }

  createUploadMiddleware() {
    const blogUploadDir = 'uploads/blogs';
    if (!fs.existsSync(blogUploadDir)) {
      fs.mkdirSync(blogUploadDir, { recursive: true });
    }

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, blogUploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueName = `blog-${Date.now()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        }
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB for blog images
        files: 1
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg/i;
        const extname = allowedTypes.test(path.extname(file.originalname));
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    }).single('featuredImage');
  }

  // Create blog post
  createBlog = async (req, res) => {
    console.log('📝 [CONTROLLER] Create blog request received');
    
    try {
      console.log('📦 [CONTROLLER] Request body:', req.body);
      console.log('🔍 Body fields:', Object.keys(req.body));
      console.log('🖼️ Uploaded file:', req.file);
      
      // Validate required fields
      if (!req.body.title || req.body.title.trim() === '') {
        console.error('❌ [CONTROLLER] Title validation failed');
        return res.status(400).json({
          success: false,
          message: 'Blog title is required',
          error: 'Title cannot be empty'
        });
      }

      if (!req.body.content || req.body.content.trim() === '') {
        console.error('❌ [CONTROLLER] Content validation failed');
        return res.status(400).json({
          success: false,
          message: 'Blog content is required',
          error: 'Content cannot be empty'
        });
      }

      if (!req.body.authorId || isNaN(parseInt(req.body.authorId))) {
        console.error('❌ [CONTROLLER] Author validation failed');
        return res.status(400).json({
          success: false,
          message: 'Valid author ID is required',
          error: 'Author ID must be a valid number'
        });
      }

      // Generate slug if not provided
      let slug = req.body.slug;
      if (!slug || slug.trim() === '') {
        slug = req.body.title.toLowerCase()
          .replace(/[^\w\s]/gi, '')
          .replace(/\s+/g, '-');
      }

      // Prepare blog data
      const blogData = {
        title: req.body.title.trim(),
        slug: slug.trim(),
        excerpt: req.body.excerpt ? req.body.excerpt.trim() : null,
        content: req.body.content.trim(),
        authorId: parseInt(req.body.authorId),
        metaTitle: req.body.metaTitle ? req.body.metaTitle.trim() : null,
        metaDescription: req.body.metaDescription ? req.body.metaDescription.trim() : null,
        metaKeywords: req.body.metaKeywords ? req.body.metaKeywords.trim() : null,
        readingTime: req.body.readingTime ? parseInt(req.body.readingTime) || 0 : 0,
        status: req.body.status || 'draft',
        isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true || req.body.isFeatured === '1',
        isPublished: req.body.isPublished === 'true' || req.body.isPublished === true || req.body.isPublished === '1',
        publishedAt: req.body.isPublished === 'true' ? new Date() : null
      };
      
      console.log('🔧 [CONTROLLER] Processed data:', blogData);
      
      const blog = await this.blogService.createBlog(
        blogData,
        req.file
      );
      
      console.log('✅ [CONTROLLER] Blog created successfully');
      
      res.status(201).json({
        success: true,
        message: 'Blog created successfully',
        data: blog
      });
      
    } catch (error) {
      console.error('❌ [CONTROLLER] Error creating blog:', error.message);
      
      // Clean up uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, () => {});
      }
      
      if (error.message.includes('Validation error') || error.message.includes('unique constraint')) {
        return res.status(400).json({
          success: false,
          message: 'Blog creation failed',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating blog',
        error: error.message
      });
    }
  };

  // Get all blogs with filters
  getAllBlogs = async (req, res) => {
    try {
      console.log('📋 Get all blogs request received');
      const { 
        status, 
        author, 
        featured, 
        limit, 
        offset, 
        sortBy = 'publishedAt', 
        sortOrder = 'DESC',
        search 
      } = req.query;
      
      console.log('🔍 Query params:', { 
        status, author, featured, limit, offset, sortBy, sortOrder, search 
      });
      
      // Build filter options
      const options = {
        filters: {
          status: status || 'published', // Default to published blogs
          authorId: author ? parseInt(author) : null,
          isFeatured: featured ? (featured === 'true') : null
        },
        pagination: {
          limit: limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 10,
          offset: offset && !isNaN(parseInt(offset)) ? parseInt(offset) : 0
        },
        sort: {
          by: sortBy,
          order: sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
        },
        search: search ? search.trim() : null
      };
      
      const result = await this.blogService.getAllBlogs(options);
      
      console.log(`✅ Found ${result.count} blogs (showing ${result.data.length})`);
      
      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        currentPage: Math.floor(options.pagination.offset / options.pagination.limit) + 1,
        totalPages: Math.ceil(result.count / options.pagination.limit),
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error fetching blogs:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching blogs',
        error: error.message
      });
    }
  };

  // Get single blog by ID or slug
  getBlog = async (req, res) => {
    try {
      const { idOrSlug } = req.params;
      const { includeRelated = 'true', incrementViews = 'true' } = req.query;
      
      console.log('🔍 Get blog request:', { idOrSlug, includeRelated, incrementViews });
      
      if (!idOrSlug) {
        console.warn('⚠️ Invalid blog identifier');
        return res.status(400).json({
          success: false,
          message: 'Blog identifier is required'
        });
      }
      
      const blog = await this.blogService.getBlogByIdOrSlug(
        idOrSlug,
        includeRelated === 'true',
        incrementViews === 'true'
      );
      
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      
      console.log(`✅ Blog found: ${blog.title}`);
      
      res.status(200).json({
        success: true,
        data: blog
      });
    } catch (error) {
      console.error('❌ Error fetching blog:', error.message);
      
      if (error.message === 'Blog not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching blog',
        error: error.message
      });
    }
  };


  // In your controller updateBlog method
updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✏️ Update blog request:', id);
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid blog ID is required'
      });
    }
    
    try {
      const blogData = req.body;
      console.log('📦 Update data:', blogData);
      
      // CRITICAL FIX: Validate and convert authorId
      if (blogData.authorId) {
        const authorId = parseInt(blogData.authorId);
        
        // Check if user exists
       // const User = require('../models/user.model'); 
        const user = await this.User.findByPk(blogData.authorId);
        
        if (!user) {
          console.error(`❌ User with ID ${authorId} not found`);
          return res.status(400).json({
            success: false,
            message: `Author with ID ${authorId} does not exist`
          });
        }
        
        // Convert to integer for database
        blogData.authorId = authorId;
      } else {
        // If no authorId provided, keep the existing one
        const existingBlog = await this.blogService.getBlogById(parseInt(id));
        blogData.authorId = existingBlog.authorId;
        console.log('No authorId provided, keeping existing:', blogData.authorId);
      }
      
      // Handle status changes
      if (blogData.status === 'published' && !blogData.publishedAt) {
        blogData.publishedAt = new Date();
        blogData.isPublished = true;
      } else if (blogData.status === 'draft') {
        blogData.isPublished = false;
      }
      
      const blog = await this.blogService.updateBlog(
        parseInt(id),
        blogData,
        req.file
      );
      
      console.log(`✅ Blog updated: ${id}`);
      
      res.status(200).json({
        success: true,
        message: 'Blog updated successfully',
        data: blog
      });
    } catch (error) {
      console.error('❌ Error updating blog:', error.message);
      
      // Handle foreign key constraint error specifically
      if (error.message.includes('foreign key constraint') || 
          error.message.includes('blogs_ibfk_1')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid author. The specified user does not exist.',
          error: error.message
        });
      }
      
      if (error.message === 'Blog not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      
      if (error.message.includes('Validation error') || error.message.includes('Sequelize')) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      }
      
        res.status(500).json({
          success: false,
          message: 'Error updating blog',
          error: error.message
        });
      }
    } catch (error) {
      console.error('❌ Server error in updateBlog:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  };

  // // Delete blog
  deleteBlog = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🗑️ Delete blog request:', id);
      
      if (!id || isNaN(parseInt(id))) {
        console.warn('⚠️ Invalid blog ID for deletion:', id);
        return res.status(400).json({
          success: false,
          message: 'Valid blog ID is required'
        });
      }
      
      const result = await this.blogService.deleteBlog(parseInt(id));
      
      console.log(`✅ Blog deleted: ${id}`);
      
      res.status(200).json({
        success: true,
        message: result.message || 'Blog deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting blog:', error.message);
      
      if (error.message === 'Blog not found') {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting blog',
        error: error.message
      });
    }
  };



  // Increment blog views
incrementViews = async (req, res) => {
  try {
    const { identifier } = req.params; // Changed from 'id' to 'identifier'
    console.log('👁️ Increment views request:', identifier);
    
    if (!identifier) {
      console.warn('⚠️ Invalid identifier for view increment:', identifier);
      return res.status(400).json({
        success: false,
        message: 'Valid blog identifier is required'
      });
    }
    
    // Determine if identifier is numeric ID or slug
    let blogId;
    if (!isNaN(parseInt(identifier))) {
      // It's a numeric ID
      blogId = parseInt(identifier);
    } else {
      // It's a slug - we need to find the blog to get its ID
      const blog = await this.blogService.getBlogByIdOrSlug(identifier);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      blogId = blog.blogId;
    }
    
    const result = await this.blogService.incrementViews(blogId);
    
    console.log(`✅ Views incremented for blog ID: ${blogId} (identifier: ${identifier})`);
    
    res.status(200).json({
      success: true,
      message: 'Views incremented successfully',
      views: result.views
    });
  } catch (error) {
    console.error('❌ Error incrementing views:', error.message);
    
    if (error.message === 'Blog not found') {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error incrementing views',
      error: error.message
    });
  }
};

// Like blog
likeBlog = async (req, res) => {
  try {
    const { identifier } = req.params; // Changed from 'id' to 'identifier'
    console.log('❤️ Like blog request:', identifier);
    
    if (!identifier) {
      console.warn('⚠️ Invalid identifier for like:', identifier);
      return res.status(400).json({
        success: false,
        message: 'Valid blog identifier is required'
      });
    }
    
    // Determine if identifier is numeric ID or slug
    let blogId;
    if (!isNaN(parseInt(identifier))) {
      // It's a numeric ID
      blogId = parseInt(identifier);
    } else {
      // It's a slug - we need to find the blog to get its ID
      const blog = await this.blogService.getBlogByIdOrSlug(identifier);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      blogId = blog.blogId;
    }
    
    const result = await this.blogService.likeBlog(blogId);
    
    console.log(`✅ Blog liked ID: ${blogId} (identifier: ${identifier})`);
    
    res.status(200).json({
      success: true,
      message: 'Blog liked successfully',
      likes: result.likes
    });
  } catch (error) {
    console.error('❌ Error liking blog:', error.message);
    
    if (error.message === 'Blog not found') {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error liking blog',
      error: error.message
    });
  }
};

// Share blog
shareBlog = async (req, res) => {
  try {
    const { identifier } = req.params; // Changed from 'id' to 'identifier'
    console.log('📤 Share blog request:', identifier);
    
    if (!identifier) {
      console.warn('⚠️ Invalid identifier for share:', identifier);
      return res.status(400).json({
        success: false,
        message: 'Valid blog identifier is required'
      });
    }
    
    // Determine if identifier is numeric ID or slug
    let blogId;
    if (!isNaN(parseInt(identifier))) {
      // It's a numeric ID
      blogId = parseInt(identifier);
    } else {
      // It's a slug - we need to find the blog to get its ID
      const blog = await this.blogService.getBlogByIdOrSlug(identifier);
      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found'
        });
      }
      blogId = blog.blogId;
    }
    
    const result = await this.blogService.shareBlog(blogId);
    
    console.log(`✅ Blog shared ID: ${blogId} (identifier: ${identifier})`);
    
    res.status(200).json({
      success: true,
      message: 'Blog shared successfully',
      shares: result.shares
    });
  } catch (error) {
    console.error('❌ Error sharing blog:', error.message);
    
    if (error.message === 'Blog not found') {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error sharing blog',
        error: error.message
    });
  }
};

  // // Increment blog views
  // incrementViews = async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     console.log('👁️ Increment views request:', id);
      
  //     if (!id || isNaN(parseInt(id))) {
  //       console.warn('⚠️ Invalid blog ID for view increment:', id);
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Valid blog ID is required'
  //       });
  //     }
      
  //     const result = await this.blogService.incrementViews(parseInt(id));
      
  //     console.log(`✅ Views incremented for blog: ${id}`);
      
  //     res.status(200).json({
  //       success: true,
  //       message: 'Views incremented successfully',
  //       views: result.views
  //     });
  //   } catch (error) {
  //     console.error('❌ Error incrementing views:', error.message);
      
  //     if (error.message === 'Blog not found') {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Blog not found'
  //       });
  //     }
      
  //     res.status(500).json({
  //       success: false,
  //       message: 'Error incrementing views',
  //       error: error.message
  //     });
  //   }
  // };

  // // Like blog
  // likeBlog = async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     console.log('❤️ Like blog request:', id);
      
  //     if (!id || isNaN(parseInt(id))) {
  //       console.warn('⚠️ Invalid blog ID for like:', id);
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Valid blog ID is required'
  //       });
  //     }
      
  //     const result = await this.blogService.likeBlog(parseInt(id));
      
  //     console.log(`✅ Blog liked: ${id}`);
      
  //     res.status(200).json({
  //       success: true,
  //       message: 'Blog liked successfully',
  //       likes: result.likes
  //     });
  //   } catch (error) {
  //     console.error('❌ Error liking blog:', error.message);
      
  //     if (error.message === 'Blog not found') {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Blog not found'
  //       });
  //     }
      
  //     res.status(500).json({
  //       success: false,
  //       message: 'Error liking blog',
  //       error: error.message
  //     });
  //   }
  // };

  // // Share blog
  // shareBlog = async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     console.log('📤 Share blog request:', id);
      
  //     if (!id || isNaN(parseInt(id))) {
  //       console.warn('⚠️ Invalid blog ID for share:', id);
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Valid blog ID is required'
  //       });
  //     }
      
  //     const result = await this.blogService.shareBlog(parseInt(id));
      
  //     console.log(`✅ Blog shared: ${id}`);
      
  //     res.status(200).json({
  //       success: true,
  //       message: 'Blog shared successfully',
  //       shares: result.shares
  //     });
  //   } catch (error) {
  //     console.error('❌ Error sharing blog:', error.message);
      
  //     if (error.message === 'Blog not found') {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Blog not found'
  //       });
  //     }
      
  //     res.status(500).json({
  //       success: false,
  //       message: 'Error sharing blog',
  //       error: error.message
  //     });
  //   }
  // };

  // Get blog by author
  getBlogsByAuthor = async (req, res) => {
    try {
      const { authorId } = req.params;
      const { status = 'published', limit = 10, offset = 0 } = req.query;
      
      console.log('👤 Get blogs by author:', { authorId, status, limit, offset });
      
      if (!authorId || isNaN(parseInt(authorId))) {
        console.warn('⚠️ Invalid author ID:', authorId);
        return res.status(400).json({
          success: false,
          message: 'Valid author ID is required'
        });
      }
      
      const options = {
        filters: {
          status: status,
          authorId: parseInt(authorId)
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        sort: {
          by: 'publishedAt',
          order: 'DESC'
        }
      };
      
      const result = await this.blogService.getAllBlogs(options);
      
      console.log(`✅ Found ${result.count} blogs by author ${authorId}`);
      
      res.status(200).json({
        success: true,
        authorId: authorId,
        count: result.data.length,
        total: result.count,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error fetching blogs by author:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching blogs by author',
        error: error.message
      });
    }
  };

  // Get featured blogs
  getFeaturedBlogs = async (req, res) => {
    try {
      const { limit = 5, offset = 0 } = req.query;
      
      console.log('⭐ Get featured blogs:', { limit, offset });
      
      const options = {
        filters: {
          status: 'published',
          isFeatured: true
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        sort: {
          by: 'publishedAt',
          order: 'DESC'
        }
      };
      
      const result = await this.blogService.getAllBlogs(options);
      
      console.log(`✅ Found ${result.count} featured blogs`);
      
      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error fetching featured blogs:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching featured blogs',
        error: error.message
      });
    }
  };

  // Search blogs
  searchBlogs = async (req, res) => {
    try {
      const { q, limit = 10, offset = 0 } = req.query;
      
      console.log('🔍 Search blogs:', { q, limit, offset });
      
      if (!q || q.trim() === '') {
        console.warn('⚠️ Empty search query');
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const options = {
        filters: {
          status: 'published'
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        sort: {
          by: 'publishedAt',
          order: 'DESC'
        },
        search: q.trim()
      };
      
      const result = await this.blogService.getAllBlogs(options);
      
      console.log(`🔍 Found ${result.count} blogs matching "${q}"`);
      
      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        query: q,
        data: result.data
      });
    } catch (error) {
      console.error('❌ Error searching blogs:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error searching blogs',
        error: error.message
      });
    }
  };

  // Get blog statistics
  getBlogStats = async (req, res) => {
    try {
      console.log('📊 Get blog statistics');
      
      const stats = await this.blogService.getBlogStats();
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ Error fetching blog statistics:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching blog statistics',
        error: error.message
      });
    }
  };

  // Health check for blogs
  healthCheck = async (req, res) => {
    try {
      console.log('🏥 Blogs health check');
      
      const stats = await this.blogService.getBlogStats();
      
      res.status(200).json({
        success: true,
        message: 'Blogs API is healthy',
        stats: {
          ...stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Blogs health check failed:', error.message);
      res.status(500).json({
        success: false,
        message: 'Blogs health check failed',
        error: error.message
      });
    }
  };
}

module.exports = BlogController;




