const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const Attendance = sequelize.define('Attendance', {
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
        semester_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('Hadir', 'Izin', 'Sakit', 'Alpha', 'Not Set'),
            allowNull: false,
            defaultValue: 'Not Set'
        }
    }, {
        tableName: 'attendances',
    });

    Attendance.associate = (models) => {
        Attendance.belongsTo(models.StudentClass, { foreignKey: 'student_class_id', as: 'student_class' });
        Attendance.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });
    };

    return Attendance;
};