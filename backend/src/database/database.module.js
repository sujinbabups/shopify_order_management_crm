const { Module, Global } = require('@nestjs/common');
const { databaseProviders } = require('./database.providers');

@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
class DatabaseModule {}

module.exports = { DatabaseModule };
