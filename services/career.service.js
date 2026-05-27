const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

class CareerService {
  constructor(models, sequelize = null) {
    console.log('🔧 CareerService constructor called');
    
    this.sequelize = sequelize;
    this._models = models;
    
    // Initialize models
    this.CareerJob = models.CareerJob;
    this.CareerApplication = models.CareerApplication;
    this.User = models.User || null;
    
    if (!this.CareerJob || !this.CareerApplication) {
      console.error('❌ Career models not found');
      throw new Error('Career models are required');
    }
    
    console.log('✅ CareerService initialized');
  }



  async getDashboardData() {
    try {
      console.log('📊 [SERVICE] Fetching dashboard data');
      
      // Get counts
      const totalJobs = await this.CareerJob.count({ where: { isActive: true } });
      const totalApplications = await this.CareerApplication.count();
      
      // Get applications by status
      const applicationsByStatus = await this.CareerApplication.findAll({
        attributes: [
          'status', 
          [this.sequelize.fn('COUNT', this.sequelize.col('status')), 'count']
        ],
        group: ['status'],
        raw: true
      });
      
      // Get recent applications
      const recentApplications = await this.CareerApplication.findAll({
        include: [{
          model: this.CareerJob,
          as: 'job',
          attributes: ['id', 'title', 'department']
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      // Get jobs with most applications
      const popularJobs = await this.CareerJob.findAll({
        where: { isActive: true },
        order: [['applicationsCount', 'DESC']],
        limit: 5,
        attributes: ['id', 'title', 'department', 'location', 'applicationsCount', 'viewsCount']
      });
      
      // Get remote jobs count
      const remoteJobs = await this.CareerJob.count({ 
        where: { 
          isActive: true,
          isRemote: true 
        } 
      });
      
      // Get featured jobs count (if you have this field)
      let featuredJobs = 0;
      try {
        featuredJobs = await this.CareerJob.count({ 
          where: { 
            isActive: true,
            isFeatured: true 
          } 
        });
      } catch (e) {
        // If isFeatured doesn't exist, just set to 0
        console.log('⚠️ isFeatured field may not exist:', e.message);
        featuredJobs = 0;
      }
      
      return {
        totals: {
          jobs: totalJobs,
          applications: totalApplications
        },
        applicationsByStatus,
        recentApplications,
        popularJobs,
        jobStats: {
          total: totalJobs,
          active: totalJobs,
          remote: remoteJobs,
          featured: featuredJobs
        }
      };
    } catch (error) {
      console.error('❌ [SERVICE] Error fetching dashboard data:', error);
      throw error;
    }
  }

  
  // ========== JOB METHODS ==========


  async createJob(jobData) {
    try {
      console.log('🎯 [CAREER SERVICE] createJob called');
      
      // Generate slug if not provided
      if (!jobData.slug && jobData.title) {
        jobData.slug = this.generateSlug(jobData.title);
      }
      
      // Ensure arrays are properly formatted for JSON storage
      // Sequelize will automatically stringify arrays for JSON fields
      const job = await this.CareerJob.create({
        ...jobData,
        // Make sure these are arrays (not strings)
        requirements: Array.isArray(jobData.requirements) ? jobData.requirements : [],
        responsibilities: Array.isArray(jobData.responsibilities) ? jobData.responsibilities : [],
        benefits: Array.isArray(jobData.benefits) ? jobData.benefits : [],
        keywords: Array.isArray(jobData.keywords) ? jobData.keywords : []
      });
      
      console.log('✅ Job created:', job.id);
      
      return await this.formatJobResponse(job);
    } catch (error) {
      console.error('❌ Error creating job:', error);
      
      if (error.name === 'SequelizeValidationError') {
        throw new Error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Job with this slug already exists');
      }
      
      throw new Error(`Error creating job: ${error.message}`);
    }
  }


  async getAllJobs(options = {}) {
  try {
    const {
      filters = {},
      pagination = { limit: 10, offset: 0 },
      sort = { by: 'createdAt', order: 'DESC' },
      search = null
    } = options;
    
    console.log('🔍 [SERVICE] getAllJobs with:', { filters, pagination, sort, search });
    
    // Build where clause
    const where = {};
    
    // Apply filters only if they exist
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        where[key] = value;
      }
    });
    
    // Add search if provided
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    
    console.log('🔍 [SERVICE] Final where clause:', where);
    
    // Get total count
    const count = await this.CareerJob.count({ where });
    
    // Get paginated results
    const data = await this.CareerJob.findAll({
      where,
      limit: pagination.limit,
      offset: pagination.offset,
      order: [[sort.by, sort.order]],
      attributes: { exclude: ['metadata'] } // Exclude heavy fields if needed
    });
    
    console.log(`✅ [SERVICE] Found ${count} jobs, returning ${data.length}`);
    
    return {
      count,
      data
    };
  } catch (error) {
    console.error('❌ [SERVICE] Error in getAllJobs:', error);
    throw error;
  }
}
 
  // async getAllJobs(options = {}) {
  //   try {
  //     const {
  //       filters = {},
  //       pagination = { limit: 10, offset: 0 },
  //       sort = { by: 'createdAt', order: 'DESC' },
  //       search = null
  //     } = options;
      
  //     // Build where clause
  //     const where = {};
      
  //     // Apply filters
  //     if (filters.isActive !== undefined) {
  //       where.isActive = filters.isActive;
  //     } else {
  //       where.isActive = true; // Default to active jobs
  //     }
      
  //     if (filters.department) {
  //       where.department = filters.department;
  //     }
      
  //     if (filters.location) {
  //       where.location = filters.location;
  //     }
      
  //     if (filters.employmentType) {
  //       where.employmentType = filters.employmentType;
  //     }
      
  //     if (filters.experienceLevel) {
  //       where.experienceLevel = filters.experienceLevel;
  //     }
      
  //     if (filters.isRemote !== undefined) {
  //       where.isRemote = filters.isRemote;
  //     }
      
  //     // Apply search
  //     if (search) {
  //       where[Op.or] = [
  //         { title: { [Op.like]: `%${search}%` } },
  //         { description: { [Op.like]: `%${search}%` } },
  //         { department: { [Op.like]: `%${search}%` } },
  //         { location: { [Op.like]: `%${search}%` } }
  //       ];
  //     }
      
  //     // Get total count
  //     const count = await this.CareerJob.count({ where });
      
  //     // Get paginated results
  //     const jobs = await this.CareerJob.findAll({
  //       where,
  //       limit: pagination.limit,
  //       offset: pagination.offset,
  //       order: [[sort.by, sort.order]]
  //     });
      
  //     // Format responses
  //     const formattedJobs = await Promise.all(
  //       jobs.map(job => this.formatJobResponse(job))
  //     );
      
  //     return {
  //       count,
  //       data: formattedJobs
  //     };
  //   } catch (error) {
  //     console.error('❌ Error fetching jobs:', error);
  //     throw new Error(`Error fetching jobs: ${error.message}`);
  //   }
  // }

  async getJobByIdOrSlug(identifier, incrementViews = true) {
    try {
      const where = isNaN(parseInt(identifier)) 
        ? { slug: identifier, isActive: true }
        : { id: identifier, isActive: true };
      
      const job = await this.CareerJob.findOne({ where });
      
      if (!job) {
        throw new Error('Job not found or not active');
      }
      
      // Increment views if requested
      if (incrementViews) {
        await job.increment('viewsCount', { by: 1 });
        job.viewsCount += 1;
      }
      
      return await this.formatJobResponse(job);
    } catch (error) {
      console.error('❌ Error fetching job:', error);
      throw new Error(`Error fetching job: ${error.message}`);
    }
  }

  async updateJob(jobId, jobData) {
    try {
      const job = await this.CareerJob.findByPk(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      // Update slug if title changed
      if (jobData.title && jobData.title !== job.title) {
        jobData.slug = this.generateSlug(jobData.title);
      }
      
      await job.update(jobData);
      return await this.formatJobResponse(job);
    } catch (error) {
      console.error('❌ Error updating job:', error);
      throw new Error(`Error updating job: ${error.message}`);
    }
  }

  async deleteJob(jobId) {
    try {
      const job = await this.CareerJob.findByPk(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      await job.destroy();
      return { message: 'Job deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting job:', error);
      throw new Error(`Error deleting job: ${error.message}`);
    }
  }

  async getJobStatistics() {
    try {
      const totalJobs = await this.CareerJob.count();
      const activeJobs = await this.CareerJob.count({ where: { isActive: true } });
      const totalApplications = await this.CareerApplication.count();
      
      // Get applications by status
      const applicationsByStatus = await this.CareerApplication.findAll({
        attributes: ['status', [this.sequelize.fn('COUNT', 'status'), 'count']],
        group: ['status'],
        raw: true
      });
      
      // Get jobs with most applications
      const popularJobs = await this.CareerJob.findAll({
        attributes: ['id', 'title', 'applicationsCount'],
        order: [['applicationsCount', 'DESC']],
        limit: 5
      });
      
      return {
        totals: {
          jobs: totalJobs,
          activeJobs: activeJobs,
          totalApplications: totalApplications
        },
        applicationsByStatus,
        popularJobs
      };
    } catch (error) {
      console.error('❌ Error getting job statistics:', error);
      throw new Error(`Error getting job statistics: ${error.message}`);
    }
  }

  // ========== APPLICATION METHODS ==========

  async createApplication(applicationData, resumeFile, userId = null) {
    try {
      console.log('🎯 [CAREER SERVICE] createApplication called');
      
      // Validate required fields
      const requiredFields = ['applicantName', 'email', 'resumeUrl', 'CareerJobId'];
      for (const field of requiredFields) {
        if (!applicationData[field]) {
          throw new Error(`${field} is required`);
        }
      }
      
      // Check if job exists and is active
      const job = await this.CareerJob.findOne({
        where: {
          id: applicationData.CareerJobId,
          isActive: true
        }
      });
      
      if (!job) {
        throw new Error('Job not found or not active');
      }
      
      // Check if application deadline has passed
      if (job.applicationDeadline && new Date(job.applicationDeadline) < new Date()) {
        throw new Error('Application deadline has passed');
      }
      
      // Check for duplicate application (same email for same job)
      const existingApplication = await this.CareerApplication.findOne({
        where: {
          email: applicationData.email,
          CareerJobId: applicationData.CareerJobId
        }
      });
      
      if (existingApplication) {
        throw new Error('You have already applied for this position');
      }
      
      // Add user ID if available
      if (userId) {
        applicationData.userId = userId;
      }
      
      // Add IP and user agent if available in applicationData
      applicationData.ipAddress = applicationData.ipAddress || null;
      applicationData.userAgent = applicationData.userAgent || null;
      
      // Create application
      const application = await this.CareerApplication.create(applicationData);
      
      // Increment applications count for the job
      await job.increment('applicationsCount', { by: 1 });
      
      console.log('✅ Application created:', application.id);
      
      return await this.formatApplicationResponse(application);
    } catch (error) {
      console.error('❌ Error creating application:', error);
      throw new Error(`Error creating application: ${error.message}`);
    }
  }

  async getAllApplications(options = {}) {
    try {
      const {
        filters = {},
        pagination = { limit: 20, offset: 0 },
        sort = { by: 'createdAt', order: 'DESC' },
        search = null
      } = options;
      
      // Build where clause
      const where = {};
      
      // Apply filters
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.CareerJobId) {
        where.CareerJobId = filters.CareerJobId;
      }
      
      if (filters.email) {
        where.email = filters.email;
      }
      
      if (filters.source) {
        where.source = filters.source;
      }
      
      // Apply search
      if (search) {
        where[Op.or] = [
          { applicantName: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { currentCompany: { [Op.like]: `%${search}%` } },
          { currentTitle: { [Op.like]: `%${search}%` } }
        ];
      }
      
      // Build include options
      const include = [{
        model: this.CareerJob,
        as: 'job',
        attributes: ['id', 'title', 'department', 'location']
      }];
      
      if (this.User) {
        include.push({
          model: this.User,
          as: 'user',
          attributes: ['userId', 'userName', 'email']
        });
      }
      
      // Get total count
      const count = await this.CareerApplication.count({ 
        where,
        include 
      });
      
      // Get paginated results
      const applications = await this.CareerApplication.findAll({
        where,
        include,
        limit: pagination.limit,
        offset: pagination.offset,
        order: [[sort.by, sort.order]]
      });
      
      // Format responses
      const formattedApplications = await Promise.all(
        applications.map(app => this.formatApplicationResponse(app))
      );
      
      return {
        count,
        data: formattedApplications
      };
    } catch (error) {
      console.error('❌ Error fetching applications:', error);
      throw new Error(`Error fetching applications: ${error.message}`);
    }
  }

  async getApplicationById(applicationId) {
    try {
      const include = [{
        model: this.CareerJob,
        as: 'job',
        attributes: ['id', 'title', 'department', 'location', 'employmentType']
      }];
      
      if (this.User) {
        include.push({
          model: this.User,
          as: 'user',
          attributes: ['userId', 'userName', 'email']
        });
      }
      
      const application = await this.CareerApplication.findByPk(applicationId, { include });
      
      if (!application) {
        throw new Error('Application not found');
      }
      
      return await this.formatApplicationResponse(application);
    } catch (error) {
      console.error('❌ Error fetching application:', error);
      throw new Error(`Error fetching application: ${error.message}`);
    }
  }

  async updateApplicationStatus(applicationId, status, notes = null) {
    try {
      const application = await this.CareerApplication.findByPk(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }
      
      const updateData = { status };
      if (notes !== null) {
        updateData.notes = notes;
      }
      
      await application.update(updateData);
      return await this.formatApplicationResponse(application);
    } catch (error) {
      console.error('❌ Error updating application status:', error);
      throw new Error(`Error updating application status: ${error.message}`);
    }
  }

  async getApplicationsByJobId(jobId) {
    try {
      const job = await this.CareerJob.findByPk(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      const applications = await this.CareerApplication.findAll({
        where: { CareerJobId: jobId },
        include: [{
          model: this.User,
          as: 'user',
          attributes: ['userId', 'userName', 'email']
        }],
        order: [['createdAt', 'DESC']]
      });
      
      return await Promise.all(
        applications.map(app => this.formatApplicationResponse(app))
      );
    } catch (error) {
      console.error('❌ Error fetching applications by job:', error);
      throw new Error(`Error fetching applications by job: ${error.message}`);
    }
  }

  async getApplicationsByEmail(email) {
    try {
      const applications = await this.CareerApplication.findAll({
        where: { email },
        include: [{
          model: this.CareerJob,
          as: 'job',
          attributes: ['id', 'title', 'department', 'location', 'isActive']
        }],
        order: [['createdAt', 'DESC']]
      });
      
      return await Promise.all(
        applications.map(app => this.formatApplicationResponse(app))
      );
    } catch (error) {
      console.error('❌ Error fetching applications by email:', error);
      throw new Error(`Error fetching applications by email: ${error.message}`);
    }
  }

  // ========== HELPER METHODS ==========

  generateSlug(title) {
    if (!title) return 'untitled-' + Date.now();
    return title.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async formatJobResponse(job) {
    if (!job) return null;
    
    const plainJob = job.get ? job.get({ plain: true }) : job;
    
    // Format salary range
    if (plainJob.salaryRangeMin || plainJob.salaryRangeMax) {
      plainJob.salaryFormatted = `${plainJob.salaryCurrency} ${plainJob.salaryRangeMin || 'N/A'} - ${plainJob.salaryRangeMax || 'N/A'}`;
    }
    
    // Format application deadline
    if (plainJob.applicationDeadline) {
      const deadline = new Date(plainJob.applicationDeadline);
      plainJob.applicationDeadlineFormatted = deadline.toLocaleDateString('en-UG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Calculate days remaining
      const today = new Date();
      const timeDiff = deadline.getTime() - today.getTime();
      plainJob.daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      if (plainJob.daysRemaining < 0) {
        plainJob.deadlineStatus = 'expired';
      } else if (plainJob.daysRemaining <= 7) {
        plainJob.deadlineStatus = 'urgent';
      } else {
        plainJob.deadlineStatus = 'active';
      }
    }
    
    // Parse JSON fields if they're strings
    if (typeof plainJob.requirements === 'string') {
      try {
        plainJob.requirements = JSON.parse(plainJob.requirements);
      } catch (e) {
        plainJob.requirements = [];
      }
    }
    
    if (typeof plainJob.responsibilities === 'string') {
      try {
        plainJob.responsibilities = JSON.parse(plainJob.responsibilities);
      } catch (e) {
        plainJob.responsibilities = [];
      }
    }
    
    if (typeof plainJob.benefits === 'string') {
      try {
        plainJob.benefits = JSON.parse(plainJob.benefits);
      } catch (e) {
        plainJob.benefits = [];
      }
    }
    
    // Format dates
    if (plainJob.createdAt) {
      plainJob.postedDate = new Date(plainJob.createdAt).toLocaleDateString('en-UG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
    
    return plainJob;
  }

  async formatApplicationResponse(application) {
    if (!application) return null;
    
    const plainApp = application.get ? application.get({ plain: true }) : application;
    
    // Format dates
    if (plainApp.createdAt) {
      plainApp.appliedDate = new Date(plainApp.createdAt).toLocaleDateString('en-UG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Format status with color
    const statusColors = {
      APPLIED: 'blue',
      REVIEWED: 'purple',
      SHORTLISTED: 'green',
      INTERVIEW_SCHEDULED: 'orange',
      INTERVIEWED: 'teal',
      OFFERED: 'success',
      REJECTED: 'red',
      WITHDRAWN: 'gray'
    };
    
    plainApp.statusColor = statusColors[plainApp.status] || 'gray';
    plainApp.statusLabel = plainApp.status.replace(/_/g, ' ');
    
    // Format salary expectation
    if (plainApp.salaryExpectation) {
      plainApp.salaryFormatted = new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: 'USD'
      }).format(plainApp.salaryExpectation);
    }
    
    // Format notice period
    if (plainApp.noticePeriod) {
      if (plainApp.noticePeriod <= 30) {
        plainApp.noticePeriodFormatted = `${plainApp.noticePeriod} days`;
      } else {
        const months = Math.floor(plainApp.noticePeriod / 30);
        plainApp.noticePeriodFormatted = `${months} month${months > 1 ? 's' : ''}`;
      }
    }
    
    return plainApp;
  }
}

module.exports = CareerService;


