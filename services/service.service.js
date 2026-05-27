const { Op } = require('sequelize');

class ServiceService {
  constructor(models, sequelize = null) {
    console.log('🔧 ServiceService constructor called');
    console.log('📦 Models type:', typeof models);
    console.log('🔑 Models keys:', models ? Object.keys(models).filter(key => 
      !['sequelize', 'Sequelize', 'Op'].includes(key)
    ) : 'models is null/undefined');
    
    // Store sequelize instance if provided
    this.sequelize = sequelize;
    
    // Validate models parameter
    if (!models) {
      console.error('❌ Models parameter is null or undefined');
      console.log('⚠️ Attempting to load models directly...');
      
      try {
        models = require('../models');
        console.log('✅ Models loaded successfully from require');
      } catch (error) {
        console.error('❌ Failed to load models:', error.message);
        // Create fallback models structure
        models = this.createFallbackModels();
      }
    }
    
    // Check and initialize Service model
    this.initializeServiceModel(models);
    
    // Check and initialize RelatedService model
    this.initializeRelatedServiceModel(models);
    
    // Check and initialize Sequelize Op
    this.Sequelize = models.Sequelize || require('sequelize');
    this.Op = models.Op || this.Sequelize.Op;
    
    // Store sequelize instance from models if available
    if (!this.sequelize && models.sequelize) {
      this.sequelize = models.sequelize;
    }
    
    console.log('🔧 ServiceService initialized');
    console.log('✅ Models initialized:', {
      Service: !!this.Service,
      RelatedService: !!this.RelatedService,
      Sequelize: !!this.Sequelize,
      sequelize: !!this.sequelize
    });
  }

  // Initialize Service model with fallback
  initializeServiceModel(models) {
    if (!models.Service) {
      console.warn('⚠️ models.Service is undefined. Checking available models...');
      const modelKeys = Object.keys(models);
      const serviceKey = modelKeys.find(key => 
        key.toLowerCase() === 'service' || key === 'Service'
      );
      
      if (serviceKey) {
        console.log(`✅ Found Service model as: ${serviceKey}`);
        this.Service = models[serviceKey];
      } else {
        console.error('❌ Service model not found in models object');
        console.log('📊 Creating fallback Service model...');
        this.Service = this.createFallbackServiceModel();
      }
    } else {
      this.Service = models.Service;
      console.log('✅ Service model initialized successfully');
    }
  }

  // Initialize RelatedService model with fallback
  initializeRelatedServiceModel(models) {
    if (!models.RelatedService) {
      console.warn('⚠️ models.RelatedService is undefined. Checking available models...');
      const modelKeys = Object.keys(models);
      const relatedKey = modelKeys.find(key => 
        key.toLowerCase().includes('related') || 
        key.includes('RelatedService')
      );
      
      if (relatedKey) {
        console.log(`✅ Found RelatedService model as: ${relatedKey}`);
        this.RelatedService = models[relatedKey];
      } else {
        console.error('❌ RelatedService model not found in models object');
        console.log('📊 Creating fallback RelatedService model...');
        this.RelatedService = this.createFallbackRelatedServiceModel();
      }
    } else {
      this.RelatedService = models.RelatedService;
      console.log('✅ RelatedService model initialized successfully');
    }
  }

  // Fallback model creation methods
  createFallbackModels() {
    return {
      Service: this.createFallbackServiceModel(),
      RelatedService: this.createFallbackRelatedServiceModel(),
      sequelize: this.sequelize,
      Sequelize: require('sequelize')
    };
  }

  createFallbackServiceModel() {
    console.log('🛠️ Creating fallback Service model');
    const fallbackData = [];
    let nextId = 1;
    
    return {
      findOne: async (options) => {
        console.log('🛠️ Fallback Service.findOne called:', options?.where);
        const where = options?.where || {};
        const service = fallbackData.find(item => {
          return Object.keys(where).every(key => item[key] == where[key]);
        });
        return service || null;
      },
      findAll: async (options = {}) => {
        console.log('🛠️ Fallback Service.findAll called:', options.where);
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
        console.log('🛠️ Fallback Service.findByPk called for id:', id);
        return fallbackData.find(item => item.serviceId == id) || null;
      },
      create: async (data) => {
        console.log('🛠️ Fallback Service.create called:', data);
        const service = {
          ...data,
          serviceId: nextId++,
          isActive: data.isActive !== undefined ? data.isActive : true,
          order: data.order || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          get: () => service,
          toJSON: () => ({...service}),
          update: async (updateData) => {
            Object.assign(service, updateData, { updatedAt: new Date() });
            return [1];
          },
          destroy: async () => {
            const index = fallbackData.findIndex(item => item.serviceId === service.serviceId);
            if (index > -1) {
              fallbackData.splice(index, 1);
            }
            return 1;
          }
        };
        fallbackData.push(service);
        return service;
      },
      update: async (data, options) => {
        console.log('🛠️ Fallback Service.update called:', data, options?.where);
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
        console.log('🛠️ Fallback Service.destroy called:', options?.where);
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

  createFallbackRelatedServiceModel() {
    console.log('🛠️ Creating fallback RelatedService model');
    const fallbackData = [];
    let nextId = 1;
    
    return {
      findOne: async (options) => {
        console.log('🛠️ Fallback RelatedService.findOne called:', options?.where);
        const where = options?.where || {};
        const relation = fallbackData.find(item => {
          return Object.keys(where).every(key => item[key] == where[key]);
        });
        return relation || null;
      },
      findAll: async (options = {}) => {
        console.log('🛠️ Fallback RelatedService.findAll called:', options.where);
        let results = [...fallbackData];
        
        if (options.where) {
          results = results.filter(item => {
            return Object.keys(options.where).every(key => item[key] == options.where[key]);
          });
        }
        
        return results;
      },
      create: async (data) => {
        console.log('🛠️ Fallback RelatedService.create called:', data);
        const relation = {
          ...data,
          relationId: nextId++,
          order: data.order || 0,
          relationType: data.relationType || 'similar',
          createdAt: new Date(),
          updatedAt: new Date(),
          get: () => relation,
          toJSON: () => ({...relation}),
          destroy: async () => {
            const index = fallbackData.findIndex(item => item.relationId === relation.relationId);
            if (index > -1) {
              fallbackData.splice(index, 1);
            }
            return 1;
          }
        };
        fallbackData.push(relation);
        return relation;
      },
      destroy: async (options) => {
        console.log('🛠️ Fallback RelatedService.destroy called:', options?.where);
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

  // Helper method to get Sequelize operator
  getSequelizeOperator() {
    if (this.Sequelize && this.Sequelize.Op) {
      return this.Sequelize.Op;
    }
    return { or: Symbol('or') }; // Fallback operator
  }


  // In service.service.js
async createService(serviceData, imageFile) {
  try {
    console.log('🎯 [SERVICE SERVICE] createService called');
    console.log('📦 serviceData:', serviceData);
    console.log('🖼️ imageFile:', imageFile);
    
    // Process boolean
    const isActive = imageFile && imageFile.isActive !== undefined 
      ? (imageFile.isActive === true || imageFile.isActive === 'true' || imageFile.isActive === '1')
      : true;
    
    // Prepare database data
    const dbData = {
      title: serviceData.title,
      subTitle: serviceData.subTitle || null,
      description: serviceData.description || null,
      icon: serviceData.icon || null,
      order: serviceData.order || 0,
      isActive: isActive
    };
    
    // Handle image
    if (imageFile && imageFile.filename) {
      // For services, use /uploads/services/ path
      dbData.image = `/uploads/services/${imageFile.filename}`;
      console.log('🖼️ [SERVICE SERVICE] Setting image path:', dbData.image);
    }
    
    console.log('💾 [SERVICE SERVICE] Creating service with data:', dbData);
    
    // Create in database
    const service = await this.Service.create(dbData);
    
    console.log('✅ [SERVICE SERVICE] Service created with ID:', service.serviceId);
    
    return this.formatServiceResponse(service);
  } catch (error) {
    console.error('❌ [SERVICE SERVICE] Error:', error.message);
    
    // Log Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      console.error('❌ [SERVICE SERVICE] Validation errors:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path}: ${err.message} (value: ${err.value})`);
      });
    }
    
    throw new Error(`Error creating service: ${error.message}`);
  }
}

  async getAllServices(includeInactive = false) {
  try {
    console.log('📋 getAllServices called, includeInactive:', includeInactive);
    
    const whereCondition = includeInactive ? {} : { isActive: true };
    
    const services = await this.Service.findAll({
      where: whereCondition,
      order: [['order', 'ASC'], ['createdAt', 'DESC']],
      include: [{
        model: this.Service,
        as: 'relatedServices',
        through: { attributes: [] },
        where: { isActive: true },
        required: false
      }]
    });
    
    console.log(`✅ Found ${services.length} services`);
    return services.map(service => this.formatServiceResponse(service));
  } catch (error) {
    console.error('❌ Error fetching services:', error.message);
    
    // If table doesn't exist, return empty array
    if (error.message.includes("doesn't exist") || error.message.includes("ER_NO_SUCH_TABLE")) {
      console.log('⚠️ Services table not found, returning empty array');
      return [];
    }
    
    throw new Error(`Error fetching services: ${error.message}`);
  }
}

  // Get service by ID
  async getServiceById(serviceId, includeRelated = true) {
    try {
      console.log('🔍 getServiceById called:', serviceId, 'includeRelated:', includeRelated);
      
      const includeOptions = includeRelated ? [{
        model: this.Service,
        as: 'relatedServices',
        through: { attributes: [] },
        where: { isActive: true },
        required: false
      }] : [];
      
      const service = await this.Service.findByPk(serviceId, {
        include: includeOptions
      });
      
      if (!service) {
        console.warn(`⚠️ Service not found: ${serviceId}`);
        throw new Error('Service not found');
      }
      
      console.log(`✅ Service found: ${service.title}`);
      return this.formatServiceResponse(service);
    } catch (error) {
      console.error('❌ Error fetching service:', error);
      throw new Error(`Error fetching service: ${error.message}`);
    }
  }

  // Update service
  async updateService(serviceId, serviceData, imageFile) {
    try {
      console.log('✏️ updateService called:', serviceId, serviceData);
      
      const service = await this.Service.findByPk(serviceId);
      if (!service) {
        console.warn(`⚠️ Service not found for update: ${serviceId}`);
        throw new Error('Service not found');
      }
      
      // Handle image update
      if (imageFile) {
        // Delete old image if exists
        if (service.image) {
          try {
            const { deleteFile } = require('../utils/upload.util');
            deleteFile(service.image);
          } catch (fileError) {
            console.warn('⚠️ Could not delete old image:', fileError.message);
          }
        }
        serviceData.image = imageFile.filename;
      }
      
      await service.update(serviceData);
      console.log(`✅ Service updated: ${serviceId}`);
      return this.formatServiceResponse(service);
    } catch (error) {
      console.error('❌ Error updating service:', error);
      throw new Error(`Error updating service: ${error.message}`);
    }
  }

  // Delete service
  async deleteService(serviceId) {
    try {
      console.log('🗑️ deleteService called:', serviceId);
      
      const service = await this.Service.findByPk(serviceId, {
        include: [{
          model: this.Service,
          as: 'relatedServices',
          through: { attributes: [] },
          required: false
        }]
      });
      
      if (!service) {
        console.warn(`⚠️ Service not found for deletion: ${serviceId}`);
        throw new Error('Service not found');
      }
      
      // Delete associated image file
      if (service.image) {
        try {
          const { deleteFile } = require('../utils/upload.util');
          deleteFile(service.image);
        } catch (fileError) {
          console.warn('⚠️ Could not delete image file:', fileError.message);
        }
      }
      
      // Remove all related service associations
      const Op = this.getSequelizeOperator();
      await this.RelatedService.destroy({
        where: {
          [Op.or]: [
            { serviceId: serviceId },
            { relatedServiceId: serviceId }
          ]
        }
      });
      
      await service.destroy();
      console.log(`✅ Service deleted: ${serviceId}`);
      return { message: 'Service deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting service:', error);
      throw new Error(`Error deleting service: ${error.message}`);
    }
  }

  // Add related service
  async addRelatedService(serviceId, relatedServiceId, relationType = 'similar') {
    try {
      console.log('🔗 addRelatedService called:', { serviceId, relatedServiceId, relationType });
      
      // Check if both services exist
      const service = await this.Service.findByPk(serviceId);
      const relatedService = await this.Service.findByPk(relatedServiceId);
      
      if (!service || !relatedService) {
        console.warn(`⚠️ Service(s) not found: ${serviceId}, ${relatedServiceId}`);
        throw new Error('One or both services not found');
      }
      
      // Check if relation already exists
      const existingRelation = await this.RelatedService.findOne({
        where: {
          serviceId,
          relatedServiceId
        }
      });
      
      if (existingRelation) {
        console.warn(`⚠️ Relation already exists: ${serviceId} -> ${relatedServiceId}`);
        throw new Error('Services are already related');
      }
      
      // Prevent self-relation
      if (serviceId === relatedServiceId) {
        console.warn(`⚠️ Attempted self-relation: ${serviceId}`);
        throw new Error('Cannot relate a service to itself');
      }
      
      const relation = await this.RelatedService.create({
        serviceId,
        relatedServiceId,
        relationType
      });
      
      console.log(`✅ Related service added: ${serviceId} -> ${relatedServiceId}`);
      return relation;
    } catch (error) {
      console.error('❌ Error adding related service:', error);
      throw new Error(`Error adding related service: ${error.message}`);
    }
  }

  // Remove related service
  async removeRelatedService(serviceId, relatedServiceId) {
    try {
      console.log('🔗 removeRelatedService called:', { serviceId, relatedServiceId });
      
      const result = await this.RelatedService.destroy({
        where: {
          serviceId,
          relatedServiceId
        }
      });
      
      if (result === 0) {
        console.warn(`⚠️ Relation not found: ${serviceId} -> ${relatedServiceId}`);
        throw new Error('Related service association not found');
      }
      
      console.log(`✅ Related service removed: ${serviceId} -> ${relatedServiceId}`);
      return { message: 'Related service removed successfully' };
    } catch (error) {
      console.error('❌ Error removing related service:', error);
      throw new Error(`Error removing related service: ${error.message}`);
    }
  }

  // Get related services for a service
  async getRelatedServices(serviceId) {
    try {
      console.log('🔍 getRelatedServices called:', serviceId);
      
      const service = await this.Service.findByPk(serviceId, {
        include: [{
          model: this.Service,
          as: 'relatedServices',
          through: { attributes: [] },
          where: { isActive: true },
          required: false
        }]
      });
      
      if (!service) {
        console.warn(`⚠️ Service not found: ${serviceId}`);
        throw new Error('Service not found');
      }
      
      console.log(`✅ Found ${service.relatedServices?.length || 0} related services`);
      return (service.relatedServices || []).map(relatedService => 
        this.formatServiceResponse(relatedService)
      );
    } catch (error) {
      console.error('❌ Error fetching related services:', error);
      throw new Error(`Error fetching related services: ${error.message}`);
    }
  }

  // Update service order
  async updateServiceOrder(servicesOrder) {
    try {
      console.log('📊 updateServiceOrder called:', servicesOrder);
      
      if (!this.sequelize) {
        console.warn('⚠️ No sequelize instance for transaction');
        // Execute without transaction
        for (const item of servicesOrder) {
          await this.Service.update(
            { order: item.order },
            {
              where: { serviceId: item.serviceId }
            }
          );
        }
      } else {
        const transaction = await this.sequelize.transaction();
        
        try {
          for (const item of servicesOrder) {
            await this.Service.update(
              { order: item.order },
              {
                where: { serviceId: item.serviceId },
                transaction
              }
            );
          }
          
          await transaction.commit();
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }
      
      console.log(`✅ Updated order for ${servicesOrder.length} services`);
      return { message: 'Service order updated successfully' };
    } catch (error) {
      console.error('❌ Error updating service order:', error);
      throw new Error(`Error updating service order: ${error.message}`);
    }
  }

  // Format service response
  formatServiceResponse(service) {
    if (!service) return null;
    
    const plainService = service.get ? service.get({ plain: true }) : service;
    
    // Convert image filename to URL
    if (plainService.image) {
      try {
        const { getFileUrl } = require('../utils/upload.util');
        plainService.imageUrl = getFileUrl(plainService.image);
      } catch (error) {
        console.warn('⚠️ Could not format image URL:', error.message);
        plainService.imageUrl = plainService.image;
      }
    }
    
    return plainService;
  }
}

module.exports = ServiceService;



