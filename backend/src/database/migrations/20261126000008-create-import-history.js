'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('import_history', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
      status: {
        type: Sequelize.ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED'),
        defaultValue: 'IN_PROGRESS',
        allowNull: false,
      },
      totalFetched: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      successfullyImported: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      updatedExisting: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      skipped: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      failed: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      startedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('import_history', ['shopifyStoreId'], {
      name: 'import_history_store_id_idx',
    });
    await queryInterface.addIndex('import_history', ['status'], {
      name: 'import_history_status_idx',
    });
    await queryInterface.addIndex('import_history', ['startedAt'], {
      name: 'import_history_started_at_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('import_history');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_import_history_status";');
  },
};
