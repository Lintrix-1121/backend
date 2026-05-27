// routes/auth.routes.js
const express = require('express');
const authMiddleware = require('../controllers/auth.middleware');

module.exports = (authController) => {
  const router = express.Router();

  // Public routes - NO AUTHENTICATION REQUIRED
  router.post('/register', (req, res) => authController.register(req, res));
  router.post('/login', (req, res) => authController.login(req, res)); // This should be public!
  router.post('/oauth/:provider', (req, res) => authController.oauthCallback(req, res));
  router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));
  router.post('/request-password-reset', (req, res) => authController.requestPasswordReset(req, res));
  router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
  router.get('/verify-email/:token', (req, res) => authController.verifyEmail(req, res));

  // Protected routes - AUTHENTICATION REQUIRED
  router.get('/me', 
    authMiddleware.authenticate, 
    (req, res) => authController.getCurrentUser(req, res)
  );

  router.get('/profile', 
    authMiddleware.authenticate, 
    (req, res) => authController.getProfile(req, res)
  );

  router.put('/profile', 
    authMiddleware.authenticate, 
    (req, res) => authController.updateProfile(req, res)
  );

  router.post('/change-password', 
    authMiddleware.authenticate, 
    (req, res) => authController.changePassword(req, res)
  );

  router.post('/logout', 
    authMiddleware.authenticate, 
    (req, res) => authController.logout(req, res)
  );

  return router;
};











// // controllers/UserController.js
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
// }

// module.exports = UserController;


