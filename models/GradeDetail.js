const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const GradeDetail = sequelize.define('GradeDetail', {
        id: {
            type: DataTypes.STRING(5),
            // defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false,
            defaultValue: () => nanoid()
        },
        grade_category_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        }
    }, {
        tableName: 'grade_details',
        indexes: [
            {
                unique: true,
                fields: ['grade_category_id', 'name']
            }
        ]
    });

    GradeDetail.associate = (models) => {
        GradeDetail.belongsTo(models.GradeCategory, { foreignKey: 'grade_category_id', as: 'grade_category' });
        GradeDetail.hasMany(models.StudentGrade, { foreignKey: 'grade_detail_id', as: 'student_grade' });
    };

    return GradeDetail;
};