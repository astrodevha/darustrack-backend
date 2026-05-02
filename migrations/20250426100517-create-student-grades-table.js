'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_grades', {
      id: {
        type: Sequelize.STRING(5),
        // defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      student_class_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
          model: 'student_classes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      grade_detail_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
          model: 'grade_details',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      score: {
        type: Sequelize.FLOAT,
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
    await queryInterface.dropTable('student_grades');
  }
};