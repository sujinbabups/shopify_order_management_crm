'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('webhook_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopifyWebhookId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      shopDomain: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      topic: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shopifyOrderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('webhook_events', ['shopDomain', 'shopifyWebhookId'], {
      unique: true,
      name: 'webhook_events_shop_domain_webhook_id_unique',
      where: {
        shopifyWebhookId: {
          [Sequelize.Op.ne]: null,
        },
      },
    });

    await queryInterface.addIndex('webhook_events', ['status'], {
      name: 'webhook_events_status_idx',
    });

    await queryInterface.addIndex('webhook_events', ['topic'], {
      name: 'webhook_events_topic_idx',
    });

    await queryInterface.addIndex('webhook_events', ['shopifyOrderId'], {
      name: 'webhook_events_shopify_order_id_idx',
    });

    await queryInterface.addIndex('webhook_events', ['createdAt'], {
      name: 'webhook_events_created_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('webhook_events');
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_webhook_events_status";');
    }
  },
};
