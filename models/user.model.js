// models/user.model.js
module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define('user', {
    userId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: Sequelize.STRING,
      allowNull: true // Nullable for OAuth users
    },
    role: {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'user', 
      validate: {
        isIn: [['user', 'admin', 'moderator']] 
      }
    },
    profilePicture: {
      type: Sequelize.STRING,
      allowNull: true
    },
    provider: {
      type: Sequelize.STRING,
      defaultValue: 'local',
      validate: {
        isIn: [['local', 'google', 'apple']]
      }
    },
    providerId: {
      type: Sequelize.STRING,
      allowNull: true
    },
    refreshToken: {
      type: Sequelize.STRING,
      allowNull: true
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    lastLoginAt: {
      type: Sequelize.DATE,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: (user) => {
        if (user.provider === 'local' && !user.password) {
          throw new Error('Password is required for local users');
        }
      }
    }
  });

  return User;
};


 