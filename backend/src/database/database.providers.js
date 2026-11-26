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
];

module.exports = {
  databaseProviders,
  db,
};
