const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

class ProjectController {
  constructor(models, projectService) {
    console.log('🔧 ProjectController constructor called');
    
    if (!models) {
      console.error('❌ Models is undefined in ProjectController constructor');
      throw new Error('Models are required for ProjectController');
    }
    
    if (!projectService) {
      console.error('❌ ProjectService is undefined in ProjectController constructor');
      throw new Error('ProjectService is required for ProjectController');
    }

    console.log('📦 Models available:', Object.keys(models));
    console.log('📦 ProjectService type:', typeof projectService);
    
    this.models = models;
    this.projectService = projectService;
    this.Project = models.Project;
    this.ProjectMedia = models.ProjectMedia;
    this.User = models.User;

    // Create upload middleware
    this.upload = this.createUploadMiddleware();
  }

  createUploadMiddleware() {
    const projectUploadDirs = {
      images: 'uploads/projects/images',
      videos: 'uploads/projects/videos',
      documents: 'uploads/projects/documents'
    };

    // Create directories if they don't exist
    Object.values(projectUploadDirs).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });

    return multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          // Determine destination based on file type
          if (file.mimetype.startsWith('image/')) {
            cb(null, projectUploadDirs.images);
          } else if (file.mimetype.startsWith('video/')) {
            cb(null, projectUploadDirs.videos);
          } else {
            cb(null, projectUploadDirs.documents);
          }
        },
        filename: (req, file, cb) => {
          const uniqueName = `project-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        }
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB for videos
        files: 20 // Max 20 files
      },
      fileFilter: (req, file, cb) => {
        const allowedImageTypes = /jpeg|jpg|png|gif|webp|svg/i;
        const allowedVideoTypes = /mp4|mpeg|quicktime|webm/i;
        const allowedDocTypes = /pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document/i;
        
        const extname = path.extname(file.originalname).toLowerCase();
        const mimetype = file.mimetype.toLowerCase();
        
        if (file.mimetype.startsWith('image/') && 
            (allowedImageTypes.test(extname) || allowedImageTypes.test(mimetype))) {
          cb(null, true);
        } else if (file.mimetype.startsWith('video/') && 
                  (allowedVideoTypes.test(extname) || allowedVideoTypes.test(mimetype))) {
          cb(null, true);
        } else if (allowedDocTypes.test(extname) || allowedDocTypes.test(mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
        }
      }
    }).array('media', 20);
  }

  // ============= CREATE PROJECT =============
  createProject = async (req, res) => {
    console.log('📝 [CONTROLLER] Create project request received');
    
    try {
      console.log('📦 [CONTROLLER] Request body:', req.body);
      console.log('📦 [CONTROLLER] Body fields:', Object.keys(req.body));
      console.log('📦 [CONTROLLER] Uploaded files:', req.files?.length || 0);

      // Validate required fields
      if (!req.body.title || req.body.title.trim() === '') {
        console.error('❌ [CONTROLLER] Title validation failed');
        return res.status(400).json({
          success: false,
          message: 'Project title is required',
          error: 'Title cannot be empty'
        });
      }

      if (!req.body.category) {
        console.error('❌ [CONTROLLER] Category validation failed');
        return res.status(400).json({
          success: false,
          message: 'Project category is required',
          error: 'Category cannot be empty'
        });
      }

      if (!req.body.fullDescription || req.body.fullDescription.trim() === '') {
        console.error('❌ [CONTROLLER] Description validation failed');
        return res.status(400).json({
          success: false,
          message: 'Project description is required',
          error: 'Description cannot be empty'
        });
      }

      if (!req.body.createdBy) {
        console.error('❌ [CONTROLLER] CreatedBy validation failed');
        return res.status(400).json({
          success: false,
          message: 'Creator ID is required',
          error: 'createdBy is required'
        });
      }

      // Generate slug if not provided
      let slug = req.body.slug;
      if (!slug || slug.trim() === '') {
        slug = req.body.title.toLowerCase()
          .replace(/[^\w\s-]/gi, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }

      // Parse JSON fields if they come as strings
      const projectData = {
        title: req.body.title.trim(),
        slug: slug.trim(),
        clientName: req.body.clientName || null,
        clientIndustry: req.body.clientIndustry || null,
        category: req.body.category,
        subCategory: req.body.subCategory || null,
        shortDescription: req.body.shortDescription || null,
        fullDescription: req.body.fullDescription.trim(),
        challenge: req.body.challenge || null,
        solution: req.body.solution || null,
        results: req.body.results || null,
        technologies: this.parseJSONField(req.body.technologies, []),
        teamSize: req.body.teamSize ? parseInt(req.body.teamSize) : null,
        projectDuration: req.body.projectDuration || null,
        startDate: req.body.startDate || null,
        endDate: req.body.endDate || null,
        projectUrl: req.body.projectUrl || null,
        githubUrl: req.body.githubUrl || null,
        demoUrl: req.body.demoUrl || null,
        clientTestimonial: req.body.clientTestimonial || null,
        testimonialAuthor: req.body.testimonialAuthor || null,
        testimonialPosition: req.body.testimonialPosition || null,
        projectManager: req.body.projectManager ? parseInt(req.body.projectManager) : null,
        teamMembers: this.parseJSONField(req.body.teamMembers, []),
        stakeholders: this.parseJSONField(req.body.stakeholders, []),
        budget: req.body.budget ? parseFloat(req.body.budget) : null,
        currency: req.body.currency || 'USD',
        roi: req.body.roi || null,
        kpis: this.parseJSONField(req.body.kpis, {}),
        isConfidential: req.body.isConfidential === 'true' || req.body.isConfidential === true,
        confidentialityNotice: req.body.confidentialityNotice || null,
        status: req.body.status || 'planned',
        completionPercentage: req.body.completionPercentage ? parseInt(req.body.completionPercentage) : 0,
        milestones: this.parseJSONField(req.body.milestones, []),
        priority: req.body.priority || 'medium',
        isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true,
        isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
        publishedAt: req.body.isPublished === 'true' ? new Date() : null,
        tags: this.parseJSONField(req.body.tags, []),
        location: req.body.location || null,
        country: req.body.country || null,
        notes: req.body.notes || null,
        createdBy: parseInt(req.body.createdBy),
        metaTitle: req.body.metaTitle || null,
        metaDescription: req.body.metaDescription || null,
        metaKeywords: req.body.metaKeywords || null
      };

      console.log('🔧 [CONTROLLER] Processed data ready for service');

      const project = await this.projectService.createProject(
        projectData,
        req.files
      );

      console.log('✅ [CONTROLLER] Project created successfully with ID:', project.projectId);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });

    } catch (error) {
      console.error('❌ [CONTROLLER] Error creating project:', error.message);
      console.error('Error stack:', error.stack);

      // Clean up uploaded files
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.path) {
            fs.unlink(file.path, () => {});
          }
        });
      }

      if (error.message.includes('Validation error') || error.message.includes('unique constraint')) {
        return res.status(400).json({
          success: false,
          message: 'Project creation failed',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error creating project',
        error: error.message
      });
    }
  };

  // ============= GET ALL PROJECTS =============
  getAllProjects = async (req, res) => {
    try {
      console.log('📋 [CONTROLLER] Get all projects request received');
      
      const {
        page = 1,
        limit = 10,
        category,
        status,
        featured,
        published,
        client,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        minBudget,
        maxBudget,
        priority,
        technology
      } = req.query;

      console.log('🔍 Query params:', {
        page, limit, category, status, featured, published, client,
        search, sortBy, sortOrder, minBudget, maxBudget, priority, technology
      });

      // Build filter options
      const options = {
        filters: {
          category: category || null,
          status: status || null,
          isFeatured: featured ? (featured === 'true') : null,
          isPublished: published ? (published === 'true') : null,
          clientName: client || null,
          priority: priority || null,
          technology: technology || null,
          minBudget: minBudget ? parseFloat(minBudget) : null,
          maxBudget: maxBudget ? parseFloat(maxBudget) : null
        },
        pagination: {
          limit: limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 10,
          offset: ((parseInt(page) - 1) * parseInt(limit)) || 0
        },
        sort: {
          by: sortBy,
          order: sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
        },
        search: search ? search.trim() : null
      };

      const result = await this.projectService.getAllProjects(options);

      console.log(`✅ Found ${result.count} projects (showing ${result.data.length})`);

      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(result.count / options.pagination.limit),
        data: result.data
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching projects:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching projects',
        error: error.message
      });
    }
  };

  // ============= GET SINGLE PROJECT =============
  getProject = async (req, res) => {
    try {
      const { identifier } = req.params;
      const { includeMedia = 'true', incrementViews = 'true' } = req.query;

      console.log('🔍 [CONTROLLER] Get project request:', { identifier, includeMedia, incrementViews });

      if (!identifier) {
        console.warn('⚠️ Invalid project identifier');
        return res.status(400).json({
          success: false,
          message: 'Project identifier is required'
        });
      }

      const project = await this.projectService.getProjectByIdentifier(
        identifier,
        includeMedia === 'true',
        incrementViews === 'true'
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      console.log(`✅ Project found: ${project.title}`);

      res.status(200).json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching project:', error.message);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error fetching project',
        error: error.message
      });
    }
  };

  // ============= UPDATE PROJECT =============
  updateProject = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('✏️ [CONTROLLER] Update project request:', id);

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      // Parse JSON fields
      const projectData = {
        title: req.body.title,
        clientName: req.body.clientName,
        clientIndustry: req.body.clientIndustry,
        category: req.body.category,
        subCategory: req.body.subCategory,
        shortDescription: req.body.shortDescription,
        fullDescription: req.body.fullDescription,
        challenge: req.body.challenge,
        solution: req.body.solution,
        results: req.body.results,
        technologies: this.parseJSONField(req.body.technologies),
        teamSize: req.body.teamSize ? parseInt(req.body.teamSize) : null,
        projectDuration: req.body.projectDuration,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        projectUrl: req.body.projectUrl,
        githubUrl: req.body.githubUrl,
        demoUrl: req.body.demoUrl,
        clientTestimonial: req.body.clientTestimonial,
        testimonialAuthor: req.body.testimonialAuthor,
        testimonialPosition: req.body.testimonialPosition,
        projectManager: req.body.projectManager ? parseInt(req.body.projectManager) : null,
        teamMembers: this.parseJSONField(req.body.teamMembers),
        stakeholders: this.parseJSONField(req.body.stakeholders),
        budget: req.body.budget ? parseFloat(req.body.budget) : null,
        currency: req.body.currency,
        roi: req.body.roi,
        kpis: this.parseJSONField(req.body.kpis),
        isConfidential: req.body.isConfidential === 'true' || req.body.isConfidential === true,
        confidentialityNotice: req.body.confidentialityNotice,
        status: req.body.status,
        completionPercentage: req.body.completionPercentage ? parseInt(req.body.completionPercentage) : null,
        milestones: this.parseJSONField(req.body.milestones),
        priority: req.body.priority,
        isFeatured: req.body.isFeatured === 'true' || req.body.isFeatured === true,
        isPublished: req.body.isPublished === 'true' || req.body.isPublished === true,
        tags: this.parseJSONField(req.body.tags),
        location: req.body.location,
        country: req.body.country,
        notes: req.body.notes,
        updatedBy: req.body.updatedBy ? parseInt(req.body.updatedBy) : null,
        metaTitle: req.body.metaTitle,
        metaDescription: req.body.metaDescription,
        metaKeywords: req.body.metaKeywords
      };

      // Handle status changes
      if (projectData.status === 'published' && !projectData.publishedAt) {
        projectData.publishedAt = new Date();
        projectData.isPublished = true;
      } else if (projectData.status === 'draft' || projectData.status === 'planned') {
        projectData.isPublished = false;
      }

      // Remove undefined fields
      Object.keys(projectData).forEach(key => 
        projectData[key] === undefined && delete projectData[key]
      );

      console.log('📦 [CONTROLLER] Update data prepared');

      const project = await this.projectService.updateProject(
        parseInt(id),
        projectData,
        req.files
      );

      console.log(`✅ Project updated: ${id}`);

      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error updating project:', error.message);

      // Clean up uploaded files on error
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.path) {
            fs.unlink(file.path, () => {});
          }
        });
      }

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (error.message.includes('Validation error') || error.message.includes('Sequelize')) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating project',
        error: error.message
      });
    }
  };

  // ============= DELETE PROJECT =============
  deleteProject = async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent = 'false' } = req.query;
      
      console.log('🗑️ [CONTROLLER] Delete project request:', { id, permanent });

      if (!id || isNaN(parseInt(id))) {
        console.warn('⚠️ Invalid project ID for deletion:', id);
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      const result = await this.projectService.deleteProject(
        parseInt(id),
        permanent === 'true'
      );

      console.log(`✅ Project deleted: ${id}`);

      res.status(200).json({
        success: true,
        message: result.message || 'Project deleted successfully'
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error deleting project:', error.message);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting project',
        error: error.message
      });
    }
  };

  // ============= UPLOAD PROJECT MEDIA =============
  uploadProjectMedia = async (req, res) => {
    try {
      const { projectId } = req.params;
      const { mediaType, title, description, altText, isFeatured, sortOrder } = req.body;

      console.log('📸 [CONTROLLER] Upload media request:', { projectId, files: req.files?.length });

      if (!projectId || isNaN(parseInt(projectId))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const mediaData = {
        projectId: parseInt(projectId),
        mediaType,
        title,
        description,
        altText,
        isFeatured: isFeatured === 'true' || isFeatured === true,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
        uploadedBy: req.body.uploadedBy ? parseInt(req.body.uploadedBy) : null
      };

      const mediaFiles = await this.projectService.uploadProjectMedia(
        mediaData,
        req.files
      );

      console.log(`✅ Uploaded ${mediaFiles.length} media files for project ${projectId}`);

      res.status(201).json({
        success: true,
        message: 'Media uploaded successfully',
        data: mediaFiles
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error uploading media:', error.message);

      // Clean up uploaded files on error
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.path) {
            fs.unlink(file.path, () => {});
          }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error uploading media',
        error: error.message
      });
    }
  };

  // ============= DELETE PROJECT MEDIA =============
  deleteProjectMedia = async (req, res) => {
    try {
      const { mediaId } = req.params;

      console.log('🗑️ [CONTROLLER] Delete media request:', mediaId);

      if (!mediaId || isNaN(parseInt(mediaId))) {
        return res.status(400).json({
          success: false,
          message: 'Valid media ID is required'
        });
      }

      const result = await this.projectService.deleteProjectMedia(parseInt(mediaId));

      console.log(`✅ Media deleted: ${mediaId}`);

      res.status(200).json({
        success: true,
        message: result.message || 'Media deleted successfully'
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error deleting media:', error.message);

      if (error.message === 'Media not found') {
        return res.status(404).json({
          success: false,
          message: 'Media not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting media',
        error: error.message
      });
    }
  };

  // ============= GET PROJECTS BY CATEGORY =============
  getProjectsByCategory = async (req, res) => {
    try {
      const { category } = req.params;
      const { limit = 10, page = 1 } = req.query;

      console.log('📂 [CONTROLLER] Get projects by category:', { category, limit, page });

      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const result = await this.projectService.getProjectsByCategory(
        category,
        parseInt(limit),
        offset
      );

      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(result.count / parseInt(limit)),
        data: result.data
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching projects by category:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching projects by category',
        error: error.message
      });
    }
  };

  // ============= GET FEATURED PROJECTS =============
  getFeaturedProjects = async (req, res) => {
    try {
      const { limit = 6 } = req.query;

      console.log('⭐ [CONTROLLER] Get featured projects:', { limit });

      const projects = await this.projectService.getFeaturedProjects(parseInt(limit));

      res.status(200).json({
        success: true,
        count: projects.length,
        data: projects
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching featured projects:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching featured projects',
        error: error.message
      });
    }
  };

  // ============= GET RELATED PROJECTS =============
  getRelatedProjects = async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 4 } = req.query;

      console.log('🔄 [CONTROLLER] Get related projects:', { id, limit });

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      const projects = await this.projectService.getRelatedProjects(
        parseInt(id),
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        count: projects.length,
        data: projects
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching related projects:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching related projects',
        error: error.message
      });
    }
  };

  // ============= SEARCH PROJECTS =============
  searchProjects = async (req, res) => {
    try {
      const { q, limit = 10, page = 1, category, status } = req.query;

      console.log('🔍 [CONTROLLER] Search projects:', { q, limit, page, category, status });

      if (!q || q.trim() === '') {
        console.warn('⚠️ Empty search query');
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const filters = {
        category: category || null,
        status: status || null
      };

      const result = await this.projectService.searchProjects(
        q.trim(),
        filters,
        parseInt(limit),
        offset
      );

      console.log(`🔍 Found ${result.count} projects matching "${q}"`);

      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.count,
        query: q,
        currentPage: parseInt(page),
        totalPages: Math.ceil(result.count / parseInt(limit)),
        data: result.data
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error searching projects:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error searching projects',
        error: error.message
      });
    }
  };

  // ============= GET PROJECT STATISTICS =============
  getProjectStats = async (req, res) => {
    try {
      console.log('📊 [CONTROLLER] Get project statistics');

      const stats = await this.projectService.getProjectStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching project statistics:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching project statistics',
        error: error.message
      });
    }
  };

  // ============= GET PROJECT TIMELINE =============
  getProjectTimeline = async (req, res) => {
    try {
      const { id } = req.params;

      console.log('📅 [CONTROLLER] Get project timeline:', id);

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      const timeline = await this.projectService.getProjectTimeline(parseInt(id));

      res.status(200).json({
        success: true,
        data: timeline
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching project timeline:', error.message);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error fetching project timeline',
        error: error.message
      });
    }
  };

  // ============= CLONE PROJECT =============
  cloneProject = async (req, res) => {
    try {
      const { id } = req.params;
      const { newTitle, createdBy } = req.body;

      console.log('🔄 [CONTROLLER] Clone project request:', { id, newTitle, createdBy });

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      if (!createdBy) {
        return res.status(400).json({
          success: false,
          message: 'Creator ID is required'
        });
      }

      const newProject = await this.projectService.cloneProject(
        parseInt(id),
        newTitle,
        parseInt(createdBy)
      );

      console.log(`✅ Project cloned: ${id} -> ${newProject.projectId}`);

      res.status(201).json({
        success: true,
        message: 'Project cloned successfully',
        data: newProject
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error cloning project:', error.message);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error cloning project',
        error: error.message
      });
    }
  };

  // ============= EXPORT PROJECT =============
  exportProject = async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;

      console.log('📤 [CONTROLLER] Export project request:', { id, format });

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          message: 'Valid project ID is required'
        });
      }

      const exportedData = await this.projectService.exportProject(
        parseInt(id),
        format
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=project-${id}.csv`);
        return res.send(exportedData);
      }

      res.status(200).json({
        success: true,
        data: exportedData
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error exporting project:', error.message);

      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error exporting project',
        error: error.message
      });
    }
  };

  // ============= GET PROJECTS BY TECHNOLOGY =============
  getProjectsByTechnology = async (req, res) => {
    try {
      const { technology } = req.params;
      const { limit = 10 } = req.query;

      console.log('💻 [CONTROLLER] Get projects by technology:', { technology, limit });

      if (!technology) {
        return res.status(400).json({
          success: false,
          message: 'Technology is required'
        });
      }

      const projects = await this.projectService.getProjectsByTechnology(
        technology,
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        count: projects.length,
        data: projects
      });
    } catch (error) {
      console.error('❌ [CONTROLLER] Error fetching projects by technology:', error.message);
      res.status(500).json({
        success: false,
        message: 'Error fetching projects by technology',
        error: error.message
      });
    }
  };

  // ============= HEALTH CHECK =============
  healthCheck = async (req, res) => {
    try {
      console.log('🏥 Projects health check');

      const stats = await this.projectService.getProjectStats();

      res.status(200).json({
        success: true,
        message: 'Projects API is healthy',
        stats: {
          ...stats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ Projects health check failed:', error.message);
      res.status(500).json({
        success: false,
        message: 'Projects health check failed',
        error: error.message
      });
    }
  };

  // ============= HELPER METHODS =============
  parseJSONField(field, defaultValue = null) {
    if (!field) return defaultValue;
    
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return defaultValue;
      }
    }
    
    return field;
  }
}

module.exports = ProjectController;



// const { Project, ProjectMedia, User } = require('../models');
// const { validationResult } = require('express-validator');
// const slugify = require('slugify');
// const path = require('path');
// const fs = require('fs').promises;
// const { v4: uuidv4 } = require('uuid');

// // Upload configuration
// const UPLOAD_DIR = path.join(__dirname, '../uploads/projects');
// const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
// const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
// const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// // Ensure upload directory exists
// const ensureUploadDir = async () => {
//   try {
//     await fs.access(UPLOAD_DIR);
//   } catch {
//     await fs.mkdir(UPLOAD_DIR, { recursive: true });
//   }
// };

// // Create project
// exports.createProject = async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const projectData = req.body;
    
//     // Generate slug from title
//     projectData.slug = slugify(projectData.title, {
//       lower: true,
//       strict: true,
//       remove: /[*+~.()'"!:@]/g
//     });

//     // Check for duplicate slug
//     const existingProject = await Project.findOne({ where: { slug: projectData.slug } });
//     if (existingProject) {
//       projectData.slug = `${projectData.slug}-${Date.now()}`;
//     }

//     // Parse JSON fields if they come as strings
//     if (typeof projectData.technologies === 'string') {
//       projectData.technologies = JSON.parse(projectData.technologies);
//     }
//     if (typeof projectData.teamMembers === 'string') {
//       projectData.teamMembers = JSON.parse(projectData.teamMembers);
//     }
//     if (typeof projectData.milestones === 'string') {
//       projectData.milestones = JSON.parse(projectData.milestones);
//     }
//     if (typeof projectData.kpis === 'string') {
//       projectData.kpis = JSON.parse(projectData.kpis);
//     }
//     if (typeof projectData.tags === 'string') {
//       projectData.tags = JSON.parse(projectData.tags);
//     }

//     projectData.createdBy = req.user.userId;

//     const project = await Project.create(projectData);

//     // Handle media uploads if any
//     if (req.files && req.files.length > 0) {
//       await this.handleMediaUploads(req.files, project.projectId, req.user.userId);
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Project created successfully',
//       data: project
//     });
//   } catch (error) {
//     console.error('Create project error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error creating project',
//       error: error.message
//     });
//   }
// };

// // Get all projects with filters
// exports.getProjects = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       category,
//       status,
//       isFeatured,
//       isPublished,
//       clientName,
//       search,
//       sortBy = 'createdAt',
//       sortOrder = 'DESC'
//     } = req.query;

//     const offset = (page - 1) * limit;
//     const where = {};

//     if (category) where.category = category;
//     if (status) where.status = status;
//     if (isFeatured) where.isFeatured = isFeatured === 'true';
//     if (isPublished) where.isPublished = isPublished === 'true';
//     if (clientName) where.clientName = { [Op.like]: `%${clientName}%` };
    
//     if (search) {
//       where[Op.or] = [
//         { title: { [Op.like]: `%${search}%` } },
//         { shortDescription: { [Op.like]: `%${search}%` } },
//         { fullDescription: { [Op.like]: `%${search}%` } }
//       ];
//     }

//     const projects = await Project.findAndCountAll({
//       where,
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         },
//         {
//           model: User,
//           as: 'creator',
//           attributes: ['userId', 'firstName', 'lastName', 'email']
//         },
//         {
//           model: User,
//           as: 'manager',
//           attributes: ['userId', 'firstName', 'lastName', 'email']
//         }
//       ],
//       order: [[sortBy, sortOrder]],
//       limit: parseInt(limit),
//       offset: parseInt(offset),
//       distinct: true
//     });

//     res.json({
//       success: true,
//       data: projects.rows,
//       pagination: {
//         total: projects.count,
//         page: parseInt(page),
//         pages: Math.ceil(projects.count / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Get projects error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching projects',
//       error: error.message
//     });
//   }
// };

// // Get single project by slug or ID
// exports.getProject = async (req, res) => {
//   try {
//     const { identifier } = req.params;
//     const where = isNaN(identifier) ? { slug: identifier } : { projectId: identifier };

//     const project = await Project.findOne({
//       where,
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']]
//         },
//         {
//           model: User,
//           as: 'creator',
//           attributes: ['userId', 'firstName', 'lastName', 'email', 'profileImage']
//         },
//         {
//           model: User,
//           as: 'manager',
//           attributes: ['userId', 'firstName', 'lastName', 'email', 'profileImage']
//         },
//         {
//           model: User,
//           as: 'approver',
//           attributes: ['userId', 'firstName', 'lastName', 'email']
//         }
//       ]
//     });

//     if (!project) {
//       return res.status(404).json({
//         success: false,
//         message: 'Project not found'
//       });
//     }

//     // Increment views
//     await project.increment('views');

//     res.json({
//       success: true,
//       data: project
//     });
//   } catch (error) {
//     console.error('Get project error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching project',
//       error: error.message
//     });
//   }
// };

// // Update project
// exports.updateProject = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const projectData = req.body;

//     const project = await Project.findByPk(id);
//     if (!project) {
//       return res.status(404).json({
//         success: false,
//         message: 'Project not found'
//       });
//     }

//     // Update slug if title changed
//     if (projectData.title && projectData.title !== project.title) {
//       projectData.slug = slugify(projectData.title, {
//         lower: true,
//         strict: true
//       });
      
//       // Check for duplicate slug
//       const existingProject = await Project.findOne({ 
//         where: { 
//           slug: projectData.slug,
//           projectId: { [Op.ne]: id }
//         } 
//       });
      
//       if (existingProject) {
//         projectData.slug = `${projectData.slug}-${Date.now()}`;
//       }
//     }

//     // Parse JSON fields if they come as strings
//     ['technologies', 'teamMembers', 'milestones', 'kpis', 'tags'].forEach(field => {
//       if (typeof projectData[field] === 'string') {
//         try {
//           projectData[field] = JSON.parse(projectData[field]);
//         } catch {
//           // Keep as is if not valid JSON
//         }
//       }
//     });

//     projectData.updatedBy = req.user.userId;
//     projectData.updatedAt = new Date();

//     await project.update(projectData);

//     // Handle new media uploads
//     if (req.files && req.files.length > 0) {
//       await this.handleMediaUploads(req.files, id, req.user.userId);
//     }

//     res.json({
//       success: true,
//       message: 'Project updated successfully',
//       data: project
//     });
//   } catch (error) {
//     console.error('Update project error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error updating project',
//       error: error.message
//     });
//   }
// };

// // Delete project
// exports.deleteProject = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { permanent = false } = req.query;

//     const project = await Project.findByPk(id);
//     if (!project) {
//       return res.status(404).json({
//         success: false,
//         message: 'Project not found'
//       });
//     }

//     if (permanent === 'true' && req.user.role === 'admin') {
//       // Permanently delete
//       await project.destroy({ force: true });
//       // Also delete associated media files
//       await this.deleteProjectMedia(id, true);
//     } else {
//       // Soft delete
//       await project.destroy();
//     }

//     res.json({
//       success: true,
//       message: `Project ${permanent === 'true' ? 'permanently deleted' : 'moved to trash'}`
//     });
//   } catch (error) {
//     console.error('Delete project error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting project',
//       error: error.message
//     });
//   }
// };

// // Upload media for project
// exports.uploadProjectMedia = async (req, res) => {
//   try {
//     const { projectId } = req.params;
//     const { mediaType, title, description, altText, isFeatured, sortOrder } = req.body;

//     const project = await Project.findByPk(projectId);
//     if (!project) {
//       return res.status(404).json({
//         success: false,
//         message: 'Project not found'
//       });
//     }

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No files uploaded'
//       });
//     }

//     const mediaFiles = await this.handleMediaUploads(req.files, projectId, req.user.userId, {
//       mediaType,
//       title,
//       description,
//       altText,
//       isFeatured: isFeatured === 'true',
//       sortOrder: parseInt(sortOrder) || 0
//     });

//     // If this media is featured, unfeature other media
//     if (isFeatured === 'true') {
//       await ProjectMedia.update(
//         { isFeatured: false },
//         { 
//           where: { 
//             projectId,
//             mediaId: { [Op.ne]: mediaFiles[0].mediaId }
//           } 
//         }
//       );
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Media uploaded successfully',
//       data: mediaFiles
//     });
//   } catch (error) {
//     console.error('Upload media error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error uploading media',
//       error: error.message
//     });
//   }
// };

// // Delete media
// exports.deleteMedia = async (req, res) => {
//   try {
//     const { mediaId } = req.params;

//     const media = await ProjectMedia.findByPk(mediaId);
//     if (!media) {
//       return res.status(404).json({
//         success: false,
//         message: 'Media not found'
//       });
//     }

//     // Delete physical file
//     if (media.mediaUrl && !media.mediaUrl.startsWith('http')) {
//       const filePath = path.join(__dirname, '..', media.mediaUrl);
//       try {
//         await fs.unlink(filePath);
//       } catch (err) {
//         console.error('Error deleting file:', err);
//       }
//     }

//     if (media.thumbnailUrl && !media.thumbnailUrl.startsWith('http')) {
//       const thumbPath = path.join(__dirname, '..', media.thumbnailUrl);
//       try {
//         await fs.unlink(thumbPath);
//       } catch (err) {
//         console.error('Error deleting thumbnail:', err);
//       }
//     }

//     await media.destroy();

//     res.json({
//       success: true,
//       message: 'Media deleted successfully'
//     });
//   } catch (error) {
//     console.error('Delete media error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error deleting media',
//       error: error.message
//     });
//   }
// };

// // Helper function to handle media uploads
// exports.handleMediaUploads = async (files, projectId, userId, additionalData = {}) => {
//   await ensureUploadDir();
  
//   const mediaRecords = [];
  
//   for (const file of files) {
//     const fileExt = path.extname(file.originalname);
//     const fileName = `${uuidv4()}${fileExt}`;
//     const projectDir = path.join(UPLOAD_DIR, projectId.toString());
    
//     // Create project-specific directory
//     await fs.mkdir(projectDir, { recursive: true });
    
//     const filePath = path.join(projectDir, fileName);
//     const relativePath = `/uploads/projects/${projectId}/${fileName}`;
    
//     // Determine media type
//     let mediaType = 'other';
//     if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
//       mediaType = 'image';
//     } else if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
//       mediaType = 'video';
//     } else if (ALLOWED_DOC_TYPES.includes(file.mimetype)) {
//       mediaType = 'document';
//     }
    
//     // Move file
//     await fs.writeFile(filePath, file.buffer);
    
//     // Create media record
//     const mediaData = {
//       projectId,
//       mediaType: additionalData.mediaType || mediaType,
//       mediaUrl: relativePath,
//       fileName: file.originalname,
//       fileSize: file.size,
//       mimeType: file.mimetype,
//       title: additionalData.title || file.originalname,
//       description: additionalData.description || '',
//       altText: additionalData.altText || '',
//       isFeatured: additionalData.isFeatured || false,
//       sortOrder: additionalData.sortOrder || 0,
//       uploadedBy: userId,
//       dimensions: mediaType === 'image' ? await getImageDimensions(filePath) : null
//     };
    
//     const media = await ProjectMedia.create(mediaData);
//     mediaRecords.push(media);
//   }
  
//   return mediaRecords;
// };

// // Helper function to get image dimensions
// const getImageDimensions = async (filePath) => {
//   // Implementation depends on your image processing library
//   // You might use sharp, jimp, or graphicsmagick
//   return null;
// };

// // Helper function to delete project media
// exports.deleteProjectMedia = async (projectId, permanentDelete = false) => {
//   const media = await ProjectMedia.findAll({ where: { projectId } });
  
//   for (const item of media) {
//     if (item.mediaUrl && !item.mediaUrl.startsWith('http')) {
//       const filePath = path.join(__dirname, '..', item.mediaUrl);
//       try {
//         await fs.unlink(filePath);
//       } catch (err) {
//         console.error('Error deleting file:', err);
//       }
//     }
    
//     if (permanentDelete) {
//       await item.destroy({ force: true });
//     }
//   }
  
//   if (permanentDelete) {
//     const projectDir = path.join(UPLOAD_DIR, projectId.toString());
//     try {
//       await fs.rmdir(projectDir, { recursive: true });
//     } catch (err) {
//       console.error('Error deleting directory:', err);
//     }
//   }
// };

// // Get project statistics
// exports.getProjectStats = async (req, res) => {
//   try {
//     const stats = await Project.findAll({
//       attributes: [
//         'category',
//         [sequelize.fn('COUNT', sequelize.col('projectId')), 'count'],
//         [sequelize.fn('SUM', sequelize.col('views')), 'totalViews']
//       ],
//       group: ['category']
//     });

//     const statusStats = await Project.findAll({
//       attributes: [
//         'status',
//         [sequelize.fn('COUNT', sequelize.col('projectId')), 'count']
//       ],
//       group: ['status']
//     });

//     res.json({
//       success: true,
//       data: {
//         byCategory: stats,
//         byStatus: statusStats
//       }
//     });
//   } catch (error) {
//     console.error('Get project stats error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching project statistics',
//       error: error.message
//     });
//   }
// };