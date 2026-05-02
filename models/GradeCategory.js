const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = (sequelize, DataTypes) => {
    const GradeCategory = sequelize.define('GradeCategory', {
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
        semester_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        subject_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }        
    }, {
        tableName: 'grade_categories',
        indexes: [
            {
                unique: true,
                fields: ['student_class_id', 'subject_id', 'name']
            }
        ]
    });

    GradeCategory.associate = (models) => {
        GradeCategory.belongsTo(models.Subject, { foreignKey: 'subject_id', as: 'subject' });
        GradeCategory.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });
        GradeCategory.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });

        GradeCategory.hasMany(models.GradeDetail, {
            foreignKey: 'grade_category_id',
            as: 'grade_detail'
        });
    };

    return GradeCategory;
};

