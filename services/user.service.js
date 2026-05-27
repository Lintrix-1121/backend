// services/UserService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize } =require('sequelize');

class UserService {
  constructor(models) {
    this.User = models.User;
    this.initializeJWTConfig();
  }

  /**
   * Initialize JWT configuration with defaults
   */
  initializeJWTConfig() {
    // Set default values if not in environment
    this.jwtConfig = {
      secret: process.env.JWT_SECRET || 'development-jwt-secret-' + Date.now(),
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'development-refresh-secret-' + Date.now(),
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    };

    // Log warning if using development defaults
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not found in environment. Using development default.');
      console.warn('⚠️  Set JWT_SECRET in your .env file for production.');
    }
  }

  /**
   * Validate JWT configuration
   */
  validateJWTConfig() {
    if (!this.jwtConfig.secret || this.jwtConfig.secret.includes('development')) {
      throw new Error('JWT secret is not properly configured. Please set JWT_SECRET in your .env file.');
    }
    return true;
  }



  // user.service.js - update register method
  async register(userData) {
    try {
      const { userName, email, password, provider = 'local', role = 'user' } = userData;
      
      // Check if user exists
      const existingUser = await this.User.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with role
      const user = await this.User.create({
        userName,
        email,
        password: hashedPassword,
        provider,
        role // Add role here
      });

      // Remove sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.refreshToken;

      return userResponse;
    } catch (error) {
      throw error;
    }
  }


  // services/user.service.js - Verify login method
  async login(email, password) {
    try {
      console.log('UserService.login called for email:', email);
      
      const user = await this.User.findOne({ where: { email } });
      
      if (!user) {
        console.log('User not found for email:', email);
        throw new Error('Invalid email or password');
      }

      console.log('User found:', user.userId, 'provider:', user.provider);

      // For OAuth users without password
      if (user.provider !== 'local' && !user.password) {
        throw new Error('Password not set for this user. Please use social login.');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log('Invalid password for user:', user.userId);
        throw new Error('Invalid email or password');
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Update refresh token in database
      user.refreshToken = refreshToken;
      await user.save();

      // Remove sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.refreshToken;

      console.log('Login successful for user:', user.userId);

      return {
        user: userResponse,
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('UserService.login error:', error.message);
      throw error;
    }
  }
  // // user.service.js - update login method to return role
  // async login(email, password) {
  //   try {
  //     const user = await this.User.findOne({ where: { email } });
      
  //     if (!user) {
  //       throw new Error('Invalid email or password');
  //     }

  //     // For OAuth users without password
  //     if (user.provider !== 'local' && !user.password) {
  //       throw new Error('Password not set for this user. Please use social login.');
  //     }

  //     // Verify password
  //     const isValidPassword = await bcrypt.compare(password, user.password);
  //     if (!isValidPassword) {
  //       throw new Error('Invalid email or password');
  //     }

  //     // Update last login
  //     user.lastLoginAt = new Date();
  //     await user.save();

  //     // Generate tokens
  //     const accessToken = this.generateAccessToken(user);
  //     const refreshToken = this.generateRefreshToken(user);

  //     // Update refresh token in database
  //     user.refreshToken = refreshToken;
  //     await user.save();

  //     // Remove sensitive data
  //     const userResponse = user.toJSON();
  //     delete userResponse.password;
  //     delete userResponse.refreshToken;

  //     return {
  //       user: userResponse,
  //       accessToken,
  //       refreshToken
  //     };
  //   } catch (error) {
  //     throw error;
  //   }
  // }

 
  /**
   * OAuth login/register
   */
  async oauthLogin(provider, providerData) {
    try {
      if (!['google', 'apple'].includes(provider)) {
        throw new Error('Invalid OAuth provider');
      }

      if (!providerData.providerId) {
        throw new Error('Provider ID is required');
      }

      // Find existing user by providerId
      let user = await this.User.findOne({
        where: {
          provider,
          providerId: providerData.providerId,
          isActive: true
        }
      });

      // If not found, check by email
      if (!user && providerData.email) {
        user = await this.User.findOne({
          where: { email: providerData.email, isActive: true }
        });

        // If found by email, update provider info
        if (user) {
          await user.update({
            provider,
            providerId: providerData.providerId
          });
        }
      }

      // Create new user if not exists
      if (!user) {
        user = await this.User.create({
          userName: providerData.userName || providerData.email?.split('@')[0] || `user_${Date.now()}`,
          email: providerData.email,
          provider,
          providerId: providerData.providerId,
          profilePicture: providerData.profilePicture,
          password: null, // No password for OAuth users
          isActive: true
        });
      }

      // Update last login
      await user.update({ lastLoginAt: new Date() });

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Save refresh token
      await user.update({ refreshToken });

      // Remove sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.refreshToken;

      return {
        user: userResponse,
        accessToken,
        refreshToken
      };
    } catch (error) {
      console.error('OAuth login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token required');
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtConfig.refreshSecret);

      // Find user
      const user = await this.User.findOne({
        where: {
          userId: decoded.userId,
          refreshToken,
          isActive: true
        }
      });

      if (!user) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      // Optionally generate new refresh token (rotate tokens)
      const newRefreshToken = this.generateRefreshToken(user);
      await user.update({ refreshToken: newRefreshToken });

      return {
        user: {
          userId: user.userId,
          userName: user.userName,
          email: user.email,
          profilePicture: user.profilePicture,
          provider: user.provider
        },
        accessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId) {
    try {
      const user = await this.User.findByPk(userId, {
        attributes: { exclude: ['password', 'refreshToken'] }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User account is not active');
      }

      return user;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await this.User.findByPk(userId);

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User account is not active');
      }

      // Don't allow changing email, provider, or providerId via this method
      const allowedUpdates = ['userName', 'profilePicture'];
      const filteredUpdates = {};
      
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredUpdates[field] = updateData[field];
        }
      });

      // Hash new password if provided
      if (updateData.password) {
        filteredUpdates.password = await bcrypt.hash(updateData.password, 10);
      }

      // Update user
      await user.update(filteredUpdates);

      // Remove sensitive data
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.refreshToken;

      return userResponse;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Logout user (clear refresh token)
   */
  async logout(userId) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (user) {
        await user.update({ refreshToken: null });
      }

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }


  /**
   * Generate JWT access token
   */
  generateAccessToken(user) {
    try {
      // Validate configuration
      this.validateJWTConfig();

      const payload = {
        userId: user.userId,
        email: user.email,
        userName: user.userName,
        role: user.role || 'user',
        provider: user.provider
      };

      return jwt.sign(
        payload,
        this.jwtConfig.secret,
        { expiresIn: this.jwtConfig.expiresIn }
      );
    } catch (error) {
      console.error('Error generating access token:', error);
      throw new Error('Failed to generate authentication token');
    }
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(user) {
    try {
      // Validate configuration
      this.validateJWTConfig();

      const payload = { 
        userId: user.userId,
        type: 'refresh'
      };

      return jwt.sign(
        payload,
        this.jwtConfig.refreshSecret,
        { expiresIn: this.jwtConfig.refreshExpiresIn }
      );
    } catch (error) {
      console.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    try {
      const user = await this.User.findOne({
        where: { email, isActive: true },
        attributes: { exclude: ['password', 'refreshToken'] }
      });
      return user;
    } catch (error) {
      console.error('Find by email error:', error);
      throw error;
    }
  }

  /**
   * Get user with password (for password verification)
   */
  async getUserWithPassword(userId) {
    try {
      const user = await this.User.findByPk(userId);
      return user;
    } catch (error) {
      console.error('Get user with password error:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const { count, rows } = await this.User.findAndCountAll({
        attributes: { exclude: ['password', 'refreshToken'] },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      });

      return {
        users: rows,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  /**
   * Update user role (admin only)
   */
    async updateUserRole(userId, role) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const validRoles = ['user', 'admin', 'moderator'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      await user.update({ role });
      
      const userResponse = user.toJSON();
      delete userResponse.password;
      delete userResponse.refreshToken;

      return userResponse;
    } catch (error) {
      console.error('Update user role error:', error);
      throw error;
    }
  }
  
  // async updateUserRole(userId, role) {
  //   try {
  //     const user = await this.User.findByPk(userId);
      
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     const validRoles = ['user', 'admin', 'moderator'];
  //     if (!validRoles.includes(role)) {
  //       throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  //     }

  //     await user.update({ role });
      
  //     const userResponse = user.toJSON();
  //     delete userResponse.password;
  //     delete userResponse.refreshToken;

  //     return userResponse;
  //   } catch (error) {
  //     console.error('Update user role error:', error);
  //     throw error;
  //   }
  // }

  /**
   * Generate password reset token
   */
  generateResetToken(userId) {
    try {
      this.validateJWTConfig();

      return jwt.sign(
        { 
          userId, 
          type: 'password_reset',
          timestamp: Date.now()
        },
        this.jwtConfig.secret,
        { expiresIn: '1h' }
      );
    } catch (error) {
      console.error('Generate reset token error:', error);
      throw new Error('Failed to generate reset token');
    }
  }

  /**
   * Verify password reset token
   */


  // In your authentication middleware
  verifyAccessToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, this.jwtConfig.secret);
      
      // Attach user info including role to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        userName: decoded.userName,
        role: decoded.role || 'user', // Ensure role is included
        provider: decoded.provider
      };
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.provider !== 'local') {
        throw new Error('Password change is not available for OAuth users');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await user.update({ password: hashedPassword });

      return true;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPasswordWithToken(resetToken, newPassword) {
    try {
      const userId = this.verifyResetToken(resetToken);
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password and clear reset token
      await user.update({ 
        password: hashedPassword,
        refreshToken: null // Clear any existing refresh tokens
      });

      return true;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      await user.update({ 
        isActive: false,
        refreshToken: null // Clear refresh token
      });

      return true;
    } catch (error) {
      console.error('Deactivate user error:', error);
      throw error;
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      await user.update({ isActive: true });

      return true;
    } catch (error) {
      console.error('Activate user error:', error);
      throw error;
    }
  }


  /**
   * Get all users with filtering by role (admin only)
   */


    async getAllUsersByRole(role = null, page = 1, limit = 20, filters = {}) {
    try {
      const whereClause = { ...filters };
      
      if (role) {
        whereClause.role = role;
      }

      const offset = (page - 1) * limit;
      
      const { count, rows } = await this.User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['password', 'refreshToken'] },
        include: [{
          association: 'orders',
          attributes: ['orderId', 'totalAmount', 'createdAt', 'status'],
          required: false,
          limit: 5,
          order: [['createdAt', 'DESC']],
          separate: false
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
      });

      // Calculate stats for each user
      const usersWithStats = rows.map(user => {
        const userJSON = user.toJSON();
        const orders = userJSON.orders || [];
        
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
        
        return {
          ...userJSON,
          totalOrders,
          totalSpent,
          lastOrderDate: orders.length > 0 ? orders[0].createdAt : null
        };
      });

      return {
        users: usersWithStats,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        },
        role: role || 'all'
      };
    } catch (error) {
      console.error('Get all users by role error:', error);
      throw error;
    }
  }

  // async getAllUsersByRole(role = null, page = 1, limit = 20, filters = {}) {
  //   try {
  //     const offset = (page - 1) * limit;
      
  //     // Build where clause
  //     const whereClause = { ...filters };
      
  //     // Add role filter if specified
  //     if (role && role !== 'all') {
  //       whereClause.role = role;
  //     }

  //     const { count, rows } = await this.User.findAndCountAll({
  //       where: whereClause,
  //       attributes: { 
  //         exclude: ['password', 'refreshToken'],
  //         include: [
  //           // You'll need to add these through associations or computed fields
  //           // This might require left joins with Order model
  //         ]
  //       },
  //       include: [
  //         {
  //           association: 'orders',
  //           attributes: ['orderId', 'total', 'createdAt'],
  //           required: false,
  //           limit: 5,
  //           order: [['createdAt', 'DESC']]
  //         }
  //       ],
  //       order: [['createdAt', 'DESC']],
  //       limit,
  //       offset,
  //       distinct: true
  //     });

  //     // Calculate additional statistics for each user
  //     const usersWithStats = await Promise.all(rows.map(async (user) => {
  //       const userJSON = user.toJSON();
        
  //       // Calculate order statistics
  //       const orders = userJSON.orders || [];
  //       const totalOrders = orders.length;
  //       const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
  //       const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  //       const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null;
        
  //       // Get wishlist count if association exists
  //       let wishlistCount = 0;
  //       if (user.wishlists) {
  //         wishlistCount = user.wishlists.length;
  //       }

  //       return {
  //         ...userJSON,
  //         totalOrders,
  //         totalSpent,
  //         averageOrderValue,
  //         lastOrderDate,
  //         orderIds: orders.map(o => o.orderId),
  //         wishlistCount
  //       };
  //     }));

  //     return {
  //       users: usersWithStats,
  //       pagination: {
  //         total: count,
  //         page,
  //         limit,
  //         pages: Math.ceil(count / limit)
  //       },
  //       role: role || 'all'
  //     };
  //   } catch (error) {
  //     console.error('Get all users by role error:', error);
  //     throw error;
  //   }
  // }

  /**
   * Get customers only (users with role = 'user')
   */
  // async getCustomers(page = 1, limit = 20, filters = {}) {
  //   return this.getAllUsersByRole('user', page, limit, filters);
  // }

    async getCustomers(page = 1, limit = 20, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      
      const whereClause = { 
        ...filters, 
        role: 'user' 
      };

      const { count, rows } = await this.User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['password', 'refreshToken'] },
        include: [{
          association: 'orders',
          attributes: ['orderId', 'totalAmount', 'createdAt', 'status'], // Use totalAmount, not total
          required: false,
          limit: 5,
          order: [['createdAt', 'DESC']],
          separate: false // This prevents the separate query that was causing issues
        }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
      });

      // Calculate stats for each user
      const usersWithStats = rows.map(user => {
        const userJSON = user.toJSON();
        const orders = userJSON.orders || [];
        
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        const lastOrderDate = orders.length > 0 ? orders[0].createdAt : null;
        
        return {
          ...userJSON,
          totalOrders,
          totalSpent,
          averageOrderValue,
          lastOrderDate,
          orderIds: orders.map(o => o.orderId)
        };
      });

      return {
        users: usersWithStats,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      console.error('Get customers error:', error);
      throw error;
    }
  }

  /**
   * Get admins only
   */
  async getAdmins(page = 1, limit = 20, filters = {}) {
    return this.getAllUsersByRole('admin', page, limit, filters);
  }

  /**
   * Get moderators only
   */
  async getModerators(page = 1, limit = 20, filters = {}) {
    return this.getAllUsersByRole('moderator', page, limit, filters);
  }

  /**
   * Bulk update user roles
   */
  async bulkUpdateRoles(userIds, role) {
    try {
      const validRoles = ['user', 'admin', 'moderator'];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      const [updatedCount] = await this.User.update(
        { role },
        {
          where: {
            userId: userIds,
            // Prevent changing your own role if you're an admin?
            // Add additional logic as needed
          }
        }
      );

      return {
        updated: updatedCount,
        message: `Updated ${updatedCount} user(s) to role: ${role}`
      };
    } catch (error) {
      console.error('Bulk update roles error:', error);
      throw error;
    }
  }

  /**
   * Toggle user active status
   */

   async toggleUserStatus(userId) {
    try {
      const user = await this.User.findByPk(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Prevent toggling your own status
      // You'll need to pass current user ID from controller
      
      await user.update({ 
        isActive: !user.isActive,
        refreshToken: user.isActive ? null : user.refreshToken // Clear refresh token on deactivation
      });

      return {
        userId: user.userId,
        isActive: user.isActive,
        message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
      };
    } catch (error) {
      console.error('Toggle user status error:', error);
      throw error;
    }
  }
  // async toggleUserStatus(userId) {
  //   try {
  //     const user = await this.User.findByPk(userId);
      
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     // Prevent deactivating your own account if you're an admin?
  //     // Add logic as needed

  //     await user.update({ 
  //       isActive: !user.isActive,
  //       // Optionally clear refresh token on deactivation
  //       refreshToken: user.isActive ? null : user.refreshToken
  //     });

  //     return {
  //       userId: user.userId,
  //       isActive: user.isActive,
  //       message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`
  //     };
  //   } catch (error) {
  //     console.error('Toggle user status error:', error);
  //     throw error;
  //   }
  // }

  /**
   * Get user statistics by role
   */
 async getUserStats() {
    try {
      const totalUsers = await this.User.count();
      const activeUsers = await this.User.count({ where: { isActive: true } });
      
      // Get role counts
      const roleCounts = await this.User.findAll({
        attributes: [
          'role',
          [Sequelize.fn('COUNT', Sequelize.col('role')), 'count']
        ],
        group: ['role']
      });

      const roleStats = {};
      roleCounts.forEach(stat => {
        roleStats[stat.role] = parseInt(stat.dataValues.count);
      });

      // Get order statistics
      const orderStats = await this.User.sequelize.query(
        `SELECT 
          COUNT(DISTINCT userId) as customersWithOrders,
          COUNT(*) as totalOrders,
          SUM(totalAmount) as totalRevenue,
          AVG(totalAmount) as avgOrderValue
         FROM orders`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      return {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: roleStats,
        orders: orderStats[0] || {
          customersWithOrders: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      // Return basic stats even if order stats fail
      return {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: roleStats,
        orders: {
          customersWithOrders: 0,
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0
        },
        lastUpdated: new Date()
      };
    }
  }
 
  // async getUserStats() {
  //   try {
  //     const totalUsers = await this.User.count();
  //     const activeUsers = await this.User.count({ where: { isActive: true } });
  //     const roleCounts = await this.User.findAll({
  //       attributes: [
  //         'role',
  //         [Sequelize.fn('COUNT', Sequelize.col('role')), 'count']
  //       ],
  //       group: ['role']
  //     });

  //     const roleStats = {};
  //     roleCounts.forEach(stat => {
  //       roleStats[stat.role] = parseInt(stat.dataValues.count);
  //     });

  //     return {
  //       total: totalUsers,
  //       active: activeUsers,
  //       inactive: totalUsers - activeUsers,
  //       byRole: roleStats,
  //       lastUpdated: new Date()
  //     };
  //   } catch (error) {
  //     console.error('Get user stats error:', error);
  //     throw error;
  //   }
  // }
}

module.exports = UserService;

 


