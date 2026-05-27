const multer = require('multer');
const path = require('path');
const fs = require('fs');

class ProjectUploadUtil {
  constructor() {
    this.uploadDirs = {
      images: 'uploads/projects/images',
      videos: 'uploads/projects/videos',
      documents: 'uploads/projects/documents'
    };

    this.allowedTypes = {
      images: /jpeg|jpg|png|gif|webp|svg/i,
      videos: /mp4|mpeg|quicktime|webm/i,
      documents: /pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document/i
    };

    this.maxSizes = {
      images: 10 * 1024 * 1024, // 10MB
      videos: 100 * 1024 * 1024, // 100MB
      documents: 20 * 1024 * 1024 // 20MB
    };

    this.ensureDirectories();
  }

  ensureDirectories() {
    Object.values(this.uploadDirs).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  getStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, this.uploadDirs.images);
        } else if (file.mimetype.startsWith('video/')) {
          cb(null, this.uploadDirs.videos);
        } else {
          cb(null, this.uploadDirs.documents);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `project-${uniqueSuffix}${ext}`);
      }
    });
  }

  getFileFilter() {
    return (req, file, cb) => {
      const extname = path.extname(file.originalname).toLowerCase();
      const mimetype = file.mimetype.toLowerCase();

      if (file.mimetype.startsWith('image/') && 
          this.allowedTypes.images.test(extname)) {
        cb(null, true);
      } else if (file.mimetype.startsWith('video/') && 
                 this.allowedTypes.videos.test(extname)) {
        cb(null, true);
      } else if (this.allowedTypes.documents.test(extname)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
      }
    };
  }

  getLimits() {
    return {
      fileSize: 100 * 1024 * 1024, // 100MB max
      files: 20 // Max 20 files per request
    };
  }

  createUploadMiddleware() {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.getFileFilter(),
      limits: this.getLimits()
    }).array('media', 20);
  }

  createSingleUploadMiddleware(fieldName = 'media') {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.getFileFilter(),
      limits: this.getLimits()
    }).single(fieldName);
  }

  createFieldsUploadMiddleware(fields) {
    return multer({
      storage: this.getStorage(),
      fileFilter: this.getFileFilter(),
      limits: this.getLimits()
    }).fields(fields);
  }

  getFileUrl(filename, type = 'image') {
    const typeMap = {
      image: 'images',
      video: 'videos',
      document: 'documents'
    };
    const folder = typeMap[type] || 'images';
    return `/uploads/projects/${folder}/${filename}`;
  }

  async deleteFile(filePath) {
    try {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        console.log(` Deleted file: ${filePath}`);
        return true;
      }
    } catch (error) {
      console.error(` Error deleting file: ${filePath}`, error.message);
      return false;
    }
  }

  getFileInfo(file) {
    let type = 'other';
    if (file.mimetype.startsWith('image/')) {
      type = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      type = 'video';
    } else if (this.allowedTypes.documents.test(path.extname(file.originalname))) {
      type = 'document';
    }

    return {
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      type: type,
      url: this.getFileUrl(file.filename, type)
    };
  }
}

module.exports = new ProjectUploadUtil();


// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Configure storage
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     let uploadPath = 'uploads/projects/';
    
//     // Determine subfolder based on file type
//     if (file.mimetype.startsWith('image/')) {
//       uploadPath += 'images/';
//     } else if (file.mimetype.startsWith('video/')) {
//       uploadPath += 'videos/';
//     } else {
//       uploadPath += 'documents/';
//     }
    
//     // Create directory if it doesn't exist
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }
    
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     const ext = path.extname(file.originalname);
//     cb(null, file.fieldname + '-' + uniqueSuffix + ext);
//   }
// });

// // File filter
// const fileFilter = (req, file, cb) => {
//   const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
//   const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
//   const allowedDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
//   if (allowedImageTypes.includes(file.mimetype) || 
//       allowedVideoTypes.includes(file.mimetype) || 
//       allowedDocTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'), false);
//   }
// };

// // Create multer upload instance
// const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: {
//     fileSize: 100 * 1024 * 1024 // 100MB limit for videos
//   }
// });

// // Middleware for multiple file uploads
// const uploadProjectMedia = upload.array('media', 20); // Max 20 files

// // Middleware for single file upload
// const uploadSingle = upload.single('file');

// // Middleware for featured image
// const uploadFeaturedImage = upload.single('featuredImage');

// // Export middleware functions
// module.exports = {
//   uploadProjectMedia,
//   uploadSingle,
//   uploadFeaturedImage,
//   // Helper to get file URL
//   getFileUrl: (filename, type = 'image') => {
//     return `/uploads/projects/${type}s/${filename}`;
//   }
// };