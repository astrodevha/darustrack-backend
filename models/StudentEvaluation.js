const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const StudentEvaluation = sequelize.define('StudentEvaluation', {
        id: { 
            type: DataTypes.STRING(5), 
            primaryKey: true, 
            allowNull: false,
            defaultValue: () => nanoid() 
        },
        evaluation_id: { 
            type: DataTypes.STRING(5), 
            allowNull: false 
        },
        student_class_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        description: { 
            type: DataTypes.TEXT, 
            allowNull: true 
        }
    }, {
        tableName: 'student_evaluations'
    });

    StudentEvaluation.associate = models => {
        StudentEvaluation.belongsTo(models.Evaluation, { foreignKey: 'evaluation_id', as: 'evaluation' });
        StudentEvaluation.belongsTo(models.StudentClass, { foreignKey: 'student_class_id', as: 'student_class' });
    };

    return StudentEvaluation;
};
