'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('grade_details', {
      id: {
        type: Sequelize.STRING(5),
        // defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      grade_category_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
          model: 'grade_categories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      date: {
        type: Sequelize.DATEONLY,
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
    await queryInterface.dropTable('grade_details');
  }
};