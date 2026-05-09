'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('academic_years', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      year: {
        type: Sequelize.STRING(9),
        allowNull: false,
        unique: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      }
    }, {
      charset: 'latin1',
      collate: 'latin1_swedish_ci'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('academic_years');
  }
};