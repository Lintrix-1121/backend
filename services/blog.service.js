const { Op } = require('sequelize');
const blogUploadUtil = require('../utils/blogUpload.util');

class BlogService {

constructor(models, sequelize = null) {
  console.log('🔧 BlogService constructor called');
  console.log('🔍 Checking for User model...');
  
  this.sequelize = sequelize;
  
  // Store the models object for later reference
  this._models = models;
  
  // Try multiple ways to get User model
  this.User = null;
  
  // Method 1: Direct from models
  if (models && models.User) {
    this.User = models.User;
    console.log('✅ User model found in models.User');
  }
  
  // Method 2: From sequelize if available
  if (!this.User && sequelize && sequelize.models && sequelize.models.User) {
    this.User = sequelize.models.User;
    console.log('✅ User model found in sequelize.models.User');
  }
  
  // Method 3: Check if association exists (this is crucial!)
  if (!this.User && models && models.Blog && models.Blog.associations && models.Blog.associations.author) {
    // Get User model from Blog association
    this.User = models.Blog.associations.author.target;
    console.log('✅ User model found from Blog association');
  }
  
  if (!this.User) {
    console.warn('⚠️ User model NOT found initially - will try to load dynamically');
    console.log('ℹ️ Available models:', Object.keys(models || {}));
  } else {
    console.log('✅ User model successfully initialized:', {
      hasFindByPk: typeof this.User.findByPk === 'function',
      modelName: this.User.name
    });
  }
  
  // Initialize Blog model
  this.Blog = models.Blog;
  
  if (!this.Blog) {
    console.error('❌ Blog model is required but not found');
    throw new Error('Blog model is required');
  }
  
  console.log('✅ BlogService initialized');
}

// Add a method to dynamically get User model if needed
async getOrLoadUserModel() {
  if (this.User && typeof this.User.findByPk === 'function') {
    return this.User;
  }
  
  console.log('🔄 Attempting to load User model dynamically...');
  
  // Try to get from models
  if (this._models && this._models.User) {
    this.User = this._models.User;
    console.log('✅ User model loaded from _models');
    return this.User;
  }
  
  // Try to get from sequelize
  if (this.sequelize && this.sequelize.models && this.sequelize.models.User) {
    this.User = this.sequelize.models.User;
    console.log('✅ User model loaded from sequelize');
    return this.User;
  }
  
  // Last resort: try to require it
  try {
    const { User } = require('../models/user.model');
    this.User = User;
    console.log('✅ User model loaded via require');
    return this.User;
  } catch (error) {
    console.error('❌ Failed to load User model:', error.message);
    return null;
  }
}

  // Initialize models with fallback
  initializeBlogModel(models) {
    if (!models.Blog) {
      console.warn('⚠️ models.Blog is undefined. Checking available models...');
      const modelKeys = Object.keys(models);
      const blogKey = modelKeys.find(key => 
        key.toLowerCase() === 'blog' || key === 'Blog'
      );
      
      if (blogKey) {
        console.log(`✅ Found Blog model as: ${blogKey}`);
        this.Blog = models[blogKey];
      } else {
        console.error('❌ Blog model not found in models object');
        console.log('📊 Creating fallback Blog model...');
        this.Blog = this.createFallbackBlogModel();
      }
    } else {
      this.Blog = models.Blog;
      console.log('✅ Blog model initialized successfully');
    }
  }

  initializeUserModel(models) {
    if (!models.User) {
      console.warn('⚠️ models.User is undefined. Checking available models...');
      const modelKeys = Object.keys(models);
      const userKey = modelKeys.find(key => 
        key.toLowerCase() === 'user' || key === 'User'
      );
      
      if (userKey) {
        console.log(`✅ Found User model as: ${userKey}`);
        this.User = models[userKey];
      } else {
        console.log('⚠️ User model not found, will skip author details');
        this.User = null;
      }
    } else {
      this.User = models.User;
      console.log('✅ User model initialized successfully');
    }
  }

  // Create fallback models
  createFallbackModels() {
    return {
      Blog: this.createFallbackBlogModel(),
      User: this.createFallbackUserModel(),
      sequelize: this.sequelize,
      Sequelize: require('sequelize')
    };
  }

  createFallbackBlogModel() {
    console.log('🛠️ Creating fallback Blog model');
    const fallbackData = [];
    let nextId = 1;
    
    return {
      findOne: async (options) => {
        console.log('🛠️ Fallback Blog.findOne called:', options?.where);
        const where = options?.where || {};
        const blog = fallbackData.find(item => {
          return Object.keys(where).every(key => item[key] == where[key]);
        });
        return blog || null;
      },
      findAll: async (options = {}) => {
        console.log('🛠️ Fallback Blog.findAll called:', options.where);
        let results = [...fallbackData];
        
        if (options.where) {
          results = results.filter(item => {
            return Object.keys(options.where).every(key => {
              if (options.where[key] === true) {
                return item[key] === true;
              }
              if (options.where[key] === false) {
                return item[key] === false;
              }
              return item[key] == options.where[key];
            });
          });
        }
        
        if (options.order) {
          options.order.forEach(([field, direction]) => {
            results.sort((a, b) => {
              if (direction === 'ASC') {
                return a[field] > b[field] ? 1 : -1;
              } else {
                return a[field] < b[field] ? 1 : -1;
              }
            });
          });
        }
        
        return results;
      },
      findByPk: async (id) => {
        console.log('🛠️ Fallback Blog.findByPk called for id:', id);
        return fallbackData.find(item => item.blogId == id) || null;
      },
      count: async (options = {}) => {
        console.log('🛠️ Fallback Blog.count called:', options.where);
        let results = [...fallbackData];
        
        if (options.where) {
          results = results.filter(item => {
            return Object.keys(options.where).every(key => item[key] == options.where[key]);
          });
        }
        
        return results.length;
      },
      create: async (data) => {
        console.log('🛠️ Fallback Blog.create called:', data);
        const blog = {
          ...data,
          blogId: nextId++,
          views: 0,
          likes: 0,
          shares: 0,
          isFeatured: data.isFeatured || false,
          isPublished: data.isPublished || false,
          status: data.status || 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          get: () => blog,
          toJSON: () => ({...blog}),
          update: async (updateData) => {
            Object.assign(blog, updateData, { updatedAt: new Date() });
            return [1];
          },
          increment: async (field, options = { by: 1 }) => {
            if (Array.isArray(field)) {
              field.forEach(f => {
                blog[f] = (blog[f] || 0) + options.by;
              });
            } else {
              blog[field] = (blog[field] || 0) + options.by;
            }
            return [1];
          },
          destroy: async () => {
            const index = fallbackData.findIndex(item => item.blogId === blog.blogId);
            if (index > -1) {
              fallbackData.splice(index, 1);
            }
            return 1;
          }
        };
        fallbackData.push(blog);
        return blog;
      },
      update: async (data, options) => {
        console.log('🛠️ Fallback Blog.update called:', data, options?.where);
        const where = options?.where || {};
        let updatedCount = 0;
        
        fallbackData.forEach(item => {
          if (Object.keys(where).every(key => item[key] == where[key])) {
            Object.assign(item, data, { updatedAt: new Date() });
            updatedCount++;
          }
        });
        
        return [updatedCount];
      },
      destroy: async (options) => {
        console.log('🛠️ Fallback Blog.destroy called:', options?.where);
        const where = options?.where || {};
        const initialLength = fallbackData.length;
        
        for (let i = fallbackData.length - 1; i >= 0; i--) {
          if (Object.keys(where).every(key => fallbackData[i][key] == where[key])) {
            fallbackData.splice(i, 1);
          }
        }
        
        return initialLength - fallbackData.length;
      }
    };
  }

  createFallbackUserModel() {
    console.log('🛠️ Creating fallback User model');
    return {
      findByPk: async (id) => {
        return {
          userId: id,
          username: `user${id}`,
          email: `user${id}@example.com`
        };
      }
    };
  }

  // Helper method to get Sequelize operator
  getSequelizeOperator() {
    if (this.Sequelize && this.Sequelize.Op) {
      return this.Sequelize.Op;
    }
    return { or: Symbol('or'), like: Symbol('like') };
  }

  // Main service methods
  async createBlog(blogData, imageFile) {
    try {
      console.log('🎯 [BLOG SERVICE] createBlog called');
      console.log('📦 blogData:', blogData);
      console.log('🖼️ imageFile:', imageFile);
      
      // Prepare database data
      const dbData = {
        title: blogData.title || '',
        slug: blogData.slug || this.generateSlug(blogData.title || ''),
        excerpt: blogData.excerpt || null,
        content: blogData.content || '',
        authorId: parseInt(blogData.authorId) || 0,
        metaTitle: blogData.metaTitle || null,
        metaDescription: blogData.metaDescription || null,
        metaKeywords: blogData.metaKeywords || null,
        readingTime: parseInt(blogData.readingTime) || 0,
        status: blogData.status || 'draft',
        isFeatured: blogData.isFeatured === 'true' || blogData.isFeatured === true || blogData.isFeatured === '1',
        isPublished: blogData.isPublished === 'true' || blogData.isPublished === true || blogData.isPublished === '1',
        publishedAt: (blogData.isPublished === 'true' || blogData.isPublished === true || blogData.isPublished === '1') ? new Date() : null
      };
      
      // Handle image
      if (imageFile && imageFile.filename) {
        dbData.featuredImage = `/uploads/blogs/${imageFile.filename}`;
        console.log('🖼️ [BLOG SERVICE] Setting featured image path:', dbData.featuredImage);
      }
      
      console.log('💾 [BLOG SERVICE] Creating blog with data:', dbData);
      
      // Create in database
      const blog = await this.Blog.create(dbData);
      
      console.log('✅ [BLOG SERVICE] Blog created with ID:', blog.blogId);
      
      return await this.formatBlogResponse(blog);
    } catch (error) {
      console.error('❌ [BLOG SERVICE] Error:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.name === 'SequelizeValidationError') {
        console.error('❌ [BLOG SERVICE] Validation errors:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path}: ${err.message} (value: ${err.value})`);
        });
        throw new Error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Blog with this slug already exists');
      }
      
      throw new Error(`Error creating blog: ${error.message}`);
    }
  }

  // Add helper method for slug generation
  generateSlug(title) {
    if (!title) return 'untitled-' + Date.now();
    return title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async getAllBlogs(options = {}) {
    try {
      console.log('📋 getAllBlogs called with options:', options);
      
      const {
        filters = {},
        pagination = { limit: 10, offset: 0 },
        sort = { by: 'publishedAt', order: 'DESC' },
        search = null
      } = options;
      
      // Build where clause
      const where = {};
      
      // Apply filters
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.authorId) {
        where.authorId = filters.authorId;
      }
      
      if (filters.isFeatured !== null && filters.isFeatured !== undefined) {
        where.isFeatured = filters.isFeatured;
      }
      
      // Apply search
      if (search) {
        const Op = this.getSequelizeOperator();
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { excerpt: { [Op.like]: `%${search}%` } },
          { content: { [Op.like]: `%${search}%` } }
        ];
      }
      
      // Build include options
      const include = [];
      
      if (this.User) {
        include.push({
          model: this.User,
          as: 'author',
          attributes: ['userId', 'username', 'email', 'profilePicture']
        });
      }
      
      console.log('🔍 Query conditions:', { where, limit: pagination.limit, offset: pagination.offset });
      
      // Get total count
      const count = await this.Blog.count({ where });
      
      // Get paginated results
      const blogs = await this.Blog.findAll({
        where,
        include,
        limit: pagination.limit,
        offset: pagination.offset,
        order: [[sort.by, sort.order]]
      });
      
      console.log(`✅ Found ${count} blogs (returning ${blogs.length})`);
      
      // Format responses
      const formattedBlogs = await Promise.all(
        blogs.map(blog => this.formatBlogResponse(blog))
      );
      
      return {
        count,
        data: formattedBlogs
      };
    } catch (error) {
      console.error('❌ Error fetching blogs:', error.message);
      
      if (error.message.includes("doesn't exist") || error.message.includes("ER_NO_SUCH_TABLE")) {
        console.log('⚠️ Blogs table not found, returning empty array');
        return { count: 0, data: [] };
      }
      
      throw new Error(`Error fetching blogs: ${error.message}`);
    }
  }

  async getBlogByIdOrSlug(identifier, includeRelated = true, incrementViews = true) {
    try {
      console.log('🔍 getBlogByIdOrSlug called:', identifier);
      
      const where = isNaN(parseInt(identifier)) 
        ? { slug: identifier }
        : { blogId: parseInt(identifier) };
      
      // Build include options
      const include = [];
      
      if (this.User) {
        include.push({
          model: this.User,
          as: 'author',
          attributes: ['userId', 'username', 'profilePicture']
        });
      }
      
      const blog = await this.Blog.findOne({
        where,
        include
      });
      
      if (!blog) {
        console.warn(`⚠️ Blog not found: ${identifier}`);
        throw new Error('Blog not found');
      }
      
      // Increment views if requested
      if (incrementViews) {
        await blog.increment('views', { by: 1 });
        blog.views += 1;
      }
      
      console.log(`✅ Blog found: ${blog.title}`);
      return await this.formatBlogResponse(blog);
    } catch (error) {
      console.error('❌ Error fetching blog:', error);
      throw new Error(`Error fetching blog: ${error.message}`);
    }
  }



 async updateBlog(blogId, blogData, imageFile) {
  try {
    console.log('✏️ [SERVICE] updateBlog called:', blogId, blogData);
    
    // 1. First, get the blog
    const blog = await this.Blog.findByPk(blogId);
    if (!blog) {
      throw new Error('Blog not found');
    }
    
    // 2. Handle author validation SAFELY
    if (blogData.authorId && blogData.authorId !== '0' && blogData.authorId !== 0) {
      console.log('🔍 [SERVICE] Attempting author validation for ID:', blogData.authorId);
      
      // Check if User model is available
      if (!this.User) {
        console.warn('⚠️ [SERVICE] User model not available, skipping validation');
      } else if (typeof this.User.findByPk !== 'function') {
        console.error('❌ [SERVICE] User.findByPk is not a function!');
        console.log('ℹ️ User model type:', typeof this.User);
        console.log('ℹ️ User model keys:', Object.keys(this.User || {}));
        delete blogData.authorId;
      } else {
        // Try to validate
        try {
          const user = await this.User.findByPk(blogData.authorId);
          if (!user) {
            console.warn(`⚠️ User with ID ${blogData.authorId} not found`);
            delete blogData.authorId;
          }
        } catch (validationError) {
          console.warn('⚠️ Author validation error:', validationError.message);
          delete blogData.authorId;
        }
      }
    }
    
    // 3. Handle image
    if (imageFile) {
      // ... your image handling code
    }
    
    // 4. Update the blog (skip author validation if problematic)
    console.log('📝 [SERVICE] Updating blog with data:', Object.keys(blogData));
    await blog.update(blogData);
    
    return await this.formatBlogResponse(blog);
  } catch (error) {
    console.error('❌ [SERVICE] Error in updateBlog:', error.message);
    console.error('❌ [SERVICE] Full error:', error);
    throw new Error(`Error updating blog: ${error.message}`);
  }
}


  async deleteBlog(blogId) {
  try {
    console.log('🗑️ deleteBlog called:', blogId);
    
    const blog = await this.Blog.findByPk(blogId);
    if (!blog) {
      console.warn(`⚠️ Blog not found for deletion: ${blogId}`);
      throw new Error('Blog not found');
    }
    
    // Delete associated image file
    if (blog.featuredImage) {
      try {
        // Extract just the filename from the path
        const filename = blog.featuredImage.split('/').pop();
        await blogUploadUtil.deleteFile(filename);
      } catch (fileError) {
        console.warn('⚠️ Could not delete image file:', fileError.message);
      }
    }
    
    await blog.destroy();
    console.log(`✅ Blog deleted: ${blogId}`);
    return { message: 'Blog deleted successfully' };
  } catch (error) {
    console.error('❌ Error deleting blog:', error);
    throw new Error(`Error deleting blog: ${error.message}`);
  }
}

  

  async incrementViews(blogId) {
    try {
      console.log('👁️ incrementViews called:', blogId);
      
      const blog = await this.Blog.findByPk(blogId);
      if (!blog) {
        console.warn(`⚠️ Blog not found for view increment: ${blogId}`);
        throw new Error('Blog not found');
      }
      
      await blog.increment('views', { by: 1 });
      const updatedBlog = await this.Blog.findByPk(blogId);
      
      console.log(`✅ Views incremented for blog: ${blogId}`);
      return { views: updatedBlog.views };
    } catch (error) {
      console.error('❌ Error incrementing views:', error);
      throw new Error(`Error incrementing views: ${error.message}`);
    }
  }

  async likeBlog(blogId) {
    try {
      console.log('❤️ likeBlog called:', blogId);
      
      const blog = await this.Blog.findByPk(blogId);
      if (!blog) {
        console.warn(`⚠️ Blog not found for like: ${blogId}`);
        throw new Error('Blog not found');
      }
      
      await blog.increment('likes', { by: 1 });
      const updatedBlog = await this.Blog.findByPk(blogId);
      
      console.log(`✅ Blog liked: ${blogId}`);
      return { likes: updatedBlog.likes };
    } catch (error) {
      console.error('❌ Error liking blog:', error);
      throw new Error(`Error liking blog: ${error.message}`);
    }
  }

  async shareBlog(blogId) {
    try {
      console.log('📤 shareBlog called:', blogId);
      
      const blog = await this.Blog.findByPk(blogId);
      if (!blog) {
        console.warn(`⚠️ Blog not found for share: ${blogId}`);
        throw new Error('Blog not found');
      }
      
      await blog.increment('shares', { by: 1 });
      const updatedBlog = await this.Blog.findByPk(blogId);
      
      console.log(`✅ Blog shared: ${blogId}`);
      return { shares: updatedBlog.shares };
    } catch (error) {
      console.error('❌ Error sharing blog:', error);
      throw new Error(`Error sharing blog: ${error.message}`);
    }
  }

async getBlogStats() {
  try {
    console.log('📊 getBlogStats called');
    
    const { Blog } = this;
    
    // 1. Get counts
    const totalBlogs = await Blog.count();
    const publishedBlogs = await Blog.count({ where: { status: 'published' } });
    const draftBlogs = await Blog.count({ where: { status: 'draft' } });
    const featuredBlogs = await Blog.count({ 
      where: { 
        isFeatured: true, 
        status: 'published' 
      } 
    });
    
    // 2. Get all published blogs to calculate sums
    const allPublishedBlogs = await Blog.findAll({
      where: { status: 'published' },
      attributes: ['views', 'likes', 'shares'],
      raw: true
    });
    
    // 3. Calculate totals manually
    let totalViews = 0;
    let totalLikes = 0;
    let totalShares = 0;
    
    allPublishedBlogs.forEach(blog => {
      totalViews += blog.views || 0;
      totalLikes += blog.likes || 0;
      totalShares += blog.shares || 0;
    });
    
    const averageViews = allPublishedBlogs.length > 0 
      ? Math.round(totalViews / allPublishedBlogs.length) 
      : 0;
    
    // 4. Get recent blogs
    const recentBlogs = await Blog.findAll({
      where: { status: 'published' },
      order: [['publishedAt', 'DESC']],
      limit: 5,
      attributes: ['blogId', 'title', 'views', 'publishedAt'],
      include: [{
        model: this.User,
        as: 'author',
        attributes: ['username']
      }],
      raw: true,
      nest: true
    });
    
    // 5. Get top performing blogs
    const topBlogs = await Blog.findAll({
      where: { status: 'published' },
      order: [['views', 'DESC']],
      limit: 5,
      attributes: ['blogId', 'title', 'views', 'likes', 'shares'],
      include: [{
        model: this.User,
        as: 'author',
        attributes: ['username']
      }],
      raw: true,
      nest: true
    });
    
    // 6. Format the response
    const stats = {
      totals: {
        all: totalBlogs || 0,
        published: publishedBlogs || 0,
        draft: draftBlogs || 0,
        featured: featuredBlogs || 0
      },
      engagement: {
        totalViews: totalViews || 0,
        totalLikes: totalLikes || 0,
        totalShares: totalShares || 0,
        averageViews: averageViews || 0
      },
      recentActivity: recentBlogs.map(blog => ({
        id: blog.blogId,
        title: blog.title,
        views: blog.views || 0,
        publishedAt: blog.publishedAt,
        author: blog.author?.username || 'Unknown'
      })),
      topPerformers: topBlogs.map(blog => ({
        id: blog.blogId,
        title: blog.title,
        views: blog.views || 0,
        likes: blog.likes || 0,
        shares: blog.shares || 0,
        author: blog.author?.username || 'Unknown',
        engagementScore: Math.round(((blog.views || 0) * 0.4 + (blog.likes || 0) * 0.3 + (blog.shares || 0) * 0.3) / 10)
      })),
      calculatedAt: new Date().toISOString()
    };
    
    console.log('✅ Blog stats calculated successfully');
    console.log('📊 Stats summary:', {
      totalBlogs: stats.totals.all,
      published: stats.totals.published,
      totalViews: stats.engagement.totalViews,
      recentActivity: stats.recentActivity.length
    });
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting blog stats:', error);
    
    // Return minimal stats on error
    return {
      totals: {
        all: 0,
        published: 0,
        draft: 0,
        featured: 0
      },
      engagement: {
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        averageViews: 0
      },
      recentActivity: [],
      topPerformers: [],
      calculatedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

  async formatBlogResponse(blog) {
    if (!blog) return null;
    
    const plainBlog = blog.get ? blog.get({ plain: true }) : blog;
    
    // Format image URL
    if (plainBlog.featuredImage) {
      try {
        const { getFileUrl } = require('../utils/blogUpload.util');
        plainBlog.featuredImageUrl = getFileUrl(plainBlog.featuredImage);
      } catch (error) {
        console.warn('⚠️ Could not format image URL:', error.message);
        plainBlog.featuredImageUrl = plainBlog.featuredImage;
      }
    }
    
    // Calculate reading time if not set
    if (!plainBlog.readingTime || plainBlog.readingTime === 0) {
      const wordsPerMinute = 200;
      const wordCount = plainBlog.content ? plainBlog.content.split(/\s+/).length : 0;
      plainBlog.readingTime = Math.ceil(wordCount / wordsPerMinute);
    }
    
    // Format dates
    if (plainBlog.publishedAt) {
      const date = new Date(plainBlog.publishedAt);
      plainBlog.publishedAtFormatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      plainBlog.publishedAtRelative = this.getRelativeTime(date);
    }
    
    if (plainBlog.createdAt) {
      plainBlog.createdAtFormatted = new Date(plainBlog.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    // Add author details if available
    if (plainBlog.author) {
      plainBlog.authorName = plainBlog.author.username || `Author ${plainBlog.authorId}`;
      plainBlog.authorAvatar = plainBlog.author.profilePicture;
    }
    
    return plainBlog;
  }

  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 30) {
      const months = Math.floor(diffDay / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else if (diffDay > 0) {
      return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    } else {
      return 'Just now';
    }
  }
}

module.exports = BlogService;



