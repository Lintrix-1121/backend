const serviceUploadUtil = require('../utils/serviceUpload.util'); 

const multer = require('multer');
const path = require('path');
const fs = require('fs');


class ServiceController {
  constructor(serviceService) {
    console.log('🔧 ServiceController constructor called');
    console.log('📦 ServiceService type:', typeof serviceService);
    console.log('✅ ServiceController initialized');
    this.serviceService = serviceService;
    this.uploadServiceImage = this.createUploadMiddleware();
    
  }





  createUploadMiddleware() {
    const serviceUploadDir = 'uploads/services';
    if (!fs.existsSync(serviceUploadDir)) {
      fs.mkdirSync(serviceUploadDir, { recursive: true });
    }

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, serviceUploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueName = `service-${Date.now()}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        }
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/i;
        const extname = allowedTypes.test(path.extname(file.originalname));
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    }).single('image');
  }

  // Create service
  createService = (req, res) => {
    console.log('📝 [CONTROLLER] Create service request received');
    
    this.uploadServiceImage(req, res, async (err) => {
      if (err) {
        console.error('❌ [CONTROLLER] File upload error:', err.message);
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message
        });
      }
      
      try {
        console.log('📦 [CONTROLLER] Request body:', req.body);
        console.log('🔍 Body fields:', Object.keys(req.body));
        console.log('🖼️ Uploaded file:', req.file);
        
        // Validate required fields
        if (!req.body.title || req.body.title.trim() === '') {
          console.error('❌ [CONTROLLER] Title validation failed');
          return res.status(400).json({
            success: false,
            message: 'Service title is required',
            error: 'Title cannot be empty'
          });
        }
        
        // Prepare service data
        const serviceData = {
          title: req.body.title.trim(),
          subTitle: req.body.subTitle ? req.body.subTitle.trim() : null,
          description: req.body.description ? req.body.description.trim() : null,
          icon: req.body.icon ? req.body.icon.trim() : null,
          order: req.body.order ? parseInt(req.body.order) || 0 : 0,
          isActive: req.body.isActive === 'true' || req.body.isActive === true || req.body.isActive === '1'
        };
        
        console.log('🔧 [CONTROLLER] Processed data:', serviceData);
        
        const service = await this.serviceService.createService(
          serviceData,
          req.file
        );
        
        console.log('✅ [CONTROLLER] Service created successfully');
        
        res.status(201).json({
          success: true,
          message: 'Service created successfully',
          data: service
        });
        
      } catch (error) {
        console.error('❌ [CONTROLLER] Error creating service:', error.message);
        
        // Clean up uploaded file
        if (req.file && req.file.path) {
          fs.unlink(req.file.path, () => {});
        }
        
        res.status(500).json({
          success: false,
          message: 'Error creating service',
          error: error.message
        });
      }
    });
  };


 // Get all services
  async getAllServices(req, res) {
    try {
      console.log('📋 Get all services request received');
      const { includeInactive, limit, offset, search } = req.query;
      
      console.log('🔍 Query params:', { includeInactive, limit, offset, search });
      
      // Parse pagination
      const options = {};
      if (limit && !isNaN(parseInt(limit))) {
        options.limit = parseInt(limit);
      }
      if (offset && !isNaN(parseInt(offset))) {
        options.offset = parseInt(offset);
      }
      
      const services = await this.serviceService.getAllServices(
        includeInactive === 'true'
      );
      
      console.log(`✅ Found ${services.length} services`);
      
      // Apply search filter if provided
      let filteredServices = services;
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase().trim();
        filteredServices = services.filter(service => 
          service.title.toLowerCase().includes(searchTerm) ||
          service.subTitle?.toLowerCase().includes(searchTerm) ||
          service.description?.toLowerCase().includes(searchTerm)
        );
        console.log(`🔍 Filtered to ${filteredServices.length} services with search: "${search}"`);
      }
      
      res.status(200).json({
        success: true,
        count: filteredServices.length,
        total: services.length,
        data: filteredServices
      });
    } catch (error) {
      console.error('❌ Error fetching services:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching services',
        error: error.message
      });
    }
  }

  // Get single service
  async getService(req, res) {
    try {
      const { id } = req.params;
      const { includeRelated = 'true' } = req.query;
      
      console.log('🔍 Get service request:', { id, includeRelated });
      
      if (!id || isNaN(parseInt(id))) {
        console.warn('⚠️ Invalid service ID:', id);
        return res.status(400).json({
          success: false,
          message: 'Valid service ID is required'
        });
      }
      
      const service = await this.serviceService.getServiceById(
        parseInt(id),
        includeRelated === 'true'
      );
      
      console.log(`✅ Service found: ${service.title}`);
      
      res.status(200).json({
        success: true,
        data: service
      });
    } catch (error) {
      console.error('❌ Error fetching service:', error.message);
      
      if (error.message === 'Service not found') {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching service',
        error: error.message
      });
    }
  }

  // Update service
  async updateService(req, res) {
    try {
      const { id } = req.params;
      console.log('✏️ Update service request:', id);
      
      if (!id || isNaN(parseInt(id))) {
        console.warn('⚠️ Invalid service ID for update:', id);
        return res.status(400).json({
          success: false,
          message: 'Valid service ID is required'
        });
      }
      
      uploadServiceImage(req, res, async (err) => {
        if (err) {
          console.error('❌ File upload error:', err.message);
          return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: err.message
          });
        }
        
        try {
          const serviceData = req.body;
          console.log('📦 Update data:', serviceData);
          console.log('🖼️ File:', req.file ? req.file.filename : 'No file');
          
          // Validate order if provided
          if (serviceData.order !== undefined && isNaN(parseInt(serviceData.order))) {
            console.warn('⚠️ Validation failed: Order must be a number');
            return res.status(400).json({
              success: false,
              message: 'Order must be a number'
            });
          }
          
          const service = await this.serviceService.updateService(
            parseInt(id),
            serviceData,
            req.file
          );
          
          console.log(`✅ Service updated: ${id}`);
          
          res.status(200).json({
            success: true,
            message: 'Service updated successfully',
            data: service
          });
        } catch (error) {
          console.error('❌ Error updating service:', error.message);
          
          if (error.message === 'Service not found') {
            return res.status(404).json({
              success: false,
              message: 'Service not found'
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
            message: 'Error updating service',
            error: error.message
          });
        }
      });
    } catch (error) {
      console.error('❌ Server error in updateService:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }

  // Delete service
  async deleteService(req, res) {
    try {
      const { id } = req.params;
      console.log('🗑️ Delete service request:', id);
      
      if (!id || isNaN(parseInt(id))) {
        console.warn('⚠️ Invalid service ID for deletion:', id);
        return res.status(400).json({
          success: false,
          message: 'Valid service ID is required'
        });
      }
      
      const result = await this.serviceService.deleteService(parseInt(id));
      
      console.log(`✅ Service deleted: ${id}`);
      
      res.status(200).json({
        success: true,
        message: result.message || 'Service deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting service:', error.message);
      
      if (error.message === 'Service not found') {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting service',
        error: error.message
      });
    }
  }

  // Add related service
  async addRelatedService(req, res) {
    try {
      const { serviceId, relatedServiceId, relationType } = req.body;
      
      console.log('🔗 Add related service request:', { serviceId, relatedServiceId, relationType });
      
      if (!serviceId || !relatedServiceId) {
        console.warn('⚠️ Missing required fields for adding related service');
        return res.status(400).json({
          success: false,
          message: 'serviceId and relatedServiceId are required'
        });
      }
      
      if (isNaN(parseInt(serviceId)) || isNaN(parseInt(relatedServiceId))) {
        console.warn('⚠️ Invalid service IDs:', { serviceId, relatedServiceId });
        return res.status(400).json({
          success: false,
          message: 'Valid service IDs are required'
        });
      }
      
      const relation = await this.serviceService.addRelatedService(
        parseInt(serviceId),
        parseInt(relatedServiceId),
        relationType
      );
      
      console.log(`✅ Related service added: ${serviceId} -> ${relatedServiceId}`);
      
      res.status(201).json({
        success: true,
        message: 'Related service added successfully',
        data: relation
      });
    } catch (error) {
      console.error('❌ Error adding related service:', error.message);
      
      if (error.message.includes('already related') || error.message.includes('not found')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message.includes('Cannot relate a service to itself')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error adding related service',
        error: error.message
      });
    }
  }

  // Remove related service
  async removeRelatedService(req, res) {
    try {
      const { serviceId, relatedServiceId } = req.params;
      
      console.log('🔗 Remove related service request:', { serviceId, relatedServiceId });
      
      if (!serviceId || !relatedServiceId) {
        console.warn('⚠️ Missing required parameters for removing related service');
        return res.status(400).json({
          success: false,
          message: 'serviceId and relatedServiceId are required'
        });
      }
      
      if (isNaN(parseInt(serviceId)) || isNaN(parseInt(relatedServiceId))) {
        console.warn('⚠️ Invalid service IDs:', { serviceId, relatedServiceId });
        return res.status(400).json({
          success: false,
          message: 'Valid service IDs are required'
        });
      }
      
      const result = await this.serviceService.removeRelatedService(
        parseInt(serviceId),
        parseInt(relatedServiceId)
      );
      
      console.log(`✅ Related service removed: ${serviceId} -> ${relatedServiceId}`);
      
      res.status(200).json({
        success: true,
        message: result.message || 'Related service removed successfully'
      });
    } catch (error) {
      console.error('❌ Error removing related service:', error.message);
      
      if (error.message === 'Related service association not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error removing related service',
        error: error.message
      });
    }
  }

  // Get related services
  async getRelatedServices(req, res) {
    try {
      const { serviceId } = req.params;
      
      console.log('🔍 Get related services request:', serviceId);
      
      if (!serviceId || isNaN(parseInt(serviceId))) {
        console.warn('⚠️ Invalid service ID:', serviceId);
        return res.status(400).json({
          success: false,
          message: 'Valid service ID is required'
        });
      }
      
      const relatedServices = await this.serviceService.getRelatedServices(parseInt(serviceId));
      
      console.log(`✅ Found ${relatedServices.length} related services for ${serviceId}`);
      
      res.status(200).json({
        success: true,
        count: relatedServices.length,
        data: relatedServices
      });
    } catch (error) {
      console.error('❌ Error fetching related services:', error.message);
      
      if (error.message === 'Service not found') {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error fetching related services',
        error: error.message
      });
    }
  }

  // Update service order
  async updateServiceOrder(req, res) {
    try {
      const { servicesOrder } = req.body;
      
      console.log('📊 Update service order request:', servicesOrder);
      
      if (!Array.isArray(servicesOrder)) {
        console.warn('⚠️ servicesOrder must be an array');
        return res.status(400).json({
          success: false,
          message: 'servicesOrder must be an array'
        });
      }
      
      // Validate each item in the array
      for (const item of servicesOrder) {
        if (!item.serviceId || !item.order !== undefined) {
          console.warn('⚠️ Invalid service order item:', item);
          return res.status(400).json({
            success: false,
            message: 'Each item must have serviceId and order'
          });
        }
        
        if (isNaN(parseInt(item.serviceId)) || isNaN(parseInt(item.order))) {
          console.warn('⚠️ Invalid numeric values:', item);
          return res.status(400).json({
            success: false,
            message: 'serviceId and order must be numbers'
          });
        }
      }
      
      const result = await this.serviceService.updateServiceOrder(servicesOrder);
      
      console.log(`✅ Service order updated for ${servicesOrder.length} services`);
      
      res.status(200).json({
        success: true,
        message: result.message || 'Service order updated successfully'
      });
    } catch (error) {
      console.error('❌ Error updating service order:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error updating service order',
        error: error.message
      });
    }
  }

  // Get active services (convenience method)
  async getActiveServices(req, res) {
    try {
      console.log('📋 Get active services request');
      
      const services = await this.serviceService.getAllServices(false); // includeInactive = false
      
      console.log(`✅ Found ${services.length} active services`);
      
      res.status(200).json({
        success: true,
        count: services.length,
        data: services
      });
    } catch (error) {
      console.error('❌ Error fetching active services:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching active services',
        error: error.message
      });
    }
  }

  // Search services
  async searchServices(req, res) {
    try {
      const { q, includeInactive = 'false' } = req.query;
      
      console.log('🔍 Search services request:', { q, includeInactive });
      
      if (!q || q.trim() === '') {
        console.warn('⚠️ Empty search query');
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const allServices = await this.serviceService.getAllServices(includeInactive === 'true');
      
      const searchTerm = q.toLowerCase().trim();
      const filteredServices = allServices.filter(service => 
        service.title.toLowerCase().includes(searchTerm) ||
        service.subTitle?.toLowerCase().includes(searchTerm) ||
        service.description?.toLowerCase().includes(searchTerm)
      );
      
      console.log(`🔍 Found ${filteredServices.length} services matching "${q}"`);
      
      res.status(200).json({
        success: true,
        count: filteredServices.length,
        total: allServices.length,
        query: q,
        data: filteredServices
      });
    } catch (error) {
      console.error('❌ Error searching services:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error searching services',
        error: error.message
      });
    }
  }

  // Health check for services
  async healthCheck(req, res) {
    try {
      console.log('🏥 Services health check');
      
      const services = await this.serviceService.getAllServices(false);
      const totalServices = await this.serviceService.getAllServices(true);
      
      res.status(200).json({
        success: true,
        message: 'Services API is healthy',
        stats: {
          activeServices: services.length,
          totalServices: totalServices.length,
          inactiveServices: totalServices.length - services.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Services health check failed:', error.message);
      res.status(500).json({
        success: false,
        message: 'Services health check failed',
        error: error.message
      });
    }
  }
}

// Change from singleton to class export
module.exports = ServiceController;




