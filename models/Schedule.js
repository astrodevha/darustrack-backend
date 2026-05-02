const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const Schedule = sequelize.define('Schedule', {
        id: {
            type: DataTypes.STRING(5),
            // defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false,
            defaultValue: () => nanoid()
        },
        class_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        subject_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        day: {
            type: DataTypes.ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
            allowNull: false
        },
        start_time: {
            type: DataTypes.TIME,
            allowNull: false
        },
        end_time: {
            type: DataTypes.TIME,
            allowNull: false
        }
    }, {
        tableName: 'schedules',
    });

    Schedule.associate = (models) => {
        Schedule.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
        Schedule.belongsTo(models.Subject, { foreignKey: 'subject_id', as: 'subject' });
    };

    return Schedule;
};
