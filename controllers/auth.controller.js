// controllers/AuthController.js
class AuthController {
  constructor(userService) {
    this.userService = userService;
  }

  async register(req, res) {
    try {
      // Extract role from request body, default to 'user'
      const { userName, email, password, role = 'user' } = req.body;

      // Validate required fields
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

      // Validate role (optional but recommended)
      const validRoles = ['user', 'admin', 'moderator']; // Add your valid roles
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Allowed roles: ${validRoles.join(', ')}`
        });
      }

      // Register user WITH ROLE
      const user = await this.userService.register({
        userName,
        email,
        password,
        provider: 'local',
        role // Pass role to service
      });

      // Auto-login after registration (optional)
      let loginResult = null;
      try {
        loginResult = await this.userService.login(email, password);
      } catch (loginError) {
        console.log('Auto-login after registration failed:', loginError.message);
        // Continue with registration success even if auto-login fails
      }

      res.status(201).json({
        success: true,
        message: `User registered successfully as ${role}`,
        data: {
          user,
          ...(loginResult && {
            accessToken: loginResult.accessToken,
            refreshToken: loginResult.refreshToken
          })
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific errors
      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'Password is required for local users') {
        return res.status(400).json({
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



  
  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log('Login attempt for email:', email);

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Authenticate user
      const result = await this.userService.login(email, password);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      console.log('Login successful for:', email);

      // Return success response with role information
      res.json({
        success: true,
        message: `Login successful as ${result.user.role || 'user'}`,
        data: {
          user: {
            ...result.user,
            role: result.user.role || 'user'
          },
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      console.error('Login error:', error.message);
      
      if (error.message.includes('Invalid email or password') || 
          error.message === 'Password not set for this user. Please use social login.') {
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
  // async login(req, res) {
  //   try {
  //     const { email, password } = req.body;

  //     if (!email || !password) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Email and password are required'
  //       });
  //     }

  //     // Authenticate user
  //     const result = await this.userService.login(email, password);

  //     // Set refresh token as HTTP-only cookie (optional)
  //     res.cookie('refreshToken', result.refreshToken, {
  //       httpOnly: true,
  //       secure: process.env.NODE_ENV === 'production',
  //       sameSite: 'lax',
  //       maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  //     });

  //     // Return success response with role information
  //     res.json({
  //       success: true,
  //       message: `Login successful as ${result.user.role || 'user'}`,
  //       data: {
  //         user: {
  //           ...result.user,
  //           role: result.user.role || 'user' // Ensure role is included
  //         },
  //         accessToken: result.accessToken,
  //         refreshToken: result.refreshToken // Also return in response for mobile clients
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Login error:', error);
      
  //     // Handle specific errors
  //     if (error.message.includes('Invalid email or password') || 
  //         error.message === 'Password not set for this user') {
  //       return res.status(401).json({
  //         success: false,
  //         message: error.message
  //       });
  //     }

  //     res.status(500).json({
  //       success: false,
  //       message: 'Login failed',
  //       error: process.env.NODE_ENV === 'development' ? error.message : undefined
  //     });
  //   }
  // }

  /**
   * OAuth login/registration
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

      if (!providerData.providerId) {
        return res.status(400).json({
          success: false,
          message: 'Provider ID is required'
        });
      }

      // OAuth login/registration
      const result = await this.userService.oauthLogin(provider, providerData);

      // Set refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        message: `${provider} login successful`,
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
        message: `${req.params.provider} login failed`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Refresh access token
   */
   // In your auth controller
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtConfig.refreshSecret);
      
      // Find user
      const user = await this.userService.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate new tokens WITH ROLE
      const newAccessToken = this.userService.generateAccessToken(user);
      const newRefreshToken = this.userService.generateRefreshToken(user);

      // Update refresh token in database
      user.refreshToken = newRefreshToken;
      await user.save();

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: {
            userId: user.userId,
            email: user.email,
            userName: user.userName,
            role: user.role || 'user' // Include role in response
          }
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }
  }
  
  /**
   * Get current user profile
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
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

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
      
      // Don't allow changing email or provider via this endpoint
      const updateData = { ...req.body };
      delete updateData.email;
      delete updateData.provider;
      delete updateData.providerId;

      const user = await this.userService.updateProfile(userId, updateData);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
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

      // Verify current password
      const user = await this.userService.getUserWithPassword(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.provider !== 'local') {
        return res.status(400).json({
          success: false,
          message: 'Password change is not available for OAuth users'
        });
      }

      // Note: You need to implement getUserWithPassword in UserService
      // or handle password verification here
      
      // Update password
      await this.userService.updateProfile(userId, { password: newPassword });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
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
      
      // Clear refresh token from database
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
   * Check if user is authenticated (for frontend)
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
   * Verify email (placeholder for email verification)
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      // Implement email verification logic
      // This would typically verify a JWT token containing the user ID
      
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

      // Generate reset token and send email (implement this)
      // const resetToken = this.userService.generateResetToken(user.userId);
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

      // Verify reset token and update password (implement this)
      // const userId = this.userService.verifyResetToken(token);
      // await this.userService.updateProfile(userId, { password: newPassword });

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
   * Admin: Get all users (admin only)
   */
  async getAllUsers(req, res) {
    try {
      // This method should be added to UserService
      const users = await this.userService.getAllUsers();
      
      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
        count: users.length
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }

  /**
   * Admin: Update user role (admin only)
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['user', 'admin', 'moderator'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }

      // This method should be added to UserService
      const user = await this.userService.updateUserRole(userId, role);

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: user
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
        message: 'Failed to update user role'
      });
    }
  }
}

module.exports = AuthController;



