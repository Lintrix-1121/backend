const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class BlogUploadUtil {
  constructor() {
    this.uploadDir = 'uploads/blogs';
    this.initializeStorage();
  }

  initializeStorage() {
    // Create main upload directory
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`✅ Created blog upload directory: ${this.uploadDir}`);
    }

    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueId = uuidv4().slice(0, 8);
        const sanitizedOriginalName = file.originalname
          .replace(/[^\w\s.-]/gi, '')
          .replace(/\s+/g, '-')
          .toLowerCase();
        
        const uniqueName = `blog-${uniqueId}-${sanitizedOriginalName}`;
        cb(null, uniqueName);
      }
    });

    this.fileFilter = (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type. Allowed types: ${allowedTypes}`));
      }
    };
  }

  // Main upload middleware for blog creation
  getBlogUploadMiddleware() {
    console.log(`🛠️ Creating blog upload middleware`);
    
    return (req, res, next) => {
      console.log('🔄 Processing blog form with featured image');
      
      const upload = multer({
        storage: this.storage,
        fileFilter: this.fileFilter,
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB for blog images
          files: 1
        }
      });
      
      // Blog form fields
      upload.fields([
        { name: 'featuredImage', maxCount: 1 },
        { name: 'title', maxCount: 1 },
        { name: 'slug', maxCount: 1 },
        { name: 'excerpt', maxCount: 1 },
        { name: 'content', maxCount: 1 },
        { name: 'authorId', maxCount: 1 },
        { name: 'metaTitle', maxCount: 1 },
        { name: 'metaDescription', maxCount: 1 },
        { name: 'metaKeywords', maxCount: 1 },
        { name: 'readingTime', maxCount: 1 },
        { name: 'status', maxCount: 1 },
        { name: 'isFeatured', maxCount: 1 },
        { name: 'isPublished', maxCount: 1 }
      ])(req, res, (err) => {
        if (err) {
          console.error('❌ Upload error:', err.message);
          return res.status(400).json({
            success: false,
            message: 'Form upload error',
            error: err.message
          });
        }
        
        console.log('✅ Form processed successfully');
        
        // Process featured image
        if (req.files && req.files.featuredImage && req.files.featuredImage[0]) {
          req.file = req.files.featuredImage[0];
          console.log('🖼️ Featured image:', req.file.filename);
        }
        
        // Log all fields
        console.log('📦 Text fields:', Object.keys(req.body));
        console.log('🔍 Title field:', req.body.title);
        console.log('👤 Author ID:', req.body.authorId);
        
        next();
      });
    };
  }

  // Middleware for just featured image upload (for updates)
  getFeaturedImageUploadMiddleware() {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }
    }).single('featuredImage');
  }

  // Get file URL for serving
  getFileUrl(filename) {
    return `/uploads/blogs/${filename}`;
  }

  // Delete file
  deleteFile(filename) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.uploadDir, filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) reject(err);
          else {
            console.log('🗑️ Deleted blog image:', filename);
            resolve(true);
          }
        });
      } else {
        resolve(false);
      }
    });
  }

  // Delete by full path (for backward compatibility)
  deleteFileByPath(filePath) {
    return new Promise((resolve, reject) => {
      if (!filePath) {
        resolve(false);
        return;
      }
      
      const filename = path.basename(filePath);
      this.deleteFile(filename)
        .then(resolve)
        .catch(reject);
    });
  }

  // Health check
  healthCheck() {
    const uploadDirExists = fs.existsSync(this.uploadDir);
    
    return {
      uploadDirectory: {
        exists: uploadDirExists,
        path: this.uploadDir,
        writable: uploadDirExists ? this.isWritable(this.uploadDir) : false
      },
      status: uploadDirExists ? 'healthy' : 'unhealthy'
    };
  }

  isWritable(directory) {
    try {
      const testFile = path.join(directory, '.writable-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new BlogUploadUtil();


