const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WebhookEvent = sequelize.define(
    'WebhookEvent',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopifyWebhookId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shopDomain: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      topic: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shopifyOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      processedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'webhook_events',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['shopDomain', 'shopifyWebhookId'],
          name: 'webhook_events_shop_domain_webhook_id_unique',
        },
        {
          fields: ['status'],
        },
        {
          fields: ['topic'],
        },
        {
          fields: ['shopifyOrderId'],
        },
        {
          fields: ['createdAt'],
        },
      ],
    }
  );

  return WebhookEvent;
};
