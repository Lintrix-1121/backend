const express = require('express');

module.exports = (careerController, authMiddleware) => {
  console.log('📋 Setting up career routes');
  
  // Create separate routers
  const publicRouter = express.Router();
  const protectedRouter = express.Router();
  
  //PUBLIC ROUTES 
  publicRouter.get('/health', careerController.healthCheck);
  publicRouter.get('/jobs', careerController.getAllJobs);
  publicRouter.get('/jobs/:idOrSlug', careerController.getJob);
  publicRouter.get('/stats', careerController.getCareerStats);
  publicRouter.post('/apply/idOrSlug', 
    careerController.resumeUpload,
    careerController.applyForJob
  );
  
  //PROTECTED ROUTES
  if (authMiddleware && authMiddleware.authenticate) {
    // Apply auth middleware to all protected routes
    protectedRouter.use(authMiddleware.authenticate);
    
    protectedRouter.get('/applications/my', careerController.getMyApplications);
    
    // Admin routes (require admin role)
    protectedRouter.post('/jobs', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.createJob
    );
    
    protectedRouter.put('/jobs/:id', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.updateJob
    );
    
    protectedRouter.delete('/jobs/:id', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.deleteJob
    );
    
    protectedRouter.get('/applications', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.getAllApplications
    );
    
    protectedRouter.get('/applications/:id', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.getApplication
    );
    
    protectedRouter.put('/applications/:id/status', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.updateApplicationStatus
    );
    
    protectedRouter.get('/jobs/:jobId/applications', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.getApplicationsByJob
    );
    
    protectedRouter.get('/dashboard', 
      authMiddleware.authorize(['admin', 'moderator']),
      careerController.getDashboardData
    );
  }
  
  // Return an object with both routers
  return {
    public: publicRouter,
    protected: protectedRouter
  };
};

