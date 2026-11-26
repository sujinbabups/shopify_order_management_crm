const { DataTypes } = require('sequelize');
const CryptoUtil = require('../../common/utils/crypto.util');

module.exports = (sequelize) => {
  const ShopifyStore = sequelize.define(
    'ShopifyStore',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      shopDomain: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      shopifyShopId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: false,
        set(value) {
          if (value) {
            // Automatically encrypt before saving
            this.setDataValue('accessToken', CryptoUtil.encrypt(value));
          }
        },
        get() {
          const rawValue = this.getDataValue('accessToken');
          return CryptoUtil.decrypt(rawValue);
        },
      },
      scopes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      connectedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
      },
    },
    {
      tableName: 'shopify_stores',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['shopDomain'],
        },
        {
          fields: ['isActive'],
        },
      ],
    }
  );

  ShopifyStore.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.accessToken; // Never expose token in API JSON
    return values;
  };

  return ShopifyStore;
};
