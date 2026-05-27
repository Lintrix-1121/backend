// models/service.model.js
module.exports = (sequelize, Sequelize) => {
  const Service = sequelize.define('service', {
    serviceId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    subTitle: {
      type: Sequelize.STRING(300),
      allowNull: true
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    icon: {
      type: Sequelize.STRING(100),
      allowNull: true
    },
    image: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    order: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
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
    tableName: 'services',
    timestamps: true
  });

  return Service;
};


