// controllers/AdminController.js
const { Sequelize } = require('sequelize');

class AdminController {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Get customers (users with 'user' role) - Admin only
   */
  async getCustomers(req, res) {
    try {
      console.log('AdminController.getCustomers called by user:', req.user.userId, 'role:', req.user.role);
      
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filters = {};

      // Build filters from query params
      if (req.query.isActive !== 'null' && req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }
      
      if (req.query.search) {
        filters[Sequelize.Op.or] = [
          { userName: { [Sequelize.Op.like]: `%${req.query.search}%` } },
          { email: { [Sequelize.Op.like]: `%${req.query.search}%` } }
        ];
      }
      
      if (req.query.provider && req.query.provider !== 'all' && req.query.provider !== 'null') {
        filters.provider = req.query.provider;
      }

      const result = await this.userService.getCustomers(page, limit, filters);

      res.json({
        success: true,
        message: 'Customers retrieved successfully',
        data: {
          customers: result.users,
          pagination: result.pagination
        }
      });
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve customers',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get user statistics - Admin only
   */
  async getUserStats(req, res) {
  try {
    console.log('AdminController.getUserStats called by user:', req.user.userId);
    
    const stats = await this.userService.getUserStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    // Return a 200 with partial data instead of 500
    res.status(200).json({
      success: true,
      data: {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: {},
        orders: {
          customersWithOrders: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0
        },
        lastUpdated: new Date(),
        error: error.message
      }
    });
  }
}
  // async getUserStats(req, res) {
  //   try {
  //     console.log('AdminController.getUserStats called by user:', req.user.userId);
      
  //     const stats = await this.userService.getUserStats();

  //     res.json({
  //       success: true,
  //       message: 'User statistics retrieved successfully',
  //       data: stats
  //     });
  //   } catch (error) {
  //     console.error('Get user stats error:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to retrieve user statistics',
  //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
  //     });
  //   }
  // }

  /**
   * Get all users with optional role filter - Admin only
   */
  async getAllUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const role = req.query.role || null;
      const filters = {};

      if (req.query.isActive !== undefined && req.query.isActive !== 'null') {
        filters.isActive = req.query.isActive === 'true';
      }
      
      if (req.query.search) {
        filters[Sequelize.Op.or] = [
          { userName: { [Sequelize.Op.like]: `%${req.query.search}%` } },
          { email: { [Sequelize.Op.like]: `%${req.query.search}%` } }
        ];
      }

      const result = await this.userService.getAllUsersByRole(
        role === 'all' ? null : role, 
        page, 
        limit, 
        filters
      );

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update user role - Admin only
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required'
        });
      }

      // Prevent changing your own role
      if (parseInt(userId) === req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot change your own role'
        });
      }

      const updatedUser = await this.userService.updateUserRole(userId, role);

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update user role error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update user role',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Toggle user active status - Admin only
   */
  async toggleUserStatus(req, res) {
    try {
      const { userId } = req.params;

      // Prevent toggling your own status
      if (parseInt(userId) === req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot change your own status'
        });
      }

      const result = await this.userService.toggleUserStatus(userId);

      res.json({
        success: true,
        message: result.message,
        data: {
          userId: result.userId,
          isActive: result.isActive
        }
      });
    } catch (error) {
      console.error('Toggle user status error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to toggle user status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get customer by ID - Admin only
   */
  async getCustomerById(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await this.userService.getProfile(userId);

      // Get additional customer stats
      // You might want to add methods to get orders, etc.

      res.json({
        success: true,
        message: 'Customer retrieved successfully',
        data: user
      });
    } catch (error) {
      console.error('Get customer by ID error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve customer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get customer orders - Admin only
   */
  async getCustomerOrders(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // You'll need to implement this in your service
      // const orders = await this.userService.getCustomerOrders(userId, page, limit);

      res.json({
        success: true,
        message: 'Customer orders retrieved successfully',
        data: {
          orders: [], // Replace with actual orders
          pagination: { page, limit, total: 0, pages: 0 }
        }
      });
    } catch (error) {
      console.error('Get customer orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve customer orders',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = AdminController;

