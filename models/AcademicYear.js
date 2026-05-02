module.exports = (sequelize, DataTypes) => {
  const AcademicYear = sequelize.define('AcademicYear', {
    id: {
      type: DataTypes.INTEGER,
      // defaultValue: Sequelize.UUIDV4,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    year: {
      type: DataTypes.STRING(9),
      allowNull: false,
      unique: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    }
  }, {
    tableName: 'academic_years'
  });

  AcademicYear.associate = (models) => {
    AcademicYear.hasMany(models.Semester, { foreignKey: 'academic_year_id', as: 'semester' });
    AcademicYear.hasMany(models.Class, { foreignKey: 'academic_year_id', as: 'class' });
  };

  AcademicYear.addHook('afterCreate', async (academicYear, options) => {
    const Semester = sequelize.models.Semester;
  
    await Semester.bulkCreate([
      {
        name: 'Ganjil',
        academic_year_id: academicYear.id,
        is_active: academicYear.is_active // aktif hanya kalau tahun ajaran aktif
      },
      {
        name: 'Genap',
        academic_year_id: academicYear.id,
        is_active: false
      }
    ]);
  
    // Jika tahun ajaran tidak aktif, pastikan semua semester juga nonaktif
    if (!academicYear.is_active) {
      await Semester.update(
        { is_active: false },
        { where: { academic_year_id: academicYear.id } }
      );
    }
  });  
  
  AcademicYear.addHook('beforeUpdate', async (academicYear, options) => {
    if (academicYear.changed('is_active')) {
      const Semester = sequelize.models.Semester;
      
      // Jika dinonaktifkan, matikan semua semester
      if (!academicYear.is_active) {
        await Semester.update(
          { is_active: false },
          { where: { academic_year_id: academicYear.id } }
        );
      }
      
      // Jika diaktifkan, aktifkan semester Ganjil (opsional)
      else {
        await Semester.update(
          { is_active: true },
          { 
            where: { 
              academic_year_id: academicYear.id,
              name: 'Ganjil'
            } 
          }
        );
      }
    }
  });
    
  return AcademicYear;
};