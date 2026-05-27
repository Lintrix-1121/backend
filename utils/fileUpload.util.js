// utils/fileUpload.util.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class FileUploadUtil {
  constructor() {
    this.uploadDir = 'uploads/products';
    this.initializeStorage();
  }

  initializeStorage() {
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    // Configure storage
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    // File filter for images
    this.fileFilter = (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
      }
    };
  }

  getUploadMiddleware(fieldName = 'images', maxCount = 10) {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      }
    }).array(fieldName, maxCount);
  }

  getSingleUploadMiddleware(fieldName = 'image') {
    return multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      }
    }).single(fieldName);
  }

  // Helper to generate URL for uploaded file
  getFileUrl(filename) {
    return `/uploads/products/${filename}`;
  }

  // Delete file from storage
  deleteFile(filePath) {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      } else {
        resolve(false); // File doesn't exist
      }
    });
  }

  // Clean up uploaded files on error
  cleanupFiles(files) {
    if (files && Array.isArray(files)) {
      files.forEach(file => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
  }

  // Get file info for database storage
  getFileInfo(file) {
    return {
      url: this.getFileUrl(file.filename),
      path: file.path,
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    };
  }
}

module.exports = new FileUploadUtil();