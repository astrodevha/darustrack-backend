const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const Semester = sequelize.define('Semester', {
        id: {
            type: DataTypes.STRING(5),
            primaryKey: true,
            defaultValue: () => nanoid()
        },
        name: {
            type: DataTypes.ENUM('Ganjil', 'Genap'),
            allowNull: false
        },
        academic_year_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    }, {
        tableName: 'semesters',
    });

    Semester.associate = (models) => {
        Semester.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academic_year' });
        Semester.hasMany(models.Attendance, { foreignKey: 'semester_id', as: 'attendance' });
        Semester.hasMany(models.Evaluation, { foreignKey: 'semester_id', as: 'evaluation' });
        Semester.hasMany(models.GradeCategory, { foreignKey: 'semester_id', as: 'grade_category' });
    };

    return Semester;
};
