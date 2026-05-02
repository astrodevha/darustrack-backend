const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const StudentClass = sequelize.define('StudentClass', {
        id: {
            type: DataTypes.STRING(5),
            primaryKey: true,
            defaultValue: () => nanoid()
        },
        student_id: {
            type: DataTypes.STRING(5),
            allowNull: true,
        },
        class_id: {
            type: DataTypes.STRING(5),
            allowNull: false,
        }
    }, {
        tableName: 'student_classes'
    });
  
    StudentClass.associate = (models) => {
        StudentClass.belongsTo(models.Student, { foreignKey: 'student_id', as: 'student' });
        StudentClass.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
    
        StudentClass.hasMany(models.StudentGrade, { foreignKey: 'student_class_id', as: 'student_grade' });
        StudentClass.hasMany(models.StudentEvaluation, { foreignKey: 'student_class_id', as: 'student_evaluation' });
        StudentClass.hasMany(models.Attendance, { foreignKey: 'student_class_id', as: 'attendance' });
    };
    
    return StudentClass;
};