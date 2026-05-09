'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GradeCategory extends Model {
    static associate(models) {
      GradeCategory.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
      GradeCategory.belongsTo(models.Subject, { foreignKey: 'subject_id', as: 'subject' });
      GradeCategory.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });
      GradeCategory.hasMany(models.GradeDetail, { foreignKey: 'grade_category_id', as: 'grade_detail' });
    }
  }
  GradeCategory.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: DataTypes.STRING(255)
  }, {
    sequelize,
    modelName: 'GradeCategory',
    tableName: 'grade_categories',
    timestamps: false,
    charset: 'latin1',
    collate: 'latin1_swedish_ci'
  });
  return GradeCategory;
};