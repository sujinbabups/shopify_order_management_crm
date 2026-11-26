const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopifyProductId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'products',
      timestamps: true,
      indexes: [
        {
          fields: ['shopifyProductId'],
        },
        {
          fields: ['sku'],
        },
      ],
    }
  );

  return Product;
};
