module.exports = (sequelize, Sequelize) => {
  const Blog = sequelize.define('blog', {
    blogId: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    slug: {
      type: Sequelize.STRING(250),
      allowNull: false,
      unique: true
    },
    excerpt: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    content: {
      type: Sequelize.TEXT('long'),
      allowNull: false
    },
    featuredImage: {
      type: Sequelize.STRING(500),
      allowNull: true
    },
    authorId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userId'
      }
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
    readingTime: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: 'Reading time in minutes'
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
    status: {
      type: Sequelize.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft'
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
    tableName: 'blogs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['slug']
      },
      {
        fields: ['authorId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['isFeatured']
      },
      {
        fields: ['publishedAt']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  return Blog;
};


