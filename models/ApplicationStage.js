module.exports = (sequelize, DataTypes) => {
  const CareerApplicationStage = sequelize.define('CareerApplicationStage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stage: {
      type: DataTypes.ENUM(
        'SCREENING',
        'HR_INTERVIEW',
        'TECHNICAL_INTERVIEW',
        'FINAL_INTERVIEW',
        'ASSESSMENT',
        'REFERENCE_CHECK',
        'OFFER'
      ),
      allowNull: false
    },
    status: { 
      type: DataTypes.ENUM('PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'),
      defaultValue: 'PENDING'
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    interviewer: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    interviewType: {
      type: DataTypes.ENUM('PHONE', 'VIDEO', 'IN_PERSON', 'ASSIGNMENT'),
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      comment: 'Duration in minutes',
      allowNull: true
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5
      },
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attachmentUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'career_application_stages',
    timestamps: true,
    indexes: [
      {
        fields: ['CareerApplicationId']
      },
      {
        fields: ['stage']
      },
      {
        fields: ['status']
      },
      {
        fields: ['scheduledDate']
      }
    ]
  });

  return CareerApplicationStage;
};


