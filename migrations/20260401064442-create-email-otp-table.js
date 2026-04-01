'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_otps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      new_email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      otp: {
        type: Sequelize.STRING(4),
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('email_otps');
  }
};