const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const StudentGrade = sequelize.define('StudentGrade', {
        id: { 
            type: DataTypes.STRING(5), 
            primaryKey: true, 
            allowNull: false, 
            defaultValue: () => nanoid() 
        },
        student_class_id: { 
            type: DataTypes.STRING(5), 
            allowNull: false 
        },
        grade_detail_id: { 
            type: DataTypes.STRING(5), 
            allowNull: false 
        },
        score: { 
            type: DataTypes.FLOAT, 
            allowNull: true 
        },
    }, {
        tableName: 'student_grades'
    });

    StudentGrade.associate = (models) => {
        StudentGrade.belongsTo(models.StudentClass, { foreignKey: 'student_class_id', as: 'student_class' });
        StudentGrade.belongsTo(models.GradeDetail, { foreignKey: 'grade_detail_id', as: 'grade_detail' });
    };

    return StudentGrade;
};
