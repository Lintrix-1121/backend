module.exports = (sequelize, Sequelize) => {
  const Project = sequelize.define('project', {
    projectId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: Sequelize.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Project title is required'
        },
        len: {
          args: [3, 200],
          msg: 'Title must be between 3 and 200 characters'
        }
      }
    },
    slug: {
      type: Sequelize.STRING(250),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    clientName: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    clientIndustry: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    category: {
      type: Sequelize.ENUM(
        'IoT',
        'Electronics',
        'Mobile apps',
        'Web apps',
        'Installations',
        'Networking',
        'Embedded Systems',
        'Software Development',
        'ICT Infrastructure',
        'Security Systems',
        'Cloud Computing',
        'AI/ML',
        'Blockchain',
        'Robotics',
        'Telecommunications',
        'Data Center',
        'IT Consulting',
        'Hardware Design',
        'Firmware Development',
        'System Integration'
      ),
      allowNull: false,
      defaultValue: 'Software Development'
    },
    subCategory: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    shortDescription: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    fullDescription: {
      type: Sequelize.TEXT('long'),
      allowNull: false
    },
    challenge: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Problem statement or challenge addressed'
    },
    solution: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Solution implemented'
    },
    results: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Key results and achievements'
    },
    technologies: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Technologies, frameworks, tools used'
    },
    teamSize: {
      type: Sequelize.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    projectDuration: {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'e.g., "3 months", "1 year"'
    },
    startDate: {
      type: Sequelize.DATEONLY,
      allowNull: true
    },
    endDate: {
      type: Sequelize.DATEONLY,
      allowNull: true
    },
    projectUrl: {
      type: Sequelize.STRING(500),
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Please provide a valid URL'
        }
      }
    },
    githubUrl: {
      type: Sequelize.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    demoUrl: {
      type: Sequelize.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    featuredImage: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    galleryImages: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of image URLs/paths'
    },
    videos: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of video URLs (YouTube, Vimeo, or local)'
    },
    videoThumbnails: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Thumbnails for videos'
    },
    documents: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Related documents (PDFs, specs, etc.)'
    },
    clientTestimonial: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    testimonialAuthor: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    testimonialPosition: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    projectManager: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    teamMembers: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of user IDs'
    },
    stakeholders: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Key stakeholders'
    },
    budget: {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Project budget if applicable'
    },
    currency: {
      type: Sequelize.STRING(3),
      defaultValue: 'USD'
    },
    roi: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Return on investment metrics'
    },
    kpis: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Key performance indicators and their values'
    },
    isConfidential: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'If true, hide sensitive information'
    },
    confidentialityNotice: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    status: {
      type: Sequelize.ENUM('planned', 'in-progress', 'completed', 'on-hold', 'cancelled', 'maintenance'),
      defaultValue: 'planned'
    },
    completionPercentage: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    milestones: {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Project milestones and their status'
    },
    priority: {
      type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'medium'
    },
    isFeatured: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    isPublished: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    publishedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    views: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    likes: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    shares: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    metaTitle: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    metaDescription: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    metaKeywords: {
      type: Sequelize.STRING(300),
      allowNull: true
    },
    tags: {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: []
    },
    location: {
      type: Sequelize.STRING(200),
      allowNull: true
    },
    country: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    notes: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    createdBy: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    updatedBy: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    approvedBy: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    approvedAt: {
      type: Sequelize.DATE,
      allowNull: true
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updatedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  }, {
    tableName: 'projects',
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
      {
        unique: true,
        fields: ['slug']
      },
      {
        fields: ['category']
      },
      {
        fields: ['status']
      },
      {
        fields: ['isFeatured']
      },
      {
        fields: ['isPublished']
      },
      {
        fields: ['publishedAt']
      },
      {
        fields: ['projectManager']
      },
      {
        fields: ['createdBy']
      },
      {
        fields: ['clientName']
      },
      {
        fields: ['priority']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return Project;
};