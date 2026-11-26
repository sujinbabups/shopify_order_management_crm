const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ImportHistory = sequelize.define(
    'ImportHistory',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
      status: {
        type: DataTypes.ENUM('IN_PROGRESS', 'COMPLETED', 'FAILED'),
        defaultValue: 'IN_PROGRESS',
        allowNull: false,
      },
      totalFetched: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      successfullyImported: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      updatedExisting: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      skipped: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      failed: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'import_history',
      timestamps: true,
      indexes: [
        {
          fields: ['shopifyStoreId'],
        },
        {
          fields: ['status'],
        },
        {
          fields: ['startedAt'],
        },
      ],
    }
  );

  return ImportHistory;
};
