// update/email_otp.model.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailOtp extends Model {
    static associate(models) {
      EmailOtp.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  EmailOtp.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    new_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    otp: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'EmailOtp',
    tableName: 'email_otps',
    timestamps: true,
    underscored: true,
  });

  return EmailOtp;
};