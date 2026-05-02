'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_classes', {
      id: {
        type: Sequelize.STRING(5),
        // defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      student_id: {
        type: Sequelize.STRING(5),
        allowNull: true,
        references: {
          model: 'students',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      class_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
          model: 'classes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('student_classes');
  }
};