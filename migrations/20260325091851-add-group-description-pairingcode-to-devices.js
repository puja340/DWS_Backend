'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('devices', 'group', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('devices', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('devices', 'pairing_code', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('devices', 'pairing_code');
    await queryInterface.removeColumn('devices', 'description');
    await queryInterface.removeColumn('devices', 'group');
  }
};