const express = require('express');
const authMiddleware = require('../controllers/auth.middleware');

module.exports = (adminController) => {
  const router = express.Router();

  // All admin routes require authentication
  router.use(authMiddleware.authenticate);

  router.get('/users/stats', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.getUserStats(req, res)
  );

  // Customer management
  router.get('/customers', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.getCustomers(req, res)
  );

  router.get('/customers/:userId', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.getCustomerById(req, res)
  );

  router.get('/customers/:userId/orders', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.getCustomerOrders(req, res)
  );

  // User management 
  router.get('/users', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.getAllUsers(req, res)
  );

  router.put('/users/:userId/role', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.updateUserRole(req, res)
  );

  router.patch('/users/:userId/toggle-status', 
    authMiddleware.authorize(['admin']), 
    (req, res) => adminController.toggleUserStatus(req, res)
  );

  // Bulk operations 
  router.post('/users/bulk/activate', 
    authMiddleware.authorize(['admin']), 
    async (req, res) => {
      try {
        const { userIds } = req.body;
        res.json({ success: true, message: 'Bulk activation not implemented yet' });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    }
  );

  router.post('/users/bulk/deactivate', 
    authMiddleware.authorize(['admin']), 
    async (req, res) => {
      try {
        const { userIds } = req.body;
        res.json({ success: true, message: 'Bulk deactivation not implemented yet' });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    }
  );

  return router;
};








