'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shopify_stores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopDomain: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      shopifyShopId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      accessToken: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      scopes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      connectedAt: {
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

    await queryInterface.addIndex('shopify_stores', ['shopDomain'], {
      unique: true,
      name: 'shopify_stores_domain_unique_idx',
    });
    await queryInterface.addIndex('shopify_stores', ['isActive'], {
      name: 'shopify_stores_is_active_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shopify_stores');
  },
};
