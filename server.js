const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(helmet());

// FILE UPLOAD CONFIGURATION
const uploadDir = 'uploads';
const productUploadDir = path.join(uploadDir, 'products');
const serviceUploadDir = path.join(uploadDir, 'services');
const blogUploadDir = path.join(uploadDir, 'blogs');
const careerUploadDir = path.join(uploadDir, 'careers');
const resumeUploadDir = path.join(careerUploadDir, 'resumes');
const projectUploadDir = path.join(uploadDir, 'projects');
const projectImageDir = path.join(projectUploadDir, 'images');
const projectVideoDir = path.join(projectUploadDir, 'videos');
const projectDocsDir = path.join(projectUploadDir, 'documents');

// Create directories if they don't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created upload directory: ${uploadDir}`);
}
[productUploadDir, serviceUploadDir, blogUploadDir, careerUploadDir, resumeUploadDir,
 projectUploadDir, projectImageDir, projectVideoDir, projectDocsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created ${dir}`);
  }
});

// Middleware for uploads directory
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'require-corp');
  res.header('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration
const corsOptions = {
  origin: [
    'https://logiphix.tech',
    'https://www.logiphix.tech',
    'https://api.logiphix.tech',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Session-ID', 'X-User-ID', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers', 'Cache-Control', 'Pragma', 'If-Modified-Since'],
  exposedHeaders: ['Content-Length', 'Authorization', 'Cache-Control', 'Content-Language', 'Content-Type', 'Expires', 'Last-Modified', 'Pragma'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const sequelize = require('./configs/db.config');

console.log('=== Database Models Initialization ===');

// Import models
const models = {
  User: require('./models/user.model')(sequelize, sequelize.Sequelize),
  Product: require('./models/product.model')(sequelize, sequelize.Sequelize),
  Category: require('./models/category.model')(sequelize, sequelize.Sequelize),
  Cart: require('./models/cart.model')(sequelize, sequelize.Sequelize),
  Wishlist: require('./models/wishlist.model')(sequelize, sequelize.Sequelize),
  Order: require('./models/order.model')(sequelize, sequelize.Sequelize),
  Comparison: require('./models/comparison.model')(sequelize, sequelize.Sequelize),
  Service: require('./models/service.model')(sequelize, sequelize.Sequelize),
  RelatedService: require('./models/relatedService.model')(sequelize, sequelize.Sequelize),
  Blog: require('./models/blog.model')(sequelize, sequelize.Sequelize),
  CareerJob: require('./models/career.model')(sequelize, sequelize.Sequelize),
  CareerApplication: require('./models/careerApplicaion.model')(sequelize, sequelize.Sequelize),
  Project: require('./models/project.model')(sequelize, sequelize.Sequelize),
  ProjectMedia: require('./models/projectMedia.model')(sequelize, sequelize.Sequelize)
};

models.sequelize = sequelize;
models.Sequelize = sequelize.Sequelize;

console.log('Models loaded:', Object.keys(models).filter(key => !['sequelize', 'Sequelize'].includes(key)));

// Setup associations
const setupAssociations = require('./models/associations');
setupAssociations(models);
console.log('✅ Associations set up');

// Initialize services
const UserService = require('./services/user.service');
const CartService = require('./services/cart.service');
const ServiceService = require('./services/service.service');
const BlogService = require('./services/blog.service');
const CareerService = require('./services/career.service');
const ProjectService = require('./services/project.service');

const userService = new UserService(models);
const cartService = new CartService(models);
const serviceService = new ServiceService(models, sequelize);
const blogService = new BlogService(models, sequelize);
const careerService = new CareerService(models, sequelize);
const projectService = new ProjectService(models, sequelize);

// Initialize controllers
const ProductController = require('./controllers/product.controller');
const UserController = require('./controllers/user.controller');
const AuthController = require('./controllers/auth.controller');
const ServiceController = require('./controllers/service.controller');
const BlogController = require('./controllers/blog.controller');
const CareerController = require('./controllers/career.controller');
const AdminController = require('./controllers/admin.controller');
const ProjectController = require('./controllers/project.controller');

const productController = new ProductController(models);
const userController = new UserController(userService);
const authController = new AuthController(userService);
const serviceController = new ServiceController(serviceService);
const blogController = new BlogController(blogService);
const careerController = new CareerController(careerService);
const adminController = new AdminController(userService);
const projectController = new ProjectController(models, projectService);

console.log('✅ All controllers initialized');

// Additional CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-User-ID');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Test routes
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is working!', models: Object.keys(models).filter(k => !['sequelize', 'Sequelize'].includes(k)), timestamp: new Date().toISOString() });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const categoryCount = await models.Category.count();
    const productCount = await models.Product.count();
    const serviceCount = await models.Service.count();
    const blogCount = await models.Blog.count();
    const careerJobCount = await models.CareerJob.count();
    const careerApplicationCount = await models.CareerApplication.count();
    res.json({ success: true, message: 'Database connection successful', counts: { categories: categoryCount || 0, products: productCount || 0, services: serviceCount || 0, blogs: blogCount || 0, careerJobs: careerJobCount || 0, careerApplications: careerApplicationCount || 0 } });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ success: false, message: 'Database test failed', error: error.message });
  }
});

app.get('/api/services/test', async (req, res) => {
  try {
    res.json({ success: true, message: 'Services test endpoint (no auth)', data: { count: 0, services: [], message: 'Services API is working' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/careers/test', async (req, res) => {
  try {
    res.json({ success: true, message: 'Career API test endpoint (no auth)', data: { jobs: [], applications: [], message: 'Career API is working' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/register/test', async (req, res) => {
  try {
    const { userName, email, password } = req.body;
    if (!userName || !email || !password) return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    const user = await models.User.create({ userName, email, password, provider: 'local', isActive: true });
    const userResponse = user.toJSON();
    delete userResponse.password;
    res.json({ success: true, message: 'User created successfully (test endpoint)', data: userResponse });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'User with this email already exists' });
    res.status(500).json({ success: false, message: 'Registration failed', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

app.post('/api/auth/login/test', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    const user = await models.User.findOne({ where: { email, isActive: true } });
    if (!user || user.password !== password) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    const userResponse = user.toJSON();
    delete userResponse.password;
    res.json({ success: true, message: 'Login successful (test endpoint)', data: { user: userResponse, accessToken: 'test-jwt-token-for-development-only' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Import route modules
const createServiceRoutes = require('./routes/service.routes');
const serviceUploadUtil = require('./utils/serviceUpload.util');
const createBlogRoutes = require('./routes/blog.route');
const createProductRoutes = require('./routes/product.routes');
const createAuthRoutes = require('./routes/auth.routes');
const authMiddleware = require('./controllers/auth.middleware');
const createCareerRoutes = require('./routes/career.routes');
const createProjectRoutes = require('./routes/project.routes');
const projectUploadUtil = require('./utils/projectUploadUtil');
const blogUploadUtil = require('./utils/blogUpload.util');

const serviceRouter = createServiceRoutes(serviceController, serviceUploadUtil.getSingleUploadMiddleware('image'));
const blogRouter = createBlogRoutes(blogController);
const projectRouter = createProjectRoutes(projectController, authMiddleware);
const productRouter = createProductRoutes(productController);
const authRouter = createAuthRoutes(authController);
const careerRouter = createCareerRoutes(careerController, authMiddleware);
const adminRoutes = require('./routes/admin.route')(adminController);

app.use('/api/careers', careerRouter.public);
app.use('/api/auth', authRouter);
app.use('/api/services', serviceRouter);
app.use('/api/blogs', blogRouter);
app.use('/api/projects', projectRouter.public);
app.use('/api/admin/projects', authMiddleware.authenticate, projectRouter.protected);
app.use('/api', productRouter);
app.use('/api/careers', careerRouter.protected);
app.use('/api/admin', authMiddleware.authenticate, adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  console.error('Error stack:', err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.path });
});

const PORT = process.env.PORT || 2090;

// ===================== FIXED DATABASE SYNC FUNCTION =====================
// This creates tables in the correct order and avoids foreign key errors
const syncDatabaseInOrder = async () => {
  console.log('🔄 Starting database sync (ordered)...');

  // Step 1: Create base tables that have no foreign keys (or only self-references)
  await models.Category.sync({ alter: false, force: false });
  console.log('✅ Category table synced');

  await models.User.sync({ alter: false, force: false });
  console.log('✅ User table synced');

  // Step 2: Create tables that depend only on the above
  await models.Blog.sync({ alter: false, force: false });
  console.log('✅ Blog table synced');

  await models.CareerJob.sync({ alter: false, force: false });
  console.log('✅ CareerJob table synced');

  await models.CareerApplication.sync({ alter: false, force: false });
  console.log('✅ CareerApplication table synced');

  await models.Service.sync({ alter: false, force: false });
  console.log('✅ Service table synced');

  await models.Project.sync({ alter: false, force: false });
  console.log('✅ Project table synced');

  await models.ProjectMedia.sync({ alter: false, force: false });
  console.log('✅ ProjectMedia table synced');

  // Step 3: Create Product (depends on Category)
  await models.Product.sync({ alter: false, force: false });
  console.log('✅ Product table synced');

  // Step 4: Create other dependent tables
  await models.Cart.sync({ alter: false, force: false });
  console.log('✅ Cart table synced');

  await models.Order.sync({ alter: false, force: false });
  console.log('✅ Order table synced');

  await models.Wishlist.sync({ alter: false, force: false });
  console.log('✅ Wishlist table synced');

  await models.Comparison.sync({ alter: false, force: false });
  console.log('✅ Comparison table synced');

  await models.RelatedService.sync({ alter: false, force: false });
  console.log('✅ RelatedService table synced');

  console.log('✅ All tables synced successfully (ordered)');
};

// ===================== DIAGNOSTIC ENDPOINTS =====================
app.get('/api/diagnose/service', async (req, res) => {
  try {
    const modelLoaded = !!models.Service;
    let tableExists = false;
    let tableColumns = [];
    try {
      const [tables] = await sequelize.query("SHOW TABLES LIKE 'services'");
      tableExists = tables.length > 0;
      if (tableExists) {
        const [columns] = await sequelize.query("DESCRIBE services");
        tableColumns = columns.map(col => col.Field);
      }
    } catch (dbError) { console.log('DB error:', dbError.message); }
    let queryTest = null;
    if (modelLoaded && tableExists) {
      try { queryTest = await models.Service.findAll({ limit: 5 }); } catch (qe) { queryTest = { error: qe.message }; }
    }
    res.json({ success: true, diagnosis: { model: { loaded: modelLoaded, details: modelLoaded ? { name: models.Service.name, tableName: models.Service.tableName, rawAttributes: Object.keys(models.Service.rawAttributes) } : null }, database: { tableExists, columns: tableColumns, columnCount: tableColumns.length }, queryTest: { success: queryTest && !queryTest.error, result: queryTest && !queryTest.error ? `${queryTest.length} services found` : queryTest?.error || 'Not tested' } }, recommendations: tableExists ? [] : ['Services table does not exist. Run the sync function.'] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/diagnose/career', async (req, res) => {
  try {
    const careerJobLoaded = !!models.CareerJob;
    const careerAppLoaded = !!models.CareerApplication;
    let careerJobTableExists = false, careerAppTableExists = false;
    try {
      const [careerTables] = await sequelize.query("SHOW TABLES LIKE 'careerJobs'");
      careerJobTableExists = careerTables.length > 0;
      const [appTables] = await sequelize.query("SHOW TABLES LIKE 'Applications'");
      careerAppTableExists = appTables.length > 0;
    } catch (dbError) { console.log('DB error:', dbError.message); }
    let jobQueryTest = null;
    if (careerJobLoaded && careerJobTableExists) {
      try { jobQueryTest = await models.CareerJob.findAll({ limit: 5 }); } catch (qe) { jobQueryTest = { error: qe.message }; }
    }
    res.json({ success: true, diagnosis: { models: { CareerJob: { loaded: careerJobLoaded, name: models.CareerJob?.name, tableName: models.CareerJob?.tableName }, CareerApplication: { loaded: careerAppLoaded, name: models.CareerApplication?.name, tableName: models.CareerApplication?.tableName } }, database: { careerjobs_table: careerJobTableExists, Applications_table: careerAppTableExists }, jobQueryTest: { success: jobQueryTest && !jobQueryTest.error, result: jobQueryTest && !jobQueryTest.error ? `${jobQueryTest.length} career jobs found` : jobQueryTest?.error || 'Not tested' } } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== START SERVER =====================
const startServer = async () => {
  try {
    await syncDatabaseInOrder();   // <-- FIXED: creates tables in dependency order

    // Verify counts
    const categoryCount = await models.Category.count();
    const productCount = await models.Product.count();
    const userCount = await models.User.count();
    const serviceCount = await models.Service.count();
    const careerJobCount = await models.CareerJob.count();
    const careerAppCount = await models.CareerApplication.count();

    console.log(`📊 Categories: ${categoryCount}, Products: ${productCount}, Users: ${userCount}`);
    console.log(`🔧 Services: ${serviceCount}, 💼 Career Jobs: ${careerJobCount}, 📄 Applications: ${careerAppCount}`);

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend: http://localhost:5173`);
      console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
      console.log(`\n✅ All database tables are ready. No foreign key errors.`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err.message);
    // Fallback: start server anyway for API testing (some routes may fail if tables missing)
    app.listen(PORT, () => {
      console.log(`\n⚠️ Server running on port ${PORT} (with errors - check logs)`);
      console.log(`📋 Test endpoints: /api/health, /api/diagnose/career, /api/diagnose/service`);
    });
  }
};

startServer();






// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const morgan = require('morgan');
// const cookieParser = require('cookie-parser');
// require('dotenv').config();
// const path = require('path');
// const fs = require('fs');

// const app = express();

// // Middleware
// app.use(helmet());


// // FILE UPLOAD CONFIGURATION 

// const uploadDir = 'uploads'; 
// const productUploadDir = path.join(uploadDir, 'products');
// const serviceUploadDir = path.join(uploadDir, 'services'); 
// const blogUploadDir = path.join(uploadDir, 'blogs');
// const careerUploadDir = path.join(uploadDir, 'careers');
// const resumeUploadDir = path.join(careerUploadDir, 'resumes');
// const projectUploadDir = path.join(uploadDir, 'projects');
// const projectImageDir = path.join(projectUploadDir, 'images');
// const projectVideoDir = path.join(projectUploadDir, 'videos');
// const projectDocsDir = path.join(projectUploadDir, 'documents');

// // Create directories if they don't exist
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, {recursive: true});
//   console.log(`✅ Created upload directory: ${uploadDir}`);
// }

// if (!fs.existsSync(productUploadDir)) {
//   fs.mkdirSync(productUploadDir, {recursive: true});
//   console.log(`✅ Created product upload directory: ${productUploadDir}`);
// }

// if (!fs.existsSync(serviceUploadDir)) {
//   fs.mkdirSync(serviceUploadDir, {recursive: true});
//   console.log(`✅ Created service upload directory: ${serviceUploadDir}`);
// }

// if (!fs.existsSync(blogUploadDir)) {
//   fs.mkdirSync(blogUploadDir, {recursive: true});
//   console.log(`✅ Created blog upload directory: ${blogUploadDir}`);
// }

// if (!fs.existsSync(careerUploadDir)) {
//   fs.mkdirSync(careerUploadDir, {recursive: true});
//   console.log(`✅ Created career upload directory: ${careerUploadDir}`);
// }

// if (!fs.existsSync(resumeUploadDir)) {
//   fs.mkdirSync(resumeUploadDir, {recursive: true});
//   console.log(`✅ Created resume upload directory: ${resumeUploadDir}`);
// }

// if (!fs.existsSync(projectUploadDir, 'projects')) {
//   fs.mkdirSync(projectUploadDir, { recursive: true });
//   console.log(`Created project upload directory: ${projectUploadDir}`);
// }

// if (!fs.existsSync(projectImageDir)) {
//   fs.mkdirSync(projectImageDir, {recursive: true});
//   console.log(`Created project images upload directory: ${projectImageDir}`);
// }

// if (!fs.existsSync(projectVideoDir)) {
//   fs.mkdirSync(projectVideoDir, { recursive: true });
//   console.log(`Created project videos directory: ${projectVideoDir}`);
// }

// if (!fs.existsSync(projectDocsDir)) {
//   fs.mkdirSync(projectDocsDir, {recursive: true });
//   console.log(`Created project Docs directory: ${projectDocsDir}`);
// }

// // Middleware for uploads directory
// app.use('/uploads', (req, res, next) => {
//   // Set headers for CORS
//   res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
//   res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Cross-Origin-Resource-Policy', 'cross-origin');
//   res.header('Cross-Origin-Embedder-Policy', 'require-corp');
//   res.header('Cross-Origin-Opener-Policy', 'same-origin');
  
//   // Handle preflight
//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }
  
//   next();
// });

// // Serve uploaded files statically
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// //REST OF THE SERVER CONFIGURATION 

// const corsOptions = {
//   origin: ['http://localhost:5173', 'http://localhost:2090'],
//   credentials: true, // Allow cookies
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//   allowedHeaders: [
//     'Content-Type',
//     'Authorization',
//     'X-Requested-With',
//     'X-Session-ID',
//     'X-User-ID',
//     'Accept',
//     'Origin',
//     'Access-Control-Request-Method',
//     'Access-Control-Request-Headers',
//     'Cache-Control', 
//     'Pragma',
//     'If-Modified-Since' 
//   ],
//   exposedHeaders: [
//     'Content-Length',
//     'Authorization',
//     'Cache-Control',
//     'Content-Language',
//     'Content-Type',
//     'Expires',
//     'Last-Modified',
//     'Pragma'
//   ],
//   maxAge: 86400, // 24 hours
//   preflightContinue: false,
//   optionsSuccessStatus: 204
// };

// app.use(cors(corsOptions));

// app.use(morgan('dev'));
// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Database connection
// const sequelize = require('./configs/db.config');

// console.log('=== Database Models Initialization ===');

// // Import models
// const models = { 
//   User: require('./models/user.model')(sequelize, sequelize.Sequelize),
//   Product: require('./models/product.model')(sequelize, sequelize.Sequelize),
//   Category: require('./models/category.model')(sequelize, sequelize.Sequelize),
//   Cart: require('./models/cart.model')(sequelize, sequelize.Sequelize),
//   Wishlist: require('./models/wishlist.model')(sequelize, sequelize.Sequelize),
//   Order: require('./models/order.model')(sequelize, sequelize.Sequelize),
//   Comparison: require('./models/comparison.model')(sequelize, sequelize.Sequelize),
//   Service: require('./models/service.model')(sequelize, sequelize.Sequelize),
//   RelatedService: require('./models/relatedService.model')(sequelize, sequelize.Sequelize),
//   Blog: require('./models/blog.model')(sequelize, sequelize.Sequelize),
//   CareerJob: require('./models/career.model')(sequelize, sequelize.Sequelize),
//   CareerApplication: require('./models/careerApplicaion.model')(sequelize, sequelize.Sequelize),
//   Project: require('./models/project.model')(sequelize, sequelize.Sequelize),
//   ProjectMedia: require('./models/projectMedia.model')(sequelize, sequelize.Sequelize)
// };

// // Add sequelize instances to models
// models.sequelize = sequelize;
// models.Sequelize = sequelize.Sequelize;

// console.log('Models loaded:', Object.keys(models).filter(key => !['sequelize', 'Sequelize'].includes(key)));

// console.log('🔍 Service Model Details:', {
//   name: models.Service?.name,
//   tableName: models.Service?.tableName,
//   prototype: Object.getPrototypeOf(models.Service).constructor.name
// });

// console.log('🔍 CareerJob Model Details:', {
//   name: models.CareerJob?.name,
//   tableName: models.CareerJob?.tableName,
//   hasId: !!models.CareerJob?.rawAttributes?.id
// });

// console.log('🔍 CareerApplication Model Details:', {
//   name: models.CareerApplication?.name,
//   tableName: models.CareerApplication?.tableName
// });



// // Setup associations
// const setupAssociations = require('./models/associations');
// setupAssociations(models);
// console.log(' Associations set up');



// //VERIFY Blog model has User association
// console.log('🔍 Verifying Blog-User association...');
// console.log('📊 Blog model associations:', Object.keys(models.Blog.associations || {}));
// console.log('📊 User model associations:', Object.keys(models.User.associations || {}));

// // Check if User model has findByPk method
// console.log('🧪 User model check:', {
//   hasFindByPk: typeof models.User.findByPk === 'function',
//   isModel: models.User.name === 'User',
//   prototype: Object.getPrototypeOf(models.User).constructor.name
// });

// // Test the association WITHOUT async/await
// models.Blog.findOne({
//   include: [{ model: models.User, as: 'author' }]
// })
//   .then(testBlog => {
//     if (testBlog) {
//       console.log('✅ Blog-User association test passed');
//     } else {
//       console.log('⚠️ No test blog found, but association should be set up');
//     }
//   })
//   .catch(error => {
//     console.error('❌ Association test error:', error.message);
//   });

// // Initialize ALL services 
// const UserService = require('./services/user.service');
// const CartService = require('./services/cart.service');
// const ServiceService = require('./services/service.service'); 
// const BlogService = require('./services/blog.service');
// const CareerService = require('./services/career.service'); 
// const ProjectService = require('./services/project.service');

// // Create services
// const userService = new UserService(models);
// const cartService = new CartService(models);
// const serviceService = new ServiceService(models, sequelize); 
// const blogService = new BlogService(models, sequelize);
// const careerService = new CareerService(models, sequelize); 
// const projectService = new ProjectService(models, sequelize);

// // Initialize controllers - ADD CAREER CONTROLLER
// const ProductController = require('./controllers/product.controller');
// const UserController = require('./controllers/user.controller');
// const AuthController = require('./controllers/auth.controller');
// const ServiceController = require('./controllers/service.controller'); 
// const BlogController = require('./controllers/blog.controller');
// const CareerController = require('./controllers/career.controller'); // Add this line
// const AdminController = require('./controllers/admin.controller');
// const ProjectController = require('./controllers/project.controller');

// const productController = new ProductController(models);
// const userController = new UserController(userService);
// const authController = new AuthController(userService);
// const serviceController = new ServiceController(serviceService); 
// const blogController = new BlogController(blogService);
// const careerController = new CareerController(careerService); // Add this line
// const adminController = new AdminController(userService);
// const projectController = new ProjectController(models, projectService);

// console.log('✅ All controllers initialized');

// // Add CORS headers middleware
// app.use((req, res, next) => {
//   const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
//   const origin = req.headers.origin;
  
//   if (allowedOrigins.includes(origin)) {
//     res.header('Access-Control-Allow-Origin', origin);
//   }
  
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-User-ID');
  
//   // Handle preflight
//   if (req.method === 'OPTIONS') {
//     return res.status(200).end();
//   }
  
//   next();
// });

// // Test routes
// app.get('/api/health', (req, res) => {
//   res.json({
//     success: true,
//     message: 'API is working!',
//     models: Object.keys(models).filter(key => !['sequelize', 'Sequelize'].includes(key)),
//     timestamp: new Date().toISOString()
//   });
// });

// app.get('/api/test-db', async (req, res) => {
//   try {
//     const categoryCount = await models.Category.count();
//     const productCount = await models.Product.count();
//     const serviceCount = await models.Service.count(); // Added service count
//     const blogCount = await models.Blog.count();
//     const careerJobCount = await models.CareerJob.count(); // Add career jobs count
//     const careerApplicationCount = await models.CareerApplication.count(); // Add applications count

//     res.json({
//       success: true,
//       message: 'Database connection successful',
//       counts: {
//         categories: categoryCount || 0,
//         products: productCount || 0,
//         services: serviceCount || 0, // Added services
//         blogs: blogCount || 0,
//         careerJobs: careerJobCount || 0, // Add this
//         careerApplications: careerApplicationCount || 0 // Add this
//       }
//     });
//   } catch (error) {
//     console.error('Database test error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Database test failed',
//       error: error.message
//     });
//   }
// });

// // ✅ Services test endpoint (no auth)
// app.get('/api/services/test', async (req, res) => {
//   try {
//     console.log('Services test endpoint called');
    
//     // Return test services data
//     res.json({
//       success: true,
//       message: 'Services test endpoint (no auth)',
//       data: {
//         count: 0,
//         services: [],
//         message: 'Services API is working'
//       }
//     });
//   } catch (error) {
//     console.error('Services test error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // ✅ Career test endpoint (no auth)
// app.get('/api/careers/test', async (req, res) => {
//   try {
//     console.log('Career test endpoint called');
    
//     // Return test career data
//     res.json({
//       success: true,
//       message: 'Career API test endpoint (no auth)',
//       data: {
//         jobs: [],
//         applications: [],
//         message: 'Career API is working'
//       }
//     });
//   } catch (error) {
//     console.error('Career test error:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// // ✅ Temporary NO-AUTH register endpoint for testing
// app.post('/api/auth/register/test', async (req, res) => {
//   try {
//     const { userName, email, password } = req.body;
    
//     console.log('Register test endpoint called:', { userName, email });
    
//     if (!userName || !email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: 'Username, email, and password are required'
//       });
//     }
    
//     // Create user without password hashing for testing
//     const user = await models.User.create({
//       userName,
//       email,
//       password, // In production, hash this!
//       provider: 'local',
//       isActive: true
//     });
    
//     // Remove password from response
//     const userResponse = user.toJSON();
//     delete userResponse.password;
    
//     res.json({
//       success: true,
//       message: 'User created successfully (test endpoint)',
//       data: userResponse
//     });
//   } catch (error) {
//     console.error('Register test error:', error);
    
//     if (error.name === 'SequelizeUniqueConstraintError') {
//       return res.status(409).json({
//         success: false,
//         message: 'User with this email already exists'
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Registration failed',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });

// // ✅ Temporary NO-AUTH login endpoint for testing
// app.post('/api/auth/login/test', async (req, res) => {
//   try {
//     const { email, password } = req.body;
    
//     console.log('Login test endpoint called:', { email });
    
//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: 'Email and password are required'
//       });
//     }
    
//     // Find user
//     const user = await models.User.findOne({
//       where: { email, isActive: true }
//     });
    
//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }
    
//     // For testing, just check if password matches (no hashing)
//     if (user.password !== password) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid email or password'
//       });
//     }
    
//     // Remove password from response
//     const userResponse = user.toJSON();
//     delete userResponse.password;
    
//     res.json({
//       success: true,
//       message: 'Login successful (test endpoint)',
//       data: {
//         user: userResponse,
//         accessToken: 'test-jwt-token-for-development-only'
//       }
//     });
//   } catch (error) {
//     console.error('Login test error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Login failed',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// });

// // ✅ Import routes modules - ADD CAREER ROUTES
// const createServiceRoutes = require('./routes/service.routes');
// const serviceUploaadUtil = require('./utils/serviceUpload.util');
// const createBlogRoutes = require('./routes/blog.route');
// const createProductRoutes = require('./routes/product.routes');
// const createAuthRoutes = require('./routes/auth.routes');
// const authMiddleware = require('./controllers/auth.middleware');
// const createCareerRoutes = require('./routes/career.routes');
// const createProjectRoutes = require('./routes/project.routes');
// const projectUploadUtil = require('./utils/projectUploadUtil');
// const blogUploadUtil = require('./utils/blogUpload.util');




// // ✅ Create route instances with controllers
// const serviceRouter = createServiceRoutes(
//   serviceController,
//   serviceUploaadUtil.getSingleUploadMiddleware('image')
// );

// const blogRouter = createBlogRoutes(
//   blogController,
// //  blogUploadUtil.getBlogUploadMiddleware('image')
// );

// const projectRouter = createProjectRoutes(
//   projectController,
//   authMiddleware
// );

// const productRouter = createProductRoutes(productController);
// const authRouter = createAuthRoutes(authController);
// const careerRouter = createCareerRoutes(careerController, authMiddleware);
// const adminRoutes = require('./routes/admin.route')(adminController);

// // ✅ Use the routes
// app.use('/api/careers', careerRouter.public); 
// app.use('/api/auth', authRouter);
// app.use('/api/services', serviceRouter); 
// app.use('/api/blogs', blogRouter );

// app.use('/api/projects', projectRouter.public);
// app.use('/api/admin/projects', authMiddleware.authenticate, projectRouter.protected);


// app.use('/api', productRouter);

// app.use('/api/careers', careerRouter.protected);

// // ✅ Register admin routes - with authentication
// app.use('/api/admin', authMiddleware.authenticate, adminRoutes);

// // app.use('/api/admin', adminRoutes);


// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('Server error:', err.message);
//   console.error('Error stack:', err.stack);
//   res.status(500).json({
//     success: false,
//     message: 'Something went wrong!',
//     error: process.env.NODE_ENV === 'development' ? err.message : undefined
//   });
// });

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found',
//     path: req.path
//   });
// });

// // Start server
// const PORT = process.env.PORT || 2090;


// // ✅ Fix database sync issues - UPDATE FOR CAREER MODELS
// const fixDatabaseSync = async () => {
//   console.log('🔄 Starting database sync process...');
  
//   try {
//     // Step 1: Check if services table exists
//     console.log('📊 Checking if services table exists...');
//     const [tableCheck] = await sequelize.query("SHOW TABLES LIKE 'services'");
    
//     if (tableCheck.length === 0) {
//       console.log('⚠️ Services table NOT FOUND. Creating it now...');
      
//       await sequelize.query(`
//         CREATE TABLE IF NOT EXISTS categories (
//           categoryId INT PRIMARY KEY AUTO_INCREMENT,
//           name VARCHAR(100) NOT NULL,
//           slug VARCHAR(120) NOT NULL UNIQUE,
//           description TEXT,
//           parentId INT NULL,
//           image VARCHAR(255),
//           isActive BOOLEAN DEFAULT true,
//           createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
//           updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//           FOREIGN KEY (parentId) REFERENCES categories(categoryId) ON DELETE SET NULL
//         ) ENGINE=InnoDB;
//       `);

//       await sequelize.query(`
//         CREATE TABLE IF NOT EXISTS users (
//           userId INT PRIMARY KEY AUTO_INCREMENT,
//           userName VARCHAR(255) NOT NULL,
//           email VARCHAR(255) NOT NULL UNIQUE,
//           password VARCHAR(255),
//           role VARCHAR(50) DEFAULT 'user',
//           isActive BOOLEAN DEFAULT true,
//           createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
//           updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//         ) ENGINE=InnoDB;
//       `);
//       // Create services table using raw SQL
//       await sequelize.query(`
//         CREATE TABLE services (
//           serviceId INT PRIMARY KEY AUTO_INCREMENT,
//           title VARCHAR(200) NOT NULL,
//           subTitle VARCHAR(300),
//           description TEXT,
//           icon VARCHAR(100),
//           image VARCHAR(500),
//           \`order\` INT DEFAULT 0,
//           isActive BOOLEAN DEFAULT true,
//           createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//           updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//           INDEX idx_title (title),
//           INDEX idx_isActive (isActive),
//           INDEX idx_order (\`order\`)
//         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
//       `);
//       console.log('✅ Services table created successfully');
//     } else {
//       console.log('✅ Services table already exists');
//     }
    
//     // Step 2: Check if career_jobs table exists
//     console.log('📊 Checking if career_jobs table exists...');
//     const [careerTableCheck] = await sequelize.query("SHOW TABLES LIKE 'careerJobs'");
    
//     if (careerTableCheck.length === 0) {
//       console.log('⚠️ Career_jobs table NOT FOUND. Creating it now...');
      
//     } else {
//       console.log('✅ Career_jobs table already exists');
//     }
    
//     // Step 3: Check if career_applications table exists
//     console.log('📊 Checking if career_applications table exists...');
//     const [appTableCheck] = await sequelize.query("SHOW TABLES LIKE 'Applications'");
    
//     if (appTableCheck.length === 0) {
//       console.log('⚠️ Career_applications table NOT FOUND. Creating it now...');
      
//     } else {
//       console.log('✅ Career_applications table already exists');
//     }
    
//     // Step 4: Check if related_services table exists
//     console.log('📊 Checking if related_services table exists...');
//     const [relatedTableCheck] = await sequelize.query("SHOW TABLES LIKE 'related_services'");
    
//     if (relatedTableCheck.length === 0) {
//       console.log('⚠️ Related_services table NOT FOUND. Creating it now...');
      
//       // Create related_services table
//       await sequelize.query(`
//         CREATE TABLE related_services (
//           id INT PRIMARY KEY AUTO_INCREMENT,
//           serviceId INT NOT NULL,
//           relatedServiceId INT NOT NULL,
//           createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//           FOREIGN KEY (serviceId) REFERENCES services(serviceId) ON DELETE CASCADE,
//           FOREIGN KEY (relatedServiceId) REFERENCES services(serviceId) ON DELETE CASCADE,
//           UNIQUE KEY unique_service_pair (serviceId, relatedServiceId),
//           INDEX idx_service_id (serviceId),
//           INDEX idx_related_id (relatedServiceId)
//         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
//       `);
//       console.log('✅ Related_services table created successfully');
//     } else {
//       console.log('✅ Related_services table already exists');
//     }
    
//     // Step 5: Test the Service model
//     console.log('🧪 Testing Service model...');
//     try {
//       const serviceCount = await models.Service.count();
//       console.log(`📊 Total services in database: ${serviceCount}`);
      
//       // Try to create a test service
//       const testService = await models.Service.create({
//         title: 'Test Service',
//         description: 'This is a test service created during startup',
//         order: 0,
//         isActive: true
//       });
//       console.log(`✅ Test service created with ID: ${testService.serviceId}`);
      
//       // Clean up test service
//       await testService.destroy();
//       console.log('🧹 Test service cleaned up');
      
//     } catch (testError) {
//       console.error('❌ Service model test failed:', testError.message);
//     }
    
//     // Step 6: Test the CareerJob model
//     console.log('🧪 Testing CareerJob model...');
//     try {
//       const jobCount = await models.CareerJob.count();
//       console.log(`📊 Total career jobs in database: ${jobCount}`);
      
//       // Try to create a test job if none exist
//       if (jobCount === 0) {
//         const testJob = await models.CareerJob.create({
//           title: 'Test Developer Position',
//           slug: 'test-developer-position-' + Date.now(),
//           department: 'Engineering',
//           location: 'Remote',
//           description: 'This is a test job position',
//           isActive: true,
//           employmentType: 'FULL_TIME',
//           experienceLevel: 'MID'
//         });
//         console.log(`✅ Test career job created with ID: ${testJob.id}`);
        
//         // Clean up test job
//         await testJob.destroy();
//         console.log('🧹 Test career job cleaned up');
//       }
      
//     } catch (testError) {
//       console.error('❌ CareerJob model test failed:', testError.message);
//     }
    
//     // Step 7: Sync ONLY new models, skip altering existing ones
//     console.log('🔄 Syncing ONLY new models...');
    
//     // Check which models already exist
//     const existingTables = ['users', 'categories', 'products', 'carts', 'wishlists', 'orders', 'comparisons'];
//     const [allTables] = await sequelize.query("SHOW TABLES");
//     const tableNames = allTables.map(t => Object.values(t)[0]);
    
//     console.log('📊 Existing tables:', tableNames);
    
//     // Sync only models that don't have tables
//     for (const modelName of Object.keys(models).filter(key => !['sequelize', 'Sequelize'].includes(key))) {
//       const tableName = models[modelName].tableName;
      
//       if (!tableNames.includes(tableName)) {
//         console.log(`🔄 Syncing ${modelName} (table: ${tableName})...`);
//         await models[modelName].sync({ force: false });
//         console.log(`✅ ${modelName} synced`);
//       } else {
//         console.log(`⏭️  Skipping ${modelName} - table ${tableName} already exists`);
//       }
//     }
    
//     console.log('✅ Database sync completed (existing tables preserved)');
    
//   } catch (error) {
//     console.error('❌ Database sync error:', error.message);
//     console.error('Error stack:', error.stack);
//   }
// };

// // Add error handling for file uploads (you'll need to import multer if not already)
// app.use((err, req, res, next) => {
//   // Check if multer is imported
//   const multer = require('multer');
//   if (err instanceof multer.MulterError) {
//     if (err.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({
//         success: false,
//         message: 'File size too large. Maximum size is 5MB'
//       });
//     }
//     return res.status(400).json({
//       success: false,
//       message: `File upload error: ${err.message}`
//     });
//   }
//   next(err);
// });

// console.log(`📁 File upload directories:`);
// console.log(`   Products: ${productUploadDir}`);
// console.log(`   Services: ${serviceUploadDir}`);
// console.log(`   Blogs: ${blogUploadDir}`);
// console.log(`   Careers: ${careerUploadDir}`);
// console.log(`   Resumes: ${resumeUploadDir}`);
// console.log(`📁 Static files served from: /uploads`);

// // Add this after your other test routes
// app.get('/api/diagnose/service', async (req, res) => {
//   try {
//     console.log('🔍 Service Model Diagnosis Requested');
    
//     // Check 1: Is Service model loaded?
//     const modelLoaded = !!models.Service;
    
//     // Check 2: Can we access model properties?
//     const modelProperties = modelLoaded ? {
//       name: models.Service.name,
//       tableName: models.Service.tableName,
//       rawAttributes: Object.keys(models.Service.rawAttributes)
//     } : null;
    
//     // Check 3: Does table exist in database?
//     let tableExists = false;
//     let tableColumns = [];
    
//     try {
//       const [tables] = await sequelize.query("SHOW TABLES LIKE 'services'");
//       tableExists = tables.length > 0;
      
//       if (tableExists) {
//         const [columns] = await sequelize.query("DESCRIBE services");
//         tableColumns = columns.map(col => col.Field);
//       }
//     } catch (dbError) {
//       console.log('Database query error:', dbError.message);
//     }
    
//     // Check 4: Try to query the table
//     let queryTest = null;
//     if (modelLoaded && tableExists) {
//       try {
//         queryTest = await models.Service.findAll({ limit: 5 });
//       } catch (queryError) {
//         queryTest = { error: queryError.message };
//       }
//     }
    
//     res.json({
//       success: true,
//       diagnosis: {
//         model: {
//           loaded: modelLoaded,
//           details: modelProperties
//         },
//         database: {
//           tableExists: tableExists,
//           columns: tableColumns,
//           columnCount: tableColumns.length
//         },
//         queryTest: {
//           success: queryTest && !queryTest.error,
//           result: queryTest && !queryTest.error ? 
//             `${queryTest.length} services found` : 
//             queryTest?.error || 'Not tested'
//         }
//       },
//       recommendations: tableExists ? [] : [
//         'Services table does not exist. Run the sync function.',
//         'Check the server console for sync errors.'
//       ]
//     });
    
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// // Add career diagnosis route
// app.get('/api/diagnose/career', async (req, res) => {
//   try {
//     console.log('🔍 Career Model Diagnosis Requested');
    
//     // Check CareerJob model
//     const careerJobLoaded = !!models.CareerJob;
//     const careerAppLoaded = !!models.CareerApplication;
    
//     let careerJobTableExists = false;
//     let careerAppTableExists = false;
    
//     try {
//       const [careerTables] = await sequelize.query("SHOW TABLES LIKE 'careerJobs'");
//       careerJobTableExists = careerTables.length > 0;
      
//       const [appTables] = await sequelize.query("SHOW TABLES LIKE 'Applications'");
//       careerAppTableExists = appTables.length > 0;
//     } catch (dbError) {
//       console.log('Database query error:', dbError.message);
//     }
    
//     // Test career job query
//     let jobQueryTest = null;
//     if (careerJobLoaded && careerJobTableExists) {
//       try {
//         jobQueryTest = await models.CareerJob.findAll({ limit: 5 });
//       } catch (queryError) {
//         jobQueryTest = { error: queryError.message };
//       }
//     }
    
//     res.json({
//       success: true,
//       diagnosis: {
//         models: {
//           CareerJob: {
//             loaded: careerJobLoaded,
//             name: models.CareerJob?.name,
//             tableName: models.CareerJob?.tableName
//           },
//           CareerApplication: {
//             loaded: careerAppLoaded,
//             name: models.CareerApplication?.name,
//             tableName: models.CareerApplication?.tableName
//           }
//         },
//         database: {
//           careerjobs_table: careerJobTableExists,
//           Applications_table: careerAppTableExists
//         },
//         jobQueryTest: {
//           success: jobQueryTest && !jobQueryTest.error,
//           result: jobQueryTest && !jobQueryTest.error ? 
//             `${jobQueryTest.length} career jobs found` : 
//             jobQueryTest?.error || 'Not tested'
//         }
//       }
//     });
    
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });


// // Initialize database and start server
// const startServer = async () => {
//   try {
//     await fixDatabaseSync();
    
//     // Test database queries
//     const categoryCount = await models.Category.count();
//     console.log(`📊 Total categories in database: ${categoryCount}`);
    
//     // Test User model
//     const userCount = await models.User.count();
//     console.log(`👥 Total users in database: ${userCount}`);
    
//     // Test Service model
//     const serviceCount = await models.Service.count();
//     console.log(`🔧 Total services in database: ${serviceCount}`);
    
//     // Test Career models
//     const careerJobCount = await models.CareerJob.count();
//     console.log(`💼 Total career jobs in database: ${careerJobCount}`);
    
//     const careerAppCount = await models.CareerApplication.count();
//     console.log(`📄 Total career applications in database: ${careerAppCount}`);
    
//     app.listen(PORT, () => {
//       console.log(`\n🚀 Server running on port ${PORT}`);
//       console.log(`🌐 Frontend: http://localhost:5173`);
//       console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
//       console.log(`\n🗂️  Product endpoints:`);
//       console.log(`   GET  http://localhost:${PORT}/api/categories`);
//       console.log(`   GET  http://localhost:${PORT}/api/products`);
//       console.log(`   POST http://localhost:${PORT}/api/admin/products (with images)`);
//       console.log(`   POST http://localhost:${PORT}/api/admin/products/:id/images`);
//       console.log(`   PUT  http://localhost:${PORT}/api/admin/products/:id/thumbnail`);
      
//       console.log(`\n🔧 Service endpoints:`);
//       console.log(`   GET  http://localhost:${PORT}/api/services`);
//       console.log(`   GET  http://localhost:${PORT}/api/services/test`);
//       console.log(`   GET  http://localhost:${PORT}/api/services/health`);
//       console.log(`   POST http://localhost:${PORT}/api/services (with image upload)`);
//       console.log(`   GET  http://localhost:${PORT}/api/services/:id`);
//       console.log(`   PUT  http://localhost:${PORT}/api/services/:id (with image upload)`);
//       console.log(`   DELETE http://localhost:${PORT}/api/services/:id`);
      
//       console.log(`\n📝 Career endpoints:`);
//       console.log(`   GET  http://localhost:${PORT}/api/careers/jobs`);
//       console.log(`   GET  http://localhost:${PORT}/api/careers/jobs/:idOrSlug`);
//       console.log(`   POST http://localhost:${PORT}/api/careers/apply (with resume upload)`);
//       console.log(`   GET  http://localhost:${PORT}/api/careers/test`);
//       console.log(`   POST http://localhost:${PORT}/api/careers/jobs (admin - create job)`);
//       console.log(`   PUT  http://localhost:${PORT}/api/careers/jobs/:id (admin - update job)`);
//       console.log(`   GET  http://localhost:${PORT}/api/careers/applications (admin - view applications)`);
      
//       console.log(`\n🛒 Cart test endpoints:`);
//       console.log(`   GET  http://localhost:${PORT}/api/cart/test (no auth - for testing)`);
//       console.log(`   GET  http://localhost:${PORT}/api/cart (via product routes)`);
      
//       console.log(`\n🔐 Auth endpoints:`);
//       console.log(`   POST http://localhost:${PORT}/api/auth/register (with AuthController)`);
//       console.log(`   POST http://localhost:${PORT}/api/auth/login (with AuthController)`);
//       console.log(`   GET  http://localhost:${PORT}/api/auth/me (current user)`);
      
//       console.log(`\n📝 Blog endpoints:`);
//       console.log(`   GET  http://localhost:${PORT}/api/blogs`);
//       console.log(`   GET  http://localhost:${PORT}/api/blogs/:idOrSlug`);
//       console.log(`   POST http://localhost:${PORT}/api/blogs (admin - with image upload)`);
      
//       console.log(`\n🔧 Test endpoints (temporary):`);
//       console.log(`   POST http://localhost:${PORT}/api/auth/register/test`);
//       console.log(`   POST http://localhost:${PORT}/api/auth/login/test`);
//       console.log(`   GET  http://localhost:${PORT}/api/diagnose/career`);
//       console.log(`   GET  http://localhost:${PORT}/api/diagnose/service`);
//     });
    
//   } catch (err) {
//     console.error('Server startup error:', err.message);
    
//     // Start server anyway for testing
//     app.listen(PORT, () => {
//       console.log(`\n⚠️ Server running on port ${PORT} (with errors)`);
//       console.log(`📋 Test endpoints available:`);
//       console.log(`   http://localhost:${PORT}/api/health`);
//       console.log(`   http://localhost:${PORT}/api/cart/test`);
//       console.log(`   http://localhost:${PORT}/api/services/test`);
//       console.log(`   http://localhost:${PORT}/api/careers/test`);
//       console.log(`   http://localhost:${PORT}/api/auth/register/test`);
//     });
//   }
// };

// startServer();


