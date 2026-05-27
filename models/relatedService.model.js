// models/relatedService.model.js
module.exports = (sequelize, Sequelize) => {
  const RelatedService = sequelize.define('relatedService', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    serviceId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    relatedServiceId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    createdAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  }, {
    tableName: 'related_services',
    timestamps: false
  });

  return RelatedService;
};

// // models/relatedService.model.js
// module.exports = (sequelize, Sequelize) => {
//   const RelatedService = sequelize.define('relatedService', {
//     id: {
//       type: Sequelize.INTEGER,
//       autoIncrement: true,
//       primaryKey: true
//     },
//     serviceId: {
//       type: Sequelize.INTEGER,
//       allowNull: false
//     },
//     relatedServiceId: {
//       type: Sequelize.INTEGER,
//       allowNull: false
//     },
//     createdAt: {
//       type: Sequelize.DATE,
//       defaultValue: Sequelize.NOW
//     }
//   }, {
//     tableName: 'related_services',
//     timestamps: false
//   });

//   return RelatedService;
// };

