const { Sequelize } = require('sequelize');
const dbConfig = require('../../config/database.config');
const initUserModel = require('./user.model');
const initRefreshTokenModel = require('./refresh-token.model');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env] || dbConfig.development;

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
    pool: config.pool,
  }
);

const User = initUserModel(sequelize);
const RefreshToken = initRefreshTokenModel(sequelize);

// Model Associations
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const db = {
  sequelize,
  Sequelize,
  User,
  RefreshToken,
};

module.exports = db;
