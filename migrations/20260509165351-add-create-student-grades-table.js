'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('student_grades', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      student_class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'student_classes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      grade_detail_id: {
        type: Sequelize.INTEGER,
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
      }
    }, {
      charset: 'latin1',
      collate: 'latin1_swedish_ci'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_grades');
  }
};