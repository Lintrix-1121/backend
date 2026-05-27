const express = require('express');
const { body, param, query } = require('express-validator');

const createProjectRoutes = (projectController, authMiddleware) => {
  console.log('🛣️ Creating project routes...');
  
  const publicRouter = express.Router();
  const protectedRouter = express.Router();

  // ============= PUBLIC ROUTES =============
  
  // Health check
  publicRouter.get('/health', projectController.healthCheck.bind(projectController));

  // Get all projects with filters
  publicRouter.get('/', projectController.getAllProjects.bind(projectController));

  // Get project statistics
  publicRouter.get('/stats', projectController.getProjectStats.bind(projectController));

  // Get featured projects
  publicRouter.get('/featured', projectController.getFeaturedProjects.bind(projectController));

  // Get projects by category
  publicRouter.get('/category/:category', 
    [
      param('category').notEmpty().withMessage('Category is required')
    ],
    projectController.getProjectsByCategory.bind(projectController)
  );

  // Get projects by technology
  publicRouter.get('/technology/:technology',
    [
      param('technology').notEmpty().withMessage('Technology is required')
    ],
    projectController.getProjectsByTechnology.bind(projectController)
  );

  // Search projects
  publicRouter.get('/search',
    [
      query('q').notEmpty().withMessage('Search query is required')
    ],
    projectController.searchProjects.bind(projectController)
  );

  // Get single project by ID or slug
  publicRouter.get('/:identifier',
    projectController.getProject.bind(projectController)
  );

  // Get related projects
  publicRouter.get('/:id/related',
    [
      param('id').isInt().withMessage('Valid project ID is required')
    ],
    projectController.getRelatedProjects.bind(projectController)
  );

  // Get project timeline
  publicRouter.get('/:id/timeline',
    [
      param('id').isInt().withMessage('Valid project ID is required')
    ],
    projectController.getProjectTimeline.bind(projectController)
  );

  // ============= PROTECTED ROUTES (Require Authentication) =============
  protectedRouter.use(authMiddleware.authenticate);

  // Create project
  protectedRouter.post('/',
    projectController.upload,
    [
      body('title').notEmpty().withMessage('Title is required'),
      body('category').notEmpty().withMessage('Category is required'),
      body('fullDescription').notEmpty().withMessage('Description is required'),
      body('createdBy').isInt().withMessage('Valid creator ID is required')
    ],
    projectController.createProject.bind(projectController)
  );

  // Update project
  protectedRouter.put('/:id',
    projectController.upload,
    [
      param('id').isInt().withMessage('Valid project ID is required')
    ],
    projectController.updateProject.bind(projectController)
  );

  // Delete project
  protectedRouter.delete('/:id',
    [
      param('id').isInt().withMessage('Valid project ID is required')
    ],
    projectController.deleteProject.bind(projectController)
  );

  // Upload project media
  protectedRouter.post('/:projectId/media',
    projectController.upload,
    [
      param('projectId').isInt().withMessage('Valid project ID is required')
    ],
    projectController.uploadProjectMedia.bind(projectController)
  );

  // Delete project media
  protectedRouter.delete('/media/:mediaId',
    [
      param('mediaId').isInt().withMessage('Valid media ID is required')
    ],
    projectController.deleteProjectMedia.bind(projectController)
  );

  // Clone project
  protectedRouter.post('/:id/clone',
    [
      param('id').isInt().withMessage('Valid project ID is required'),
      body('createdBy').isInt().withMessage('Creator ID is required')
    ],
    projectController.cloneProject.bind(projectController)
  );

  // Export project
  protectedRouter.get('/:id/export',
    [
      param('id').isInt().withMessage('Valid project ID is required')
    ],
    projectController.exportProject.bind(projectController)
  );

  console.log('✅ Project routes created');
  
  return {
    public: publicRouter,
    protected: protectedRouter
  };
};

module.exports = createProjectRoutes;

