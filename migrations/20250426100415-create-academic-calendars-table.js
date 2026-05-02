'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('academic_calendar', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      event_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('academic_calendar');
  }
};