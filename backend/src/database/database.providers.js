const db = require('./models');

const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async () => {
      try {
        await db.sequelize.authenticate();
        console.log('Database connection has been established successfully.');
      } catch (error) {
        console.error('Unable to connect to the database:', error.message);
        throw error;
      }
      return db.sequelize;
    },
  },
  {
    provide: 'USER_REPOSITORY',
    useValue: db.User,
  },
  {
    provide: 'REFRESH_TOKEN_REPOSITORY',
    useValue: db.RefreshToken,
  },
  {
    provide: 'SHOPIFY_STORE_REPOSITORY',
    useValue: db.ShopifyStore,
  },
  {
    provide: 'CUSTOMER_REPOSITORY',
    useValue: db.Customer,
  },
  {
    provide: 'ORDER_REPOSITORY',
    useValue: db.Order,
  },
  {
    provide: 'ORDER_ITEM_REPOSITORY',
    useValue: db.OrderItem,
  },
  {
    provide: 'PRODUCT_REPOSITORY',
    useValue: db.Product,
  },
  {
    provide: 'IMPORT_HISTORY_REPOSITORY',
    useValue: db.ImportHistory,
  },
];

module.exports = {
  databaseProviders,
  db,
};
