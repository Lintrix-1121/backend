// routes/service.routes.js
const express = require('express');

module.exports = (serviceController) => {
  const router = express.Router();

  // Debug middleware
  const logRequest = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Content-Type:', req.headers['content-type']);
    next();
  };

  // Create service - Use the controller's upload middleware
  router.post('/', 
    logRequest,
    (req, res, next) => {
      console.log('🎯 Service create route - using controller upload middleware');
      // Call the controller's createService method which handles upload internally
      serviceController.createService(req, res);
    }
  );
  
  // Update service - Use the controller's upload middleware
  router.put('/:id',
    logRequest,
    (req, res, next) => {
      console.log('🎯 Service update route - using controller update method');
      serviceController.updateService(req, res);
    }
  );

  // Other routes that don't need file upload
  router.get('/', logRequest, serviceController.getAllServices.bind(serviceController));
  router.get('/active', logRequest, serviceController.getActiveServices.bind(serviceController));
  router.get('/search', logRequest, serviceController.searchServices.bind(serviceController));
  router.get('/health', logRequest, serviceController.healthCheck.bind(serviceController));
  router.get('/:id', logRequest, serviceController.getService.bind(serviceController));
  router.delete('/:id', logRequest, serviceController.deleteService.bind(serviceController));
  router.put('/order/update', logRequest, serviceController.updateServiceOrder.bind(serviceController));
  
  // Related services routes
  router.post('/related/add', logRequest, serviceController.addRelatedService.bind(serviceController));
  router.delete('/related/:serviceId/:relatedServiceId', logRequest, serviceController.removeRelatedService.bind(serviceController));
  router.get('/:serviceId/related', logRequest, serviceController.getRelatedServices.bind(serviceController));

  console.log('✅ Service routes configured');
  return router;
};


