// utils/serviceUpload.util.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ServiceUploadUtil {
  constructor() {
    this.uploadDir = 'uploads/services';
    this.initializeStorage();
  }

  initializeStorage() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`✅ Created service upload directory: ${this.uploadDir}`);
    }

    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `service-${uuidv4()}${path.extname(file.originalname)}`;
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
        cb(new Error('Only image files are allowed'));
      }
    };
  }

  // FIXED: Simple middleware that handles everything
  getServiceUploadMiddleware() {
    console.log(`🛠️ Creating service upload middleware`);
    
    return (req, res, next) => {
      console.log('🔄 Processing service form with image');
      
      // Create multer instance that handles BOTH text and files
      const upload = multer({
        storage: this.storage,
        fileFilter: this.fileFilter,
        limits: {
          fileSize: 5 * 1024 * 1024 // 5MB
        }
      });
      
      // Use .fields() to specify what we expect
      upload.fields([
        { name: 'image', maxCount: 1 },    // File field
        { name: 'title', maxCount: 1 },    // Text fields
        { name: 'subTitle', maxCount: 1 },
        { name: 'description', maxCount: 1 },
        { name: 'icon', maxCount: 1 },
        { name: 'order', maxCount: 1 },
        { name: 'isActive', maxCount: 1 }
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
        
        // Convert files array to req.file for backward compatibility
        if (req.files && req.files.image && req.files.image[0]) {
          req.file = req.files.image[0];
          console.log('🖼️ Image file:', req.file.filename);
        }
        
        // Log all fields
        console.log('📦 Text fields:', Object.keys(req.body));
        console.log('🔍 Title field:', req.body.title);
        
        next();
      });
    };
  }

  // Alternative: Even simpler version
  getSimpleUploadMiddleware() {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }
    }).fields([
      { name: 'image', maxCount: 1 },
      { name: 'title', maxCount: 1 },
      { name: 'subTitle', maxCount: 1 },
      { name: 'description', maxCount: 1 },
      { name: 'icon', maxCount: 1 },
      { name: 'order', maxCount: 1 },
      { name: 'isActive', maxCount: 1 }
    ]);
  }

  // Keep for backward compatibility
  getSingleUploadMiddleware(fieldName = 'image') {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }
    }).single(fieldName);
  }

  getFileUrl(filename) {
    return `/uploads/services/${filename}`;
  }

  deleteFile(filePath) {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  }
}

module.exports = new ServiceUploadUtil();
