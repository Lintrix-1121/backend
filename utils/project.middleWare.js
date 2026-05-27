const { Project } = require('../models');

const projectMiddleware = {
  // Check if user can modify project
  async canModifyProject(req, res, next) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Check permissions
      const isAdmin = req.user.role === 'admin';
      const isProjectManager = req.user.role === 'project_manager';
      const isCreator = project.createdBy === req.user.userId;
      const isAssignedManager = project.projectManager === req.user.userId;

      if (isAdmin || isProjectManager || isCreator || isAssignedManager) {
        req.project = project;
        next();
      } else {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this project'
        });
      }
    } catch (error) {
      console.error('Project middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        error: error.message
      });
    }
  },

  // Validate project data
  validateProjectData(req, res, next) {
    const { category, status, priority } = req.body;

    const validCategories = [
      'IoT', 'Electronics', 'Mobile apps', 'Web apps', 'Installations',
      'Networking', 'Embedded Systems', 'Software Development', 'ICT Infrastructure',
      'Security Systems', 'Cloud Computing', 'AI/ML', 'Blockchain', 'Robotics',
      'Telecommunications', 'Data Center', 'IT Consulting', 'Hardware Design',
      'Firmware Development', 'System Integration'
    ];

    const validStatuses = ['planned', 'in-progress', 'completed', 'on-hold', 'cancelled', 'maintenance'];
    const validPriorities = ['low', 'medium', 'high', 'critical'];

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority'
      });
    }

    next();
  },

  // Rate limiting for project views
  projectViewLimiter: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};

module.exports = projectMiddleware;