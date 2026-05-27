// middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = {
  // Main authentication - requires valid token
  authenticate: (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.userId = decoded.userId; // Add userId directly to req
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  },

  // Role-based authorization - Checks if user has required roles
  authorize: (roles = []) => {
    return (req, res, next) => {
      // First, ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // If roles array is empty, just check authentication (any authenticated user)
      if (roles.length === 0) {
        return next();
      }

      // Check if user role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: roles,
          userRole: req.user.role
        });
      }

      // User has required role, proceed
      next();
    };
  },

  // Universal cart authentication - Handles both users and guests
  authenticateCart: (req, res, next) => {
    try {
      console.log('=== Cart Auth Middleware ===');
      
      // 1. Try to authenticate via JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token && token !== 'null' && token !== 'undefined') {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.userId = decoded.userId;
            req.isAuthenticated = true;
            console.log('User authenticated via JWT:', decoded.userId);
          } catch (error) {
            console.log('JWT invalid, proceeding as guest');
          }
        }
      }
      
      // 2. Extract user ID from headers (for API clients or system users)
      if (!req.userId && req.headers['x-user-id']) {
        req.userId = req.headers['x-user-id'];
        req.isAuthenticated = true;
        console.log('User ID from headers:', req.userId);
      }
      
      // 3. Extract session ID for guest users
      req.sessionId = req.headers['x-session-id'] || req.query.sessionId;
      console.log('Session ID:', req.sessionId);
      
      // 4. Store auth status
      req.authType = req.userId ? 'user' : (req.sessionId ? 'guest' : 'none');
      console.log('Auth type:', req.authType);
      
      // 5. For cart operations, we allow both authenticated and guest users
      // Always proceed to the controller, even if no authentication
      next();
      
    } catch (error) {
      console.error('Cart auth middleware error:', error);
      // Still proceed to controller for cart operations
      next();
    }
  },

  // Optional authentication with user/session extraction
  optionalAuth: (req, res, next) => {
    try {
      // Try to get user from JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token && token !== 'null' && token !== 'undefined') {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.userId = decoded.userId;
            req.isAuthenticated = true;
          } catch (error) {
            // Token invalid, continue as guest
          }
        }
      }
      
      // Always extract session ID if present
      req.sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
      next();
    } catch (error) {
      // Continue even on error
      next();
    }
  },

  // Admin only middleware (convenience method - kept for backward compatibility)
  isAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
  },

  // Role-specific middleware factories (convenience methods)
  isModerator: (req, res, next) => {
    if (req.user && (req.user.role === 'moderator' || req.user.role === 'admin')) {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: 'Moderator or admin access required'
      });
    }
  },

  // Check if user has role (single role)
  hasRole: (role) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (req.user.role !== role) {
        return res.status(403).json({
          success: false,
          message: `Role '${role}' required`
        });
      }

      next();
    };
  },

  // Check if user has any of the specified roles (multiple roles)
  hasAnyRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Required roles: ${roles.join(', ')}`
        });
      }

      next();
    };
  },

  // Check if user has all specified roles (for multiple role requirements)
  hasAllRoles: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // This assumes users have only one role (which is typical)
      // If you need multiple roles per user, you'd need to modify the User model
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `User must have all roles: ${roles.join(', ')}`
        });
      }

      next();
    };
  },

  // Self or admin check (users can access their own data, admins can access all)
  selfOrAdmin: (paramIdField = 'userId') => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const targetUserId = parseInt(req.params[paramIdField]);
      const currentUserId = req.user.userId;

      // Allow if user is admin OR accessing their own data
      if (req.user.role === 'admin' || targetUserId === currentUserId) {
        return next();
      }

      res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own data.'
      });
    };
  },

  // Self, moderator, or admin check
  selfOrModeratorOrAdmin: (paramIdField = 'userId') => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const targetUserId = parseInt(req.params[paramIdField]);
      const currentUserId = req.user.userId;

      // Allow if user is admin, moderator, or accessing their own data
      if (req.user.role === 'admin' || 
          req.user.role === 'moderator' || 
          targetUserId === currentUserId) {
        return next();
      }

      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    };
  }
};

module.exports = authMiddleware;



// // middleware/auth.js
// const jwt = require('jsonwebtoken');

// const authMiddleware = {
//   // Main authentication - requires valid token
//   authenticate: (req, res, next) => {
//     try {
//       // Get token from Authorization header
//       const authHeader = req.headers.authorization;
      
//       if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return res.status(401).json({
//           success: false,
//           message: 'Access token required'
//         });
//       }

//       const token = authHeader.split(' ')[1];
      
//       if (!token) {
//         return res.status(401).json({
//           success: false,
//           message: 'Access token required'
//         });
//       }

//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       req.user = decoded;
//       req.userId = decoded.userId; // Add userId directly to req
//       next();
//     } catch (error) {
//       if (error.name === 'TokenExpiredError') {
//         return res.status(401).json({
//           success: false,
//           message: 'Token expired'
//         });
//       }
      
//       if (error.name === 'JsonWebTokenError') {
//         return res.status(401).json({
//           success: false,
//           message: 'Invalid token'
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: 'Authentication failed'
//       });
//     }
//   },

//   // **NEW: Authorize middleware** - Checks if user has required roles
//   authorize: (roles = []) => {
//     return (req, res, next) => {
//       // First, ensure user is authenticated
//       if (!req.user) {
//         return res.status(401).json({
//           success: false,
//           message: 'Authentication required'
//         });
//       }

//       // Check if user role is in the allowed roles
//       if (roles.length && !roles.includes(req.user.role)) {
//         return res.status(403).json({
//           success: false,
//           message: 'Insufficient permissions. Required roles: ' + roles.join(', ')
//         });
//       }

//       // User has required role, proceed
//       next();
//     };
//   },

//   // Universal cart authentication - Handles both users and guests
//   authenticateCart: (req, res, next) => {
//     try {
//       console.log('=== Cart Auth Middleware ===');
      
//       // 1. Try to authenticate via JWT token
//       const authHeader = req.headers.authorization;
//       if (authHeader && authHeader.startsWith('Bearer ')) {
//         const token = authHeader.split(' ')[1];
//         if (token && token !== 'null' && token !== 'undefined') {
//           try {
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);
//             req.user = decoded;
//             req.userId = decoded.userId;
//             req.isAuthenticated = true;
//             console.log('User authenticated via JWT:', decoded.userId);
//           } catch (error) {
//             console.log('JWT invalid, proceeding as guest');
//           }
//         }
//       }
      
//       // 2. Extract user ID from headers (for API clients or system users)
//       if (!req.userId && req.headers['x-user-id']) {
//         req.userId = req.headers['x-user-id'];
//         req.isAuthenticated = true;
//         console.log('User ID from headers:', req.userId);
//       }
      
//       // 3. Extract session ID for guest users
//       req.sessionId = req.headers['x-session-id'] || req.query.sessionId;
//       console.log('Session ID:', req.sessionId);
      
//       // 4. Store auth status
//       req.authType = req.userId ? 'user' : (req.sessionId ? 'guest' : 'none');
//       console.log('Auth type:', req.authType);
      
//       // 5. For cart operations, we allow both authenticated and guest users
//       // Always proceed to the controller, even if no authentication
//       next();
      
//     } catch (error) {
//       console.error('Cart auth middleware error:', error);
//       // Still proceed to controller for cart operations
//       next();
//     }
//   },

//   // Optional authentication with user/session extraction
//   optionalAuth: (req, res, next) => {
//     try {
//       // Try to get user from JWT token
//       const authHeader = req.headers.authorization;
//       if (authHeader && authHeader.startsWith('Bearer ')) {
//         const token = authHeader.split(' ')[1];
//         if (token && token !== 'null' && token !== 'undefined') {
//           try {
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);
//             req.user = decoded;
//             req.userId = decoded.userId;
//             req.isAuthenticated = true;
//           } catch (error) {
//             // Token invalid, continue as guest
//           }
//         }
//       }
      
//       // Always extract session ID if present
//       req.sessionId = req.headers['x-session-id'] || req.query.sessionId;
      
//       next();
//     } catch (error) {
//       // Continue even on error
//       next();
//     }
//   },

//   // Admin only middleware (convenience method)
//   isAdmin: (req, res, next) => {
//     if (req.user && req.user.role === 'admin') {
//       next();
//     } else {
//       res.status(403).json({
//         success: false,
//         message: 'Admin access required'
//       });
//     }
//   },

//   // **NEW: Role-based middleware factory** (alternative to authorize)
//   hasRole: (role) => {
//     return (req, res, next) => {
//       if (!req.user) {
//         return res.status(401).json({
//           success: false,
//           message: 'Authentication required'
//         });
//       }

//       if (req.user.role !== role) {
//         return res.status(403).json({
//           success: false,
//           message: `Role '${role}' required`
//         });
//       }

//       next();
//     };
//   },

//   // **NEW: Check if user has any of the specified roles**
//   hasAnyRole: (roles) => {
//     return (req, res, next) => {
//       if (!req.user) {
//         return res.status(401).json({
//           success: false,
//           message: 'Authentication required'
//         });
//       }

//       if (!roles.includes(req.user.role)) {
//         return res.status(403).json({
//           success: false,
//           message: `One of these roles required: ${roles.join(', ')}`
//         });
//       }

//       next();
//     };
//   }
// };

// module.exports = authMiddleware;


