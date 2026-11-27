const { Module } = require('@nestjs/common');
const { DatabaseModule } = require('../../database/database.module');
const { WebhooksController } = require('./webhooks.controller');
const { WebhooksService } = require('./webhooks.service');
const { WebhookVerificationService } = require('./webhook-verification.service');
const { WebhookProcessingService } = require('./webhook-processing.service');

@Module({
  imports: [DatabaseModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookVerificationService,
    WebhookProcessingService,
  ],
  exports: [WebhooksService, WebhookVerificationService, WebhookProcessingService],
})
class WebhooksModule {}

module.exports = { WebhooksModule };
