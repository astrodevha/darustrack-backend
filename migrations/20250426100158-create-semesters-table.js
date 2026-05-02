'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('semesters', {
      id: {
        type: Sequelize.STRING(5),
        // defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.ENUM('Ganjil', 'Genap'),
        allowNull: false
      },
      academic_year_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'academic_years',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('semesters');
  }
};