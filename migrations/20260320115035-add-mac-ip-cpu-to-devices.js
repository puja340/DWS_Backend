'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('devices', 'mac_address', {
      type: Sequelize.STRING(17),
      allowNull: true,
    });

    await queryInterface.addColumn('devices', 'ip_address', {
      type: Sequelize.STRING(45),
      allowNull: true,
    });

    await queryInterface.addColumn('devices', 'cpu_serial', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('devices', 'cpu_serial');
    await queryInterface.removeColumn('devices', 'ip_address');
    await queryInterface.removeColumn('devices', 'mac_address');
  }
};