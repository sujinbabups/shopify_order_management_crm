const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define(
    'Order',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopifyOrderId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      shopifyOrderNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      orderName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      shopifyStoreId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'shopify_stores',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      financialStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      fulfillmentStatus: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      orderDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'orders',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['shopifyStoreId', 'shopifyOrderId'],
          name: 'orders_store_shopify_order_unique',
        },
        {
          fields: ['customerId'],
        },
        {
          fields: ['orderDate'],
        },
        {
          fields: ['financialStatus'],
        },
        {
          fields: ['fulfillmentStatus'],
        },
      ],
    }
  );

  return Order;
};
