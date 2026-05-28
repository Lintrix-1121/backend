module.exports = (sequelize, DataTypes) => {
  const CareerJob = sequelize.define('CareerJob', {
    careerJobId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(250),
      unique: true,
      allowNull: false
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    employmentType: {
      type: DataTypes.ENUM(
        'FULL_TIME',
        'PART_TIME',
        'CONTRACT',
        'INTERNSHIP',
        'REMOTE',
        'HYBRID'
      ),
      defaultValue: 'FULL_TIME'
    },
    experienceLevel: {
      type: DataTypes.ENUM(
        'ENTRY',
        'JUNIOR',
        'MID',
        'SENIOR',
        'LEAD',
        'MANAGER',
        'DIRECTOR'
      ),
      defaultValue: 'MID'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    requirements: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    responsibilities: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    benefits: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    salaryRangeMin: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    salaryRangeMax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    salaryCurrency: {
      type: DataTypes.STRING(3),
      defaultValue: 'UGX'
    },
    applicationDeadline: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isRemote: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    numberOfOpenings: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    viewsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    applicationsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    keywords: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  }, {
    tableName: 'careerJobs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['slug']
      },
      {
        fields: ['department']
      },
      {
        fields: ['location']
      },
      {
        fields: ['employmentType']
      },
      {
        fields: ['experienceLevel']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return CareerJob;
}; 

