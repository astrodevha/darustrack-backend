'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('academic_years', {
      id: {
        type: Sequelize.INTEGER,
        // defaultValue: Sequelize.UUIDV4,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      year: {
        type: Sequelize.STRING(9),
        allowNull: false,
        unique: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false
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
    await queryInterface.dropTable('academic_years');
  }
};