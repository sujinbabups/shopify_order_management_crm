const { Sequelize } = require('sequelize');
const dbConfig = require('../../config/database.config');
const initUserModel = require('./user.model');
const initRefreshTokenModel = require('./refresh-token.model');
const initShopifyStoreModel = require('./shopify-store.model');
const initCustomerModel = require('./customer.model');
const initOrderModel = require('./order.model');
const initOrderItemModel = require('./order-item.model');
const initProductModel = require('./product.model');
const initImportHistoryModel = require('./import-history.model');

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
const ShopifyStore = initShopifyStoreModel(sequelize);
const Customer = initCustomerModel(sequelize);
const Order = initOrderModel(sequelize);
const OrderItem = initOrderItemModel(sequelize);
const Product = initProductModel(sequelize);
const ImportHistory = initImportHistoryModel(sequelize);

// User & Auth Associations
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Store & Order Associations
ShopifyStore.hasMany(Order, { foreignKey: 'shopifyStoreId', as: 'orders', onDelete: 'CASCADE' });
Order.belongsTo(ShopifyStore, { foreignKey: 'shopifyStoreId', as: 'store' });

// Customer & Order Associations
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders', onDelete: 'SET NULL' });
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

// Order & OrderItem Associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Store & ImportHistory Associations
ShopifyStore.hasMany(ImportHistory, { foreignKey: 'shopifyStoreId', as: 'importHistories', onDelete: 'CASCADE' });
ImportHistory.belongsTo(ShopifyStore, { foreignKey: 'shopifyStoreId', as: 'store' });

const db = {
  sequelize,
  Sequelize,
  User,
  RefreshToken,
  ShopifyStore,
  Customer,
  Order,
  OrderItem,
  Product,
  ImportHistory,
};

module.exports = db;
