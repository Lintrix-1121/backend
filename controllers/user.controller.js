// controllers/UserController.js (keep this one, delete the duplicate)
class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Register new user
   */
  async register(req, res) {
    try {
      const { userName, email, password } = req.body;

      if (!userName || !email) {
        return res.status(400).json({
          success: false,
          message: 'Username and email are required'
        });
      }

      // For local registration, password is required
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required for local registration'
        });
      }

      const user = await this.userService.register(req.body);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: user
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Login user
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await this.userService.login(email, password);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid email or password')) {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * OAuth callback
   */
  async oauthCallback(req, res) {
    try {
      const { provider } = req.params;
      const providerData = req.body;

      if (!['google', 'apple'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OAuth provider'
        });
      }

      const result = await this.userService.oauthLogin(provider, providerData);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'OAuth login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      console.error('OAuth error:', error);
      res.status(500).json({
        success: false,
        message: 'OAuth login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      const result = await this.userService.refreshToken(refreshToken);

      // Update cookie with new refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.message === 'Invalid refresh token' || error.message === 'Refresh token expired') {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to refresh token',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get user profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await this.userService.getProfile(userId);

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await this.userService.updateProfile(userId, req.body);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req, res) {
    try {
      const userId = req.user.userId;
      await this.userService.logout(userId);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get current user (for frontend to check auth status)
   */
  async getCurrentUser(req, res) {
    try {
      if (!req.user) {
        return res.json({
          success: true,
          data: null,
          message: 'No user logged in'
        });
      }

      const userId = req.user.userId;
      const user = await this.userService.getProfile(userId);

      res.json({
        success: true,
        data: user,
        message: 'User retrieved successfully'
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      await this.userService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      
      if (error.message === 'Current password is incorrect') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Check if user exists
      const user = await this.userService.findByEmail(email);
      
      if (!user) {
        // Return success anyway to prevent email enumeration
        return res.json({
          success: true,
          message: 'If an account exists with this email, a reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = this.userService.generateResetToken(user.userId);
      
      // TODO: Send email with reset token
      // await sendResetEmail(email, resetToken);

      res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent'
      });
    } catch (error) {
      console.error('Request password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      await this.userService.resetPasswordWithToken(token, newPassword);

      res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      
      if (error.message === 'Invalid or expired token') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      // TODO: Implement email verification
      // const userId = this.userService.verifyEmailToken(token);
      // await this.userService.updateProfile(userId, { isEmailVerified: true });

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
  }
}

module.exports = UserController;

// class UserController {
//   constructor(userService) {
//     this.userService = userService;
//   }

//   /**
//    * Register new user
//    */
//   async register(req, res) {
//     try {
//       const { userName, email, password } = req.body;

//       if (!userName || !email) {
//         return res.status(400).json({
//           success: false,
//           message: 'Username and email are required'
//         });
//       }

//       // For local registration, password is required
//       if (!password) {
//         return res.status(400).json({
//           success: false,
//           message: 'Password is required for local registration'
//         });
//       }

//       const user = await this.userService.register(req.body);

//       res.status(201).json({
//         success: true,
//         message: 'User registered successfully',
//         data: user
//       });
//     } catch (error) {
//       console.error('Registration error:', error);
      
//       if (error.message === 'User with this email already exists') {
//         return res.status(409).json({
//           success: false,
//           message: error.message
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: 'Registration failed',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Login user
//    */
//   async login(req, res) {
//     try {
//       const { email, password } = req.body;

//       if (!email || !password) {
//         return res.status(400).json({
//           success: false,
//           message: 'Email and password are required'
//         });
//       }

//       const result = await this.userService.login(email, password);

//       // Set refresh token as HTTP-only cookie (optional)
//       res.cookie('refreshToken', result.refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//       });

//       res.json({
//         success: true,
//         message: 'Login successful',
//         data: {
//           user: result.user,
//           accessToken: result.accessToken
//         }
//       });
//     } catch (error) {
//       console.error('Login error:', error);
      
//       if (error.message.includes('Invalid email or password')) {
//         return res.status(401).json({
//           success: false,
//           message: error.message
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: 'Login failed',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * OAuth callback
//    */
//   async oauthCallback(req, res) {
//     try {
//       const { provider } = req.params;
//       const providerData = req.body;

//       if (!['google', 'apple'].includes(provider)) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid OAuth provider'
//         });
//       }

//       const result = await this.userService.oauthLogin(provider, providerData);

//       // Set refresh token as HTTP-only cookie
//       res.cookie('refreshToken', result.refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict',
//         maxAge: 7 * 24 * 60 * 60 * 1000
//       });

//       res.json({
//         success: true,
//         message: 'OAuth login successful',
//         data: {
//           user: result.user,
//           accessToken: result.accessToken
//         }
//       });
//     } catch (error) {
//       console.error('OAuth error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'OAuth login failed',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Refresh access token
//    */
//   async refreshToken(req, res) {
//     try {
//       const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

//       if (!refreshToken) {
//         return res.status(400).json({
//           success: false,
//           message: 'Refresh token required'
//         });
//       }

//       const result = await this.userService.refreshToken(refreshToken);

//       res.json({
//         success: true,
//         message: 'Token refreshed successfully',
//         data: result
//       });
//     } catch (error) {
//       console.error('Refresh token error:', error);
      
//       if (error.message === 'Invalid refresh token') {
//         return res.status(401).json({
//           success: false,
//           message: error.message
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: 'Failed to refresh token',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Get user profile
//    */
//   async getProfile(req, res) {
//     try {
//       const userId = req.user.userId;
//       const user = await this.userService.getProfile(userId);

//       res.json({
//         success: true,
//         message: 'Profile retrieved successfully',
//         data: user
//       });
//     } catch (error) {
//       console.error('Get profile error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to retrieve profile',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Update user profile
//    */
//   async updateProfile(req, res) {
//     try {
//       const userId = req.user.userId;
//       const user = await this.userService.updateProfile(userId, req.body);

//       res.json({
//         success: true,
//         message: 'Profile updated successfully',
//         data: user
//       });
//     } catch (error) {
//       console.error('Update profile error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update profile',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Logout user
//    */
//   async logout(req, res) {
//     try {
//       const userId = req.user.userId;
//       await this.userService.logout(userId);

//       // Clear refresh token cookie
//       res.clearCookie('refreshToken');

//       res.json({
//         success: true,
//         message: 'Logout successful'
//       });
//     } catch (error) {
//       console.error('Logout error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Logout failed',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Get current user (for frontend to check auth status)
//    */
//   async getCurrentUser(req, res) {
//     try {
//       if (!req.user) {
//         return res.json({
//           success: true,
//           data: null,
//           message: 'No user logged in'
//         });
//       }

//       const userId = req.user.userId;
//       const user = await this.userService.getProfile(userId);

//       res.json({
//         success: true,
//         data: user,
//         message: 'User retrieved successfully'
//       });
//     } catch (error) {
//       console.error('Get current user error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to get user',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }


//   /**
//    * Get customers (users with 'user' role) - Admin only
//    */
//   async getCustomers(req, res) {
//     try {
//       const page = parseInt(req.query.page) || 1;
//       const limit = parseInt(req.query.limit) || 20;
//       const filters = {};

//       // Add filters from query params
//       if (req.query.isActive !== undefined) {
//         filters.isActive = req.query.isActive === 'true';
//       }
//       if (req.query.search) {
//         filters[Sequelize.Op.or] = [
//           { userName: { [Sequelize.Op.like]: `%${req.query.search}%` } },
//           { email: { [Sequelize.Op.like]: `%${req.query.search}%` } }
//         ];
//       }
//       if (req.query.provider) {
//         filters.provider = req.query.provider;
//       }

//       const result = await this.userService.getCustomers(page, limit, filters);

//       res.json({
//         success: true,
//         message: 'Customers retrieved successfully',
//         data: {
//           customers: result.users,
//           pagination: result.pagination,
//           stats: {
//             totalCustomers: result.pagination.total,
//             role: 'user'
//           }
//         }
//       });
//     } catch (error) {
//       console.error('Get customers error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to retrieve customers',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Get all users with optional role filter - Admin only
//    */
//   async getAllUsers(req, res) {
//     try {
//       const page = parseInt(req.query.page) || 1;
//       const limit = parseInt(req.query.limit) || 20;
//       const role = req.query.role || null; // 'all', 'user', 'admin', 'moderator'
//       const filters = {};

//       // Build filters
//       if (req.query.isActive !== undefined) {
//         filters.isActive = req.query.isActive === 'true';
//       }
//       if (req.query.search) {
//         filters[Sequelize.Op.or] = [
//           { userName: { [Sequelize.Op.like]: `%${req.query.search}%` } },
//           { email: { [Sequelize.Op.like]: `%${req.query.search}%` } }
//         ];
//       }

//       const result = await this.userService.getAllUsersByRole(
//         role === 'all' ? null : role, 
//         page, 
//         limit, 
//         filters
//       );

//       res.json({
//         success: true,
//         message: 'Users retrieved successfully',
//         data: result
//       });
//     } catch (error) {
//       console.error('Get all users error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to retrieve users',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Update user role - Admin only
//    */
//   async updateUserRole(req, res) {
//     try {
//       const { userId } = req.params;
//       const { role } = req.body;

//       if (!role) {
//         return res.status(400).json({
//           success: false,
//           message: 'Role is required'
//         });
//       }

//       // Prevent changing your own role if you're an admin
//       if (parseInt(userId) === req.user.userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Cannot change your own role'
//         });
//       }

//       const updatedUser = await this.userService.updateUserRole(userId, role);

//       res.json({
//         success: true,
//         message: 'User role updated successfully',
//         data: updatedUser
//       });
//     } catch (error) {
//       console.error('Update user role error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to update user role',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Toggle user active status - Admin only
//    */
//   async toggleUserStatus(req, res) {
//     try {
//       const { userId } = req.params;

//       // Prevent toggling your own status
//       if (parseInt(userId) === req.user.userId) {
//         return res.status(403).json({
//           success: false,
//           message: 'Cannot change your own status'
//         });
//       }

//       const result = await this.userService.toggleUserStatus(userId);

//       res.json({
//         success: true,
//         message: result.message,
//         data: {
//           userId: result.userId,
//           isActive: result.isActive
//         }
//       });
//     } catch (error) {
//       console.error('Toggle user status error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to toggle user status',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Bulk update user roles - Admin only
//    */
//   async bulkUpdateRoles(req, res) {
//     try {
//       const { userIds, role } = req.body;

//       if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'User IDs array is required'
//         });
//       }

//       if (!role) {
//         return res.status(400).json({
//           success: false,
//           message: 'Role is required'
//         });
//       }

//       // Remove current user from bulk update if present
//       const filteredUserIds = userIds.filter(id => parseInt(id) !== req.user.userId);

//       const result = await this.userService.bulkUpdateRoles(filteredUserIds, role);

//       res.json({
//         success: true,
//         message: result.message,
//         data: result
//       });
//     } catch (error) {
//       console.error('Bulk update roles error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to bulk update roles',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }

//   /**
//    * Get user statistics by role - Admin only
//    */
//   async getUserStats(req, res) {
//     try {
//       const stats = await this.userService.getUserStats();

//       res.json({
//         success: true,
//         message: 'User statistics retrieved successfully',
//         data: stats
//       });
//     } catch (error) {
//       console.error('Get user stats error:', error);
//       res.status(500).json({
//         success: false,
//         message: 'Failed to retrieve user statistics',
//         error: process.env.NODE_ENV === 'development' ? error.message : undefined
//       });
//     }
//   }
// }

// module.exports = UserController; 

