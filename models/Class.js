const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const Class = sequelize.define('Class', {
        id: {
            type: DataTypes.STRING(5),
            primaryKey: true,
            allowNull: false,
            defaultValue: () => nanoid()
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        teacher_id: {
            type: DataTypes.STRING(5),
            allowNull: true
        },
        academic_year_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'classes',
    });

    Class.associate = (models) => {
        Class.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'teacher' });
        Class.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academic_year'  });
        Class.hasMany(models.Schedule, { foreignKey: 'class_id', as: 'schedule' });
        Class.hasMany(models.GradeCategory, { foreignKey: 'class_id', as: 'grade_category' });
        Class.hasMany(models.StudentClass, { foreignKey: 'class_id', as: 'student_class' }); 
    };

    return Class;
};
