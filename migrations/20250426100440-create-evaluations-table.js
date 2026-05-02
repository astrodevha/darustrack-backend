'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('evaluations', {
      id: {
        type: Sequelize.STRING(5),
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      class_id: {
        type: Sequelize.STRING(5),
        allowNull: false,
        references: {
            model: 'classes',
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      semester_id: {
          type: Sequelize.STRING(5),
          allowNull: false,
          references: {
              model: 'semesters',
              key: 'id',
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
    await queryInterface.dropTable('evaluations');
  }
};