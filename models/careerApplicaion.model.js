module.exports = (sequelize, DataTypes) => {
  const CareerApplication = sequelize.define('CareerApplication', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    applicantName: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    resumeUrl: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    coverLetter: {
      type: DataTypes.TEXT,
      allowNull: true
    }, 
    portfolioUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    linkedinUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    githubUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    currentCompany: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    currentTitle: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    yearsOfExperience: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    noticePeriod: {
      type: DataTypes.INTEGER,
      comment: 'In days',
      allowNull: true
    },
    salaryExpectation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM(
        'APPLIED',
        'REVIEWED',
        'SHORTLISTED',
        'INTERVIEW_SCHEDULED',
        'INTERVIEWED',
        'OFFERED',
        'REJECTED',
        'WITHDRAWN'
      ),
      defaultValue: 'APPLIED'
    },
    source: {
      type: DataTypes.ENUM(
        'CAREER_PAGE',
        'LINKEDIN',
        'INDEED',
        'GLASSDOOR',
        'REFERRAL',
        'OTHER'
      ),
      defaultValue: 'CAREER_PAGE'
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    consentDataProcessing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    consentPrivacyPolicy: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'Applications',
    timestamps: true,
    indexes: [
      {
        fields: ['email']
      },
      {
        fields: ['status']
      },
      {
        fields: ['CareerJobId']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return CareerApplication;
};
 

