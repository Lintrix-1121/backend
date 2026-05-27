const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

class ProjectService {
  constructor(models, sequelize = null) {
    console.log('🔧 ProjectService constructor called');
    
    this.sequelize = sequelize;
    this._models = models;
    
    // Initialize models
    this.Project = models.Project;
    this.ProjectMedia = models.ProjectMedia;
    this.User = models.User;
    
    if (!this.Project) {
      console.error('❌ Project model is required but not found');
      throw new Error('Project model is required');
    }
    
    console.log('✅ ProjectService initialized');
    console.log('📊 Models available:', {
      Project: !!this.Project,
      ProjectMedia: !!this.ProjectMedia,
      User: !!this.User
    });
  }

  // ============= CREATE PROJECT =============
  async createProject(projectData, files = []) {
    try {
      console.log('🎯 [SERVICE] createProject called');
      console.log('📦 Project data keys:', Object.keys(projectData));
      console.log('📦 Files count:', files?.length || 0);

      // Generate slug if needed
      if (!projectData.slug) {
        projectData.slug = this.generateSlug(projectData.title);
      }

      // Ensure required fields
      const dbData = {
        ...projectData,
        views: 0,
        likes: 0,
        shares: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('💾 [SERVICE] Creating project in database');

      // Create project in database
      const project = await this.Project.create(dbData);

      console.log('✅ [SERVICE] Project created with ID:', project.projectId);

      // Handle media files if any
      let mediaFiles = [];
      if (files && files.length > 0) {
        console.log(`🖼️ [SERVICE] Processing ${files.length} media files`);
        mediaFiles = await this.uploadProjectMedia(
          { projectId: project.projectId, uploadedBy: projectData.createdBy },
          files
        );
        console.log(`✅ [SERVICE] Uploaded ${mediaFiles.length} media files`);
      }

      return await this.formatProjectResponse(project);
    } catch (error) {
      console.error('❌ [SERVICE] Error creating project:', error.message);
      console.error('Error stack:', error.stack);

      if (error.name === 'SequelizeValidationError') {
        console.error('❌ [SERVICE] Validation errors:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path}: ${err.message} (value: ${err.value})`);
        });
        throw new Error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Project with this slug already exists');
      }

      throw new Error(`Error creating project: ${error.message}`);
    }
  }

  // ============= GET ALL PROJECTS =============
  async getAllProjects(options = {}) {
    try {
      console.log('📋 [SERVICE] getAllProjects called with options:', options);

      const {
        filters = {},
        pagination = { limit: 10, offset: 0 },
        sort = { by: 'createdAt', order: 'DESC' },
        search = null
      } = options;

      // Build where clause
      const where = {};

      // Apply filters
      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.isFeatured !== null && filters.isFeatured !== undefined) {
        where.isFeatured = filters.isFeatured;
      }

      if (filters.isPublished !== null && filters.isPublished !== undefined) {
        where.isPublished = filters.isPublished;
      }

      if (filters.clientName) {
        where.clientName = { [Op.like]: `%${filters.clientName}%` };
      }

      if (filters.priority) {
        where.priority = filters.priority;
      }

      if (filters.minBudget !== null && filters.minBudget !== undefined) {
        where.budget = { ...where.budget, [Op.gte]: filters.minBudget };
      }

      if (filters.maxBudget !== null && filters.maxBudget !== undefined) {
        where.budget = { ...where.budget, [Op.lte]: filters.maxBudget };
      }

      if (filters.technology) {
        where.technologies = { [Op.like]: `%${filters.technology}%` };
      }

      // Apply search
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { shortDescription: { [Op.like]: `%${search}%` } },
          { fullDescription: { [Op.like]: `%${search}%` } },
          { clientName: { [Op.like]: `%${search}%` } },
          { tags: { [Op.like]: `%${search}%` } }
        ];
      }

      // Build include options
      const include = [];

      if (this.User) {
        include.push({
          model: this.User,
          as: 'creator',
          attributes: ['userId', 'username', 'email', 'profilePicture']
        });
      }

      if (this.User) {
        include.push({
          model: this.User,
          as: 'manager',
          attributes: ['userId', 'username', 'email', 'profilePicture']
        });
      }

      // Include featured media
      include.push({
        model: this.ProjectMedia,
        as: 'media',
        where: { isFeatured: true },
        required: false,
        limit: 1,
        attributes: ['mediaId', 'mediaType', 'mediaUrl', 'thumbnailUrl', 'title']
      });

      console.log('🔍 [SERVICE] Query conditions:', { where, limit: pagination.limit, offset: pagination.offset });

      // Get total count
      const count = await this.Project.count({ where });

      // Get paginated results
      const projects = await this.Project.findAll({
        where,
        include,
        limit: pagination.limit,
        offset: pagination.offset,
        order: [[sort.by, sort.order]],
        distinct: true
      });

      console.log(`✅ [SERVICE] Found ${count} projects (returning ${projects.length})`);

      // Format responses
      const formattedProjects = await Promise.all(
        projects.map(project => this.formatProjectResponse(project))
      );

      return {
        count,
        data: formattedProjects
      };
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching projects:', error.message);

      if (error.message.includes("doesn't exist") || error.message.includes("ER_NO_SUCH_TABLE")) {
        console.log('⚠️ Projects table not found, returning empty array');
        return { count: 0, data: [] };
      }

      throw new Error(`Error fetching projects: ${error.message}`);
    }
  }

  // ============= GET PROJECT BY IDENTIFIER =============
  async getProjectByIdentifier(identifier, includeMedia = true, incrementViews = true) {
    try {
      console.log('🔍 [SERVICE] getProjectByIdentifier called:', identifier);

      const where = isNaN(parseInt(identifier))
        ? { slug: identifier }
        : { projectId: parseInt(identifier) };

      // Build include options
      const include = [];

      if (this.User) {
        include.push({
          model: this.User,
          as: 'creator',
          attributes: ['userId', 'username', 'email', 'profilePicture']
        });

        include.push({
          model: this.User,
          as: 'manager',
          attributes: ['userId', 'username', 'email', 'profilePicture']
        });
      }

      if (includeMedia) {
        include.push({
          model: this.ProjectMedia,
          as: 'media',
          order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
          include: this.User ? [{
            model: this.User,
            as: 'uploader',
            attributes: ['userId', 'username']
          }] : []
        });
      }

      const project = await this.Project.findOne({
        where,
        include
      });

      if (!project) {
        console.warn(`⚠️ [SERVICE] Project not found: ${identifier}`);
        throw new Error('Project not found');
      }

      // Increment views if requested
      if (incrementViews) {
        await project.increment('views', { by: 1 });
        project.views += 1;
      }

      console.log(`✅ [SERVICE] Project found: ${project.title}`);
      return await this.formatProjectResponse(project);
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching project:', error);
      throw new Error(`Error fetching project: ${error.message}`);
    }
  }

  // ============= UPDATE PROJECT =============
  async updateProject(projectId, projectData, files = []) {
    try {
      console.log('✏️ [SERVICE] updateProject called:', projectId);

      // Get the project
      const project = await this.Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Handle slug update if title changed
      if (projectData.title && projectData.title !== project.title) {
        projectData.slug = this.generateSlug(projectData.title);
        
        // Check for duplicate slug
        const existingProject = await this.Project.findOne({
          where: {
            slug: projectData.slug,
            projectId: { [Op.ne]: projectId }
          }
        });
        
        if (existingProject) {
          projectData.slug = `${projectData.slug}-${Date.now()}`;
        }
      }

      // Update the project
      console.log('📝 [SERVICE] Updating project with data:', Object.keys(projectData));
      await project.update({
        ...projectData,
        updatedAt: new Date()
      });

      // Handle new media files if any
      if (files && files.length > 0) {
        console.log(`🖼️ [SERVICE] Uploading ${files.length} new media files`);
        await this.uploadProjectMedia(
          { projectId, uploadedBy: projectData.updatedBy },
          files
        );
      }

      return await this.formatProjectResponse(project);
    } catch (error) {
      console.error('❌ [SERVICE] Error updating project:', error.message);
      console.error('❌ [SERVICE] Full error:', error);
      throw new Error(`Error updating project: ${error.message}`);
    }
  }

  // ============= DELETE PROJECT =============
  async deleteProject(projectId, permanent = false) {
    try {
      console.log('🗑️ [SERVICE] deleteProject called:', { projectId, permanent });

      const project = await this.Project.findByPk(projectId);
      if (!project) {
        console.warn(`⚠️ [SERVICE] Project not found for deletion: ${projectId}`);
        throw new Error('Project not found');
      }

      if (permanent) {
        // Get all media before deleting
        const media = await this.ProjectMedia.findAll({
          where: { projectId }
        });

        // Delete physical files
        for (const item of media) {
          await this.deleteMediaFiles(item);
        }

        // Permanently delete from database
        await project.destroy({ force: true });
        console.log(`✅ [SERVICE] Project permanently deleted: ${projectId}`);
        return { message: 'Project permanently deleted' };
      } else {
        // Soft delete
        await project.destroy();
        console.log(`✅ [SERVICE] Project soft deleted: ${projectId}`);
        return { message: 'Project moved to trash' };
      }
    } catch (error) {
      console.error('❌ [SERVICE] Error deleting project:', error);
      throw new Error(`Error deleting project: ${error.message}`);
    }
  }

  // ============= UPLOAD PROJECT MEDIA =============
  async uploadProjectMedia(mediaData, files) {
    try {
      console.log('🖼️ [SERVICE] uploadProjectMedia called:', { 
        projectId: mediaData.projectId,
        fileCount: files.length 
      });

      const mediaRecords = [];

      for (const file of files) {
        // Determine media type from file
        let mediaType = 'other';
        if (file.mimetype.startsWith('image/')) {
          mediaType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
          mediaType = 'video';
        } else {
          mediaType = 'document';
        }

        // Build file URL
        let mediaUrl;
        if (file.filename) {
          if (mediaType === 'image') {
            mediaUrl = `/uploads/projects/images/${file.filename}`;
          } else if (mediaType === 'video') {
            mediaUrl = `/uploads/projects/videos/${file.filename}`;
          } else {
            mediaUrl = `/uploads/projects/documents/${file.filename}`;
          }
        } else {
          mediaUrl = file.path; // For memory storage
        }

        // Create media record
        const mediaRecord = await this.ProjectMedia.create({
          projectId: mediaData.projectId,
          mediaType: mediaData.mediaType || mediaType,
          mediaUrl,
          fileName: file.originalname || file.filename,
          fileSize: file.size,
          mimeType: file.mimetype,
          title: mediaData.title || file.originalname,
          description: mediaData.description || '',
          altText: mediaData.altText || '',
          isFeatured: mediaData.isFeatured || false,
          sortOrder: mediaData.sortOrder || 0,
          uploadedBy: mediaData.uploadedBy
        });

        mediaRecords.push(mediaRecord);
      }

      // If this media is featured, unfeature other media
      if (mediaData.isFeatured) {
        await this.ProjectMedia.update(
          { isFeatured: false },
          {
            where: {
              projectId: mediaData.projectId,
              mediaId: { [Op.ne]: mediaRecords[0].mediaId }
            }
          }
        );
      }

      console.log(`✅ [SERVICE] Uploaded ${mediaRecords.length} media files`);
      return mediaRecords;
    } catch (error) {
      console.error('❌ [SERVICE] Error uploading media:', error.message);
      throw new Error(`Error uploading media: ${error.message}`);
    }
  }

  // ============= DELETE PROJECT MEDIA =============
  async deleteProjectMedia(mediaId) {
    try {
      console.log('🗑️ [SERVICE] deleteProjectMedia called:', mediaId);

      const media = await this.ProjectMedia.findByPk(mediaId);
      if (!media) {
        console.warn(`⚠️ [SERVICE] Media not found: ${mediaId}`);
        throw new Error('Media not found');
      }

      // Delete physical files
      await this.deleteMediaFiles(media);

      // Delete from database
      await media.destroy();

      console.log(`✅ [SERVICE] Media deleted: ${mediaId}`);
      return { message: 'Media deleted successfully' };
    } catch (error) {
      console.error('❌ [SERVICE] Error deleting media:', error.message);
      throw new Error(`Error deleting media: ${error.message}`);
    }
  }

  // ============= DELETE MEDIA FILES =============
  async deleteMediaFiles(media) {
    try {
      // Delete main media file
      if (media.mediaUrl && !media.mediaUrl.startsWith('http')) {
        const filePath = path.join(__dirname, '..', media.mediaUrl);
        try {
          await fs.unlink(filePath);
          console.log(`✅ Deleted file: ${filePath}`);
        } catch (err) {
          console.warn(`⚠️ Could not delete file: ${filePath}`, err.message);
        }
      }

      // Delete thumbnail if exists
      if (media.thumbnailUrl && !media.thumbnailUrl.startsWith('http')) {
        const thumbPath = path.join(__dirname, '..', media.thumbnailUrl);
        try {
          await fs.unlink(thumbPath);
          console.log(`✅ Deleted thumbnail: ${thumbPath}`);
        } catch (err) {
          console.warn(`⚠️ Could not delete thumbnail: ${thumbPath}`, err.message);
        }
      }
    } catch (error) {
      console.error('❌ Error deleting media files:', error.message);
    }
  }

  // ============= GET FEATURED PROJECTS =============
  async getFeaturedProjects(limit = 6) {
    try {
      console.log('⭐ [SERVICE] getFeaturedProjects called:', { limit });

      const projects = await this.Project.findAll({
        where: {
          isFeatured: true,
          isPublished: true,
          status: 'completed'
        },
        include: [
          {
            model: this.ProjectMedia,
            as: 'media',
            where: { isFeatured: true },
            required: false,
            limit: 1
          },
          {
            model: this.User,
            as: 'manager',
            attributes: ['userId', 'username']
          }
        ],
        order: [['publishedAt', 'DESC']],
        limit
      });

      const formattedProjects = await Promise.all(
        projects.map(project => this.formatProjectResponse(project))
      );

      return formattedProjects;
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching featured projects:', error.message);
      return [];
    }
  }

  // ============= GET PROJECTS BY CATEGORY =============
  async getProjectsByCategory(category, limit = 10, offset = 0) {
    try {
      console.log('📂 [SERVICE] getProjectsByCategory called:', { category, limit, offset });

      const where = {
        category,
        isPublished: true
      };

      const count = await this.Project.count({ where });

      const projects = await this.Project.findAll({
        where,
        include: [
          {
            model: this.ProjectMedia,
            as: 'media',
            where: { isFeatured: true },
            required: false,
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
      });

      const formattedProjects = await Promise.all(
        projects.map(project => this.formatProjectResponse(project))
      );

      return {
        count,
        data: formattedProjects
      };
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching projects by category:', error.message);
      return { count: 0, data: [] };
    }
  }

  // ============= GET RELATED PROJECTS =============
  async getRelatedProjects(projectId, limit = 4) {
    try {
      console.log('🔄 [SERVICE] getRelatedProjects called:', { projectId, limit });

      // Get the project to find its category
      const project = await this.Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const projects = await this.Project.findAll({
        where: {
          projectId: { [Op.ne]: projectId },
          category: project.category,
          isPublished: true
        },
        include: [
          {
            model: this.ProjectMedia,
            as: 'media',
            where: { isFeatured: true },
            required: false,
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      });

      const formattedProjects = await Promise.all(
        projects.map(proj => this.formatProjectResponse(proj))
      );

      return formattedProjects;
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching related projects:', error.message);
      return [];
    }
  }

  // ============= SEARCH PROJECTS =============
  async searchProjects(query, filters = {}, limit = 10, offset = 0) {
    try {
      console.log('🔍 [SERVICE] searchProjects called:', { query, filters, limit, offset });

      const where = {
        isPublished: true,
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { shortDescription: { [Op.like]: `%${query}%` } },
          { fullDescription: { [Op.like]: `%${query}%` } },
          { technologies: { [Op.like]: `%${query}%` } },
          { tags: { [Op.like]: `%${query}%` } },
          { clientName: { [Op.like]: `%${query}%` } }
        ]
      };

      // Add filters
      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      const count = await this.Project.count({ where });

      const projects = await this.Project.findAll({
        where,
        include: [
          {
            model: this.ProjectMedia,
            as: 'media',
            where: { isFeatured: true },
            required: false,
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
      });

      const formattedProjects = await Promise.all(
        projects.map(project => this.formatProjectResponse(project))
      );

      return {
        count,
        data: formattedProjects
      };
    } catch (error) {
      console.error('❌ [SERVICE] Error searching projects:', error.message);
      return { count: 0, data: [] };
    }
  }

  // ============= GET PROJECT STATISTICS =============
  async getProjectStats() {
    try {
      console.log('📊 [SERVICE] getProjectStats called');

      // 1. Get counts
      const totalProjects = await this.Project.count();
      const publishedProjects = await this.Project.count({ where: { isPublished: true } });
      const featuredProjects = await this.Project.count({ where: { isFeatured: true } });
      
      // 2. Get status counts
      const statusCounts = await this.Project.findAll({
        attributes: [
          'status',
          [this.sequelize?.fn('COUNT', this.sequelize?.col('projectId')), 'count']
        ],
        group: ['status']
      });

      // 3. Get category counts
      const categoryCounts = await this.Project.findAll({
        where: { isPublished: true },
        attributes: [
          'category',
          [this.sequelize?.fn('COUNT', this.sequelize?.col('projectId')), 'count']
        ],
        group: ['category']
      });

      // 4. Get engagement metrics
      const allProjects = await this.Project.findAll({
        where: { isPublished: true },
        attributes: ['views', 'likes', 'shares']
      });

      let totalViews = 0;
      let totalLikes = 0;
      let totalShares = 0;

      allProjects.forEach(project => {
        totalViews += project.views || 0;
        totalLikes += project.likes || 0;
        totalShares += project.shares || 0;
      });

      const averageViews = allProjects.length > 0
        ? Math.round(totalViews / allProjects.length)
        : 0;

      // 5. Get recent projects
      const recentProjects = await this.Project.findAll({
        where: { isPublished: true },
        order: [['createdAt', 'DESC']],
        limit: 5,
        attributes: ['projectId', 'title', 'category', 'views', 'status', 'createdAt'],
        include: [{
          model: this.User,
          as: 'creator',
          attributes: ['username']
        }]
      });

      // 6. Get top performing projects
      const topProjects = await this.Project.findAll({
        where: { isPublished: true },
        order: [['views', 'DESC']],
        limit: 5,
        attributes: ['projectId', 'title', 'category', 'views', 'likes', 'shares'],
        include: [{
          model: this.User,
          as: 'creator',
          attributes: ['username']
        }]
      });

      const stats = {
        totals: {
          all: totalProjects || 0,
          published: publishedProjects || 0,
          featured: featuredProjects || 0
        },
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = parseInt(item.dataValues.count);
          return acc;
        }, {}),
        byCategory: categoryCounts.reduce((acc, item) => {
          acc[item.category] = parseInt(item.dataValues.count);
          return acc;
        }, {}),
        engagement: {
          totalViews: totalViews || 0,
          totalLikes: totalLikes || 0,
          totalShares: totalShares || 0,
          averageViews: averageViews || 0
        },
        recentProjects: recentProjects.map(p => ({
          id: p.projectId,
          title: p.title,
          category: p.category,
          views: p.views || 0,
          createdAt: p.createdAt,
          creator: p.creator?.username || 'Unknown'
        })),
        topPerformers: topProjects.map(p => ({
          id: p.projectId,
          title: p.title,
          category: p.category,
          views: p.views || 0,
          likes: p.likes || 0,
          shares: p.shares || 0,
          creator: p.creator?.username || 'Unknown',
          engagementScore: Math.round(
            ((p.views || 0) * 0.4 + (p.likes || 0) * 0.3 + (p.shares || 0) * 0.3) / 10
          )
        })),
        calculatedAt: new Date().toISOString()
      };

      console.log('✅ [SERVICE] Project stats calculated successfully');
      return stats;
    } catch (error) {
      console.error('❌ [SERVICE] Error getting project stats:', error);
      
      // Return minimal stats on error
      return {
        totals: { all: 0, published: 0, featured: 0 },
        byStatus: {},
        byCategory: {},
        engagement: { totalViews: 0, totalLikes: 0, totalShares: 0, averageViews: 0 },
        recentProjects: [],
        topPerformers: [],
        calculatedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // ============= GET PROJECT TIMELINE =============
  async getProjectTimeline(projectId) {
    try {
      console.log('📅 [SERVICE] getProjectTimeline called:', projectId);

      const project = await this.Project.findByPk(projectId, {
        attributes: ['projectId', 'title', 'startDate', 'endDate', 'status', 'milestones', 'completionPercentage']
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const timeline = {
        project: {
          id: project.projectId,
          title: project.title,
          startDate: project.startDate,
          endDate: project.endDate,
          status: project.status,
          completionPercentage: project.completionPercentage || 0
        },
        milestones: project.milestones || [],
        duration: this.calculateDuration(project.startDate, project.endDate),
        progress: this.calculateProgress(project.startDate, project.endDate, project.completionPercentage)
      };

      return timeline;
    } catch (error) {
      console.error('❌ [SERVICE] Error getting project timeline:', error.message);
      throw new Error(`Error getting project timeline: ${error.message}`);
    }
  }

  // ============= CLONE PROJECT =============
  async cloneProject(projectId, newTitle, userId) {
    try {
      console.log('🔄 [SERVICE] cloneProject called:', { projectId, newTitle, userId });

      // Get original project with media
      const originalProject = await this.Project.findByPk(projectId, {
        include: [{
          model: this.ProjectMedia,
          as: 'media'
        }]
      });

      if (!originalProject) {
        throw new Error('Project not found');
      }

      // Create new project data
      const projectData = originalProject.toJSON();
      delete projectData.projectId;
      delete projectData.createdAt;
      delete projectData.updatedAt;
      delete projectData.publishedAt;
      delete projectData.views;
      delete projectData.likes;
      delete projectData.shares;

      projectData.title = newTitle || `Copy of ${projectData.title}`;
      projectData.slug = this.generateSlug(projectData.title) + '-' + Date.now();
      projectData.isPublished = false;
      projectData.createdBy = userId;
      projectData.status = 'planned';

      // Create new project
      const newProject = await this.Project.create(projectData);

      // Clone media if any
      if (originalProject.media && originalProject.media.length > 0) {
        for (const media of originalProject.media) {
          const mediaData = media.toJSON();
          delete mediaData.mediaId;
          delete mediaData.createdAt;
          delete mediaData.updatedAt;

          // Copy physical file if local
          if (mediaData.mediaUrl && !mediaData.mediaUrl.startsWith('http')) {
            const sourcePath = path.join(__dirname, '..', mediaData.mediaUrl);
            const targetFileName = path.basename(mediaData.mediaUrl);
            
            let targetDir;
            if (mediaData.mediaType === 'image') {
              targetDir = 'uploads/projects/images/';
            } else if (mediaData.mediaType === 'video') {
              targetDir = 'uploads/projects/videos/';
            } else {
              targetDir = 'uploads/projects/documents/';
            }

            const targetPath = path.join(__dirname, '..', targetDir, targetFileName);

            try {
              await fs.mkdir(path.dirname(targetPath), { recursive: true });
              await fs.copyFile(sourcePath, targetPath);
              mediaData.mediaUrl = `/${targetDir}${targetFileName}`;
            } catch (err) {
              console.warn('⚠️ Could not copy media file:', err.message);
            }
          }

          mediaData.projectId = newProject.projectId;
          mediaData.uploadedBy = userId;

          await this.ProjectMedia.create(mediaData);
        }
      }

      return await this.formatProjectResponse(newProject);
    } catch (error) {
      console.error('❌ [SERVICE] Error cloning project:', error.message);
      throw new Error(`Error cloning project: ${error.message}`);
    }
  }

  // ============= EXPORT PROJECT =============
  async exportProject(projectId, format = 'json') {
    try {
      console.log('📤 [SERVICE] exportProject called:', { projectId, format });

      const project = await this.Project.findByPk(projectId, {
        include: [
          {
            model: this.ProjectMedia,
            as: 'media'
          },
          {
            model: this.User,
            as: 'creator',
            attributes: ['userId', 'username', 'email']
          },
          {
            model: this.User,
            as: 'manager',
            attributes: ['userId', 'username', 'email']
          }
        ]
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const formattedProject = await this.formatProjectResponse(project);

      if (format === 'csv') {
        return this.convertToCSV(formattedProject);
      }

      return formattedProject;
    } catch (error) {
      console.error('❌ [SERVICE] Error exporting project:', error.message);
      throw new Error(`Error exporting project: ${error.message}`);
    }
  }

  // ============= GET PROJECTS BY TECHNOLOGY =============
  async getProjectsByTechnology(technology, limit = 10) {
    try {
      console.log('💻 [SERVICE] getProjectsByTechnology called:', { technology, limit });

      const projects = await this.Project.findAll({
        where: {
          isPublished: true,
          technologies: { [Op.like]: `%${technology}%` }
        },
        include: [
          {
            model: this.ProjectMedia,
            as: 'media',
            where: { isFeatured: true },
            required: false,
            limit: 1
          }
        ],
        order: [['createdAt', 'DESC']],
        limit
      });

      const formattedProjects = await Promise.all(
        projects.map(project => this.formatProjectResponse(project))
      );

      return formattedProjects;
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching projects by technology:', error.message);
      return [];
    }
  }

  // ============= FORMAT PROJECT RESPONSE =============
  async formatProjectResponse(project) {
    if (!project) return null;

    const plainProject = project.get ? project.get({ plain: true }) : project;

    // Format dates
    if (plainProject.createdAt) {
      plainProject.createdAtFormatted = new Date(plainProject.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    if (plainProject.publishedAt) {
      plainProject.publishedAtFormatted = new Date(plainProject.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      plainProject.publishedAtRelative = this.getRelativeTime(new Date(plainProject.publishedAt));
    }

    // Format dates for start/end
    if (plainProject.startDate) {
      plainProject.startDateFormatted = new Date(plainProject.startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    if (plainProject.endDate) {
      plainProject.endDateFormatted = new Date(plainProject.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Calculate duration if not set
    if (!plainProject.projectDuration && plainProject.startDate && plainProject.endDate) {
      plainProject.projectDuration = this.calculateDuration(plainProject.startDate, plainProject.endDate);
    }

    // Format media URLs
    if (plainProject.media && plainProject.media.length > 0) {
      plainProject.media = plainProject.media.map(media => {
        if (media.mediaUrl && !media.mediaUrl.startsWith('http')) {
          media.fullUrl = `${process.env.BASE_URL || ''}${media.mediaUrl}`;
        }
        return media;
      });

      // Set featured image URL
      const featuredMedia = plainProject.media.find(m => m.isFeatured);
      if (featuredMedia) {
        plainProject.featuredImageUrl = featuredMedia.fullUrl || featuredMedia.mediaUrl;
      }
    }

    // Add creator details if available
    if (plainProject.creator) {
      plainProject.creatorName = plainProject.creator.username || `User ${plainProject.createdBy}`;
    }

    // Add manager details if available
    if (plainProject.manager) {
      plainProject.managerName = plainProject.manager.username || `User ${plainProject.projectManager}`;
    }

    // Add status badge info
    plainProject.statusBadge = this.getStatusBadge(plainProject.status);

    // Add priority badge info
    plainProject.priorityBadge = this.getPriorityBadge(plainProject.priority);

    // Calculate progress
    plainProject.progress = this.calculateProgress(
      plainProject.startDate,
      plainProject.endDate,
      plainProject.completionPercentage
    );

    return plainProject;
  }

  // ============= HELPER METHODS =============
  generateSlug(title) {
    if (!title) return 'untitled-' + Date.now();
    return title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      const months = Math.floor(diffDay / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else if (diffDay > 0) {
      return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    } else {
      return 'Just now';
    }
  }

  calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
      const months = Math.round(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else {
      const years = Math.round(diffDays / 365);
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
  }

  calculateProgress(startDate, endDate, completionPercentage) {
    if (completionPercentage !== null && completionPercentage !== undefined) {
      return completionPercentage;
    }

    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end - start;
    const elapsed = now - start;
    return Math.round((elapsed / total) * 100);
  }

  getStatusBadge(status) {
    const badges = {
      'planned': { color: 'blue', text: 'Planned' },
      'in-progress': { color: 'yellow', text: 'In Progress' },
      'completed': { color: 'green', text: 'Completed' },
      'on-hold': { color: 'orange', text: 'On Hold' },
      'cancelled': { color: 'red', text: 'Cancelled' },
      'maintenance': { color: 'purple', text: 'Maintenance' }
    };
    return badges[status] || { color: 'gray', text: status };
  }

  getPriorityBadge(priority) {
    const badges = {
      'low': { color: 'green', text: 'Low' },
      'medium': { color: 'yellow', text: 'Medium' },
      'high': { color: 'orange', text: 'High' },
      'critical': { color: 'red', text: 'Critical' }
    };
    return badges[priority] || { color: 'gray', text: priority };
  }

  convertToCSV(obj, parentKey = '') {
    let csv = '';
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        csv += this.convertToCSV(value, fullKey);
      } else if (Array.isArray(value)) {
        csv += `"${fullKey}","${JSON.stringify(value).replace(/"/g, '""')}"\n`;
      } else {
        csv += `"${fullKey}","${value}"\n`;
      }
    }
    
    return csv;
  }
}

module.exports = ProjectService;






// const { Project, ProjectMedia, User } = require('../models')
// const { Op } = require('sequelize');
// const path = require('path');
// const fs = require('fs').promises;

// class ProjectService {
//   // Get featured projects for homepage
//   async getFeaturedProjects(limit = 6) {
//     return await Project.findAll({
//       where: {
//         isFeatured: true,
//         isPublished: true,
//         status: 'completed'
//       },
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         }
//       ],
//       order: [['publishedAt', 'DESC']],
//       limit
//     });
//   }

//   // Get projects by category
//   async getProjectsByCategory(category, limit = 10, offset = 0) {
//     return await Project.findAndCountAll({
//       where: {
//         category,
//         isPublished: true
//       },
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         }
//       ],
//       order: [['createdAt', 'DESC']],
//       limit,
//       offset,
//       distinct: true
//     });
//   }

//   // Get related projects
//   async getRelatedProjects(projectId, category, limit = 4) {
//     return await Project.findAll({
//       where: {
//         projectId: { [Op.ne]: projectId },
//         category,
//         isPublished: true
//       },
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         }
//       ],
//       order: [['createdAt', 'DESC']],
//       limit
//     });
//   }

//   // Search projects
//   async searchProjects(query, filters = {}, limit = 20, offset = 0) {
//     const where = {
//       isPublished: true,
//       [Op.or]: [
//         { title: { [Op.like]: `%${query}%` } },
//         { shortDescription: { [Op.like]: `%${query}%` } },
//         { fullDescription: { [Op.like]: `%${query}%` } },
//         { technologies: { [Op.like]: `%${query}%` } },
//         { tags: { [Op.like]: `%${query}%` } }
//       ]
//     };

//     // Add filters
//     if (filters.category) where.category = filters.category;
//     if (filters.status) where.status = filters.status;
//     if (filters.minBudget) where.budget = { [Op.gte]: filters.minBudget };
//     if (filters.maxBudget) where.budget = { ...where.budget, [Op.lte]: filters.maxBudget };

//     return await Project.findAndCountAll({
//       where,
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         }
//       ],
//       order: [['createdAt', 'DESC']],
//       limit,
//       offset,
//       distinct: true
//     });
//   }

//   // Update project status
//   async updateProjectStatus(projectId, status, userId) {
//     const project = await Project.findByPk(projectId);
//     if (!project) throw new Error('Project not found');

//     await project.update({
//       status,
//       updatedBy: userId,
//       updatedAt: new Date(),
//       ...(status === 'completed' && { completedAt: new Date() })
//     });

//     return project;
//   }

//   // Get project timeline
//   async getProjectTimeline(projectId) {
//     const project = await Project.findByPk(projectId, {
//       attributes: ['projectId', 'title', 'startDate', 'endDate', 'status', 'milestones']
//     });

//     if (!project) throw new Error('Project not found');

//     const timeline = {
//       project: project.toJSON(),
//       milestones: project.milestones || [],
//       duration: project.startDate && project.endDate 
//         ? Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))
//         : null
//     };

//     return timeline;
//   }

//   // Export project data
//   async exportProjectData(projectId, format = 'json') {
//     const project = await Project.findByPk(projectId, {
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media'
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
//       ]
//     });

//     if (!project) throw new Error('Project not found');

//     if (format === 'json') {
//       return JSON.stringify(project, null, 2);
//     } else if (format === 'csv') {
//       // Convert to CSV format
//       return this.convertToCSV(project);
//     }

//     return project;
//   }

//   // Helper: Convert to CSV
//   convertToCSV(project) {
//     const headers = ['Field', 'Value'];
//     const rows = [];
    
//     for (const [key, value] of Object.entries(project.toJSON())) {
//       if (typeof value !== 'object') {
//         rows.push([key, value]);
//       }
//     }

//     const csv = [
//       headers.join(','),
//       ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
//     ].join('\n');

//     return csv;
//   }

//   // Clone project
//   async cloneProject(projectId, newTitle, userId) {
//     const originalProject = await Project.findByPk(projectId, {
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media'
//         }
//       ]
//     });

//     if (!originalProject) throw new Error('Project not found');

//     // Create new project data
//     const projectData = originalProject.toJSON();
//     delete projectData.projectId;
//     delete projectData.createdAt;
//     delete projectData.updatedAt;
//     delete projectData.publishedAt;
//     delete projectData.views;
//     delete projectData.likes;
//     delete projectData.shares;

//     projectData.title = newTitle || `Copy of ${projectData.title}`;
//     projectData.slug = `${projectData.slug}-copy-${Date.now()}`;
//     projectData.isPublished = false;
//     projectData.createdBy = userId;
//     projectData.status = 'planned';

//     const newProject = await Project.create(projectData);

//     // Clone media (copy files)
//     if (originalProject.media && originalProject.media.length > 0) {
//       for (const media of originalProject.media) {
//         const mediaData = media.toJSON();
//         delete mediaData.mediaId;
//         delete mediaData.createdAt;
//         delete mediaData.updatedAt;

//         // Copy physical file if local
//         if (mediaData.mediaUrl && !mediaData.mediaUrl.startsWith('http')) {
//           const sourcePath = path.join(__dirname, '..', mediaData.mediaUrl);
//           const targetFileName = path.basename(mediaData.mediaUrl);
//           const targetPath = path.join(__dirname, '../uploads/projects', newProject.projectId.toString(), targetFileName);
          
//           try {
//             await fs.mkdir(path.dirname(targetPath), { recursive: true });
//             await fs.copyFile(sourcePath, targetPath);
//             mediaData.mediaUrl = `/uploads/projects/${newProject.projectId}/${targetFileName}`;
//           } catch (err) {
//             console.error('Error copying media file:', err);
//           }
//         }

//         mediaData.projectId = newProject.projectId;
//         mediaData.uploadedBy = userId;
        
//         await ProjectMedia.create(mediaData);
//       }
//     }

//     return newProject;
//   }

//   // Get projects by technology
//   async getProjectsByTechnology(technology, limit = 10) {
//     return await Project.findAll({
//       where: {
//         isPublished: true,
//         technologies: { [Op.like]: `%${technology}%` }
//       },
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media',
//           where: { isFeatured: true },
//           required: false,
//           limit: 1
//         }
//       ],
//       order: [['createdAt', 'DESC']],
//       limit
//     });
//   }

//   // Generate project report
//   async generateProjectReport(projectId) {
//     const project = await Project.findByPk(projectId, {
//       include: [
//         {
//           model: ProjectMedia,
//           as: 'media'
//         },
//         {
//           model: User,
//           as: 'creator'
//         },
//         {
//           model: User,
//           as: 'manager'
//         }
//       ]
//     });

//     if (!project) throw new Error('Project not found');

//     const report = {
//       projectInfo: {
//         id: project.projectId,
//         title: project.title,
//         category: project.category,
//         status: project.status,
//         client: project.clientName,
//         startDate: project.startDate,
//         endDate: project.endDate,
//         duration: project.projectDuration
//       },
//       team: {
//         manager: project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : null,
//         teamSize: project.teamSize
//       },
//       technical: {
//         technologies: project.technologies,
//         kpis: project.kpis
//       },
//       metrics: {
//         views: project.views,
//         likes: project.likes,
//         shares: project.shares
//       },
//       content: {
//         challenge: project.challenge,
//         solution: project.solution,
//         results: project.results
//       }
//     };

//     return report;
//   }
// }

// module.exports = new ProjectService();