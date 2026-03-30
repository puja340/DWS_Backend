// device/device.model.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Device extends Model {
    static associate(models) {
      // Assuming your User model is in models/User.js or similar
      // Adjust the require path or model name if needed
      Device.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  Device.init({
    id: {
      allowNull: true,
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
    device_id: {                  
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,          // We will save user-given name
    defaultValue: 'Unnamed Device',
  },
  group: {                     // ← New
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {               // ← New
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pairing_code: {
  type: DataTypes.STRING(20),
  allowNull: true,
  unique: true,
},
is_disabled: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
  allowNull: false
},
    cpu_serial: {
  type: DataTypes.STRING(100),
  allowNull: true,
},
mac_address: {
  type: DataTypes.STRING(17),
  allowNull: true,
},
ip_address: {
  type: DataTypes.STRING(45),
  allowNull: true,
},
    hostname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    agent_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    last_connected: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName: 'Device',
    tableName: 'devices',
    timestamps: true,
    underscored: true,          // created_at, updated_at
  });

  return Device;
};