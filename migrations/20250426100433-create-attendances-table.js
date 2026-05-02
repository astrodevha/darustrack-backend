'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('attendances', {
      id: {
        type: Sequelize.STRING(5),
        // defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
      semester_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
          model: 'semesters',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('Hadir', 'Izin', 'Sakit', 'Alpha', 'Not Set'),
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
    await queryInterface.dropTable('attendances');
  }
};