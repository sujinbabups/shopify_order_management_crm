'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopifyOrderId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      shopifyOrderNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      customerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      shopifyStoreId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'shopify_stores',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      financialStatus: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      fulfillmentStatus: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      currency: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'USD',
      },
      orderDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('orders', ['shopifyStoreId', 'shopifyOrderId'], {
      unique: true,
      name: 'orders_store_shopify_order_unique',
    });
    await queryInterface.addIndex('orders', ['customerId'], {
      name: 'orders_customer_id_idx',
    });
    await queryInterface.addIndex('orders', ['orderDate'], {
      name: 'orders_order_date_idx',
    });
    await queryInterface.addIndex('orders', ['financialStatus'], {
      name: 'orders_financial_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('orders');
  },
};
