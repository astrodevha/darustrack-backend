module.exports = {
  up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('student_evaluations', {
          id: { 
            type: Sequelize.STRING(5), 
            allowNull: false, 
            primaryKey: true 
          },
          evaluation_id: { 
            type: Sequelize.STRING(5), 
            allowNull: false, 
            references: { 
              model: 'evaluations', 
              key: 'id' 
            }, 
            onUpdate: 'CASCADE', 
            onDelete: 'CASCADE' 
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
          description: { 
            type: Sequelize.TEXT, 
            allowNull: true 
          },
          createdAt: Sequelize.DATE,
          updatedAt: Sequelize.DATE
      });
  },
  down: async (queryInterface, Sequelize) => {
      await queryInterface.dropTable('student_evaluations');
  }
};