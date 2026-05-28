const setupAssociations = (models) => {
  const {
    User,
    Product,
    Category,
    Cart,
    Wishlist,
    Order,
    Comparison,
    Service,
    RelatedService,
    Blog,
    CareerJob,
    CareerApplication,
    Project,
    ProjectMedia
  } = models;
  
  // Product associations
  Product.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  });
  
  Product.belongsTo(Category, {
    foreignKey: 'subCategoryId',
    as: 'subCategory',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  });

  // Category associations
  Category.hasMany(Product, {
    foreignKey: 'categoryId',
    as: 'products'
  });
  
  Category.hasMany(Category, {
    foreignKey: 'parentId',
    as: 'subCategories'
  });
  
  Category.belongsTo(Category, {
    foreignKey: 'parentId',
    as: 'parentCategory'
  });

  // Cart associations
  Cart.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // Wishlist associations
  Wishlist.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // Order associations
  Order.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  // Comparison associations
  Comparison.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  Comparison.belongsTo(Category, {
    foreignKey: 'categoryId',
    as: 'category'
  });

  // User associations
  User.hasOne(Cart, {
    foreignKey: 'userId',
    as: 'cart'
  });
  
  User.hasMany(Wishlist, {
    foreignKey: 'userId',
    as: 'wishlists'
  });
  
  User.hasMany(Order, {
    foreignKey: 'userId',
    as: 'orders'
  });
  
  User.hasMany(Comparison, {
    foreignKey: 'userId',
    as: 'comparisons'
  });

  // Service associations
  Service.belongsToMany(Service, {
    through: RelatedService,
    as: 'relatedServices',
    foreignKey: 'serviceId',
    otherKey: 'relatedServiceId'
  });

  Service.belongsToMany(Service, {
    through: RelatedService,
    as: 'servicesRelatedTo',
    foreignKey: 'relatedServiceId',
    otherKey: 'serviceId'
  });

  RelatedService.belongsTo(Service, { 
    foreignKey: 'serviceId', 
    as: 'service'
  });
  
  RelatedService.belongsTo(Service, { 
    foreignKey: 'relatedServiceId', 
    as: 'relatedService' 
  });

  // Blog associations with User (Author)
  Blog.belongsTo(User, {
    foreignKey: 'authorId',
    as: 'author'
  });

  User.hasMany(Blog, {
    foreignKey: 'authorId',
    as: 'blogs'
  });
 
  //CareerJob association
  CareerJob.hasMany(CareerApplication, {
    foreignKey: 'careerJobId',
    as: 'applications'
  });

  CareerApplication.belongsTo(CareerJob, {
    foreignKey: 'careerJobId',
    as: 'job'
  });
 
  //CareerApplication association with user
  CareerApplication.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    allowNull: true
  });

  User.hasMany(CareerApplication, {
    foreignKey: 'userId',
    as: 'careerApplications'
  }); 


  // Project belongs to User (creator)
  Project.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'creator'
  });

  // Project belongs to User (manager)
  Project.belongsTo(User, {
    foreignKey: 'projectManager',
    as: 'manager'
  });

  // Project belongs to User (approver)
  Project.belongsTo(User, {
    foreignKey: 'approvedBy',
    as: 'approver'
  });

  // Project belongs to User (updater)
  Project.belongsTo(User, {
    foreignKey: 'updatedBy',
    as: 'updater'
  });

  // User has many projects (as creator)
  User.hasMany(Project, {
    foreignKey: 'createdBy',
    as: 'createdProjects'
  });

  // User has many projects (as manager)
  User.hasMany(Project, {
    foreignKey: 'projectManager',
    as: 'managedProjects'
  });

  // Project has many media
  Project.hasMany(ProjectMedia, {
    foreignKey: 'projectId',
    as: 'media',
    onDelete: 'CASCADE'
  });

  // ProjectMedia belongs to Project
  ProjectMedia.belongsTo(Project, {
    foreignKey: 'projectId',
    as: 'project'
  });

  // ProjectMedia belongs to User (uploader)
  ProjectMedia.belongsTo(User, {
    foreignKey: 'uploadedBy',
    as: 'uploader'
  });

  // User has many project media uploads
  User.hasMany(ProjectMedia, {
    foreignKey: 'uploadedBy',
    as: 'uploadedProjectMedia'
  });

  return models;
};

module.exports = setupAssociations;



