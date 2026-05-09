/**
 * models/class.js
 *
 * Model untuk kelas (class) dalam tahun ajaran tertentu.
 * Setiap kelas memiliki nama (contoh: "6A", "6B") dan dapat memiliki wali kelas (teacher_id),
 * serta terikat pada tahun ajaran (academic_year_id).
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Class.belongsTo(User)          as 'teacher'        → wali kelas (opsional)
 * - Class.belongsTo(AcademicYear)  as 'academic_year'  → tahun ajaran
 * - Class.hasMany(StudentClass)    as 'student_class'  → siswa yang terdaftar di kelas ini
 * - Class.hasMany(Evaluation)      as 'evaluation'     → evaluasi deskriptif untuk kelas ini
 * - Class.hasMany(Schedule)        as 'schedule'       → jadwal pelajaran kelas ini
 * - Class.hasMany(GradeCategory)   as 'grade_category' → kategori nilai untuk kelas ini
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Nama kelas harus unik dalam satu tahun ajaran (validasi di controller).
 * - Wali kelas (teacher_id) harus memiliki role 'wali_kelas' (validasi di controller).
 * - Kelas hanya dapat diakses dalam konteks tahun ajaran tertentu.
 * - Hapus kelas: semua StudentClass, Attendance, StudentGrade, Evaluation, Schedule,
 *   GradeCategory, GradeDetail, StudentEvaluation yang terkait akan terhapus jika
 *   foreign key menggunakan ON DELETE CASCADE.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan lupa menambahkan validasi duplikasi nama di controller (create dan update).
 * - Field `teacher_id` dan `academic_year_id` wajib diisi (allowNull: false).
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan,
 *   tambahkan migration untuk menambah kolom timestamps.
 * - Jika ada perubahan struktur, pastikan migration sinkron.
 *
 * @module Class
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Class extends Model {
    static associate(models) {
      // Wali kelas (opsional, bisa null jika kelas belum punya wali)
      Class.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'teacher' });
      // Tahun ajaran (wajib)
      Class.belongsTo(models.AcademicYear, { foreignKey: 'academic_year_id', as: 'academic_year' });
      // Siswa yang terdaftar di kelas ini (one-to-many)
      Class.hasMany(models.StudentClass, { foreignKey: 'class_id', as: 'student_class' });
      // Evaluasi deskriptif untuk kelas ini
      Class.hasMany(models.Evaluation, { foreignKey: 'class_id', as: 'evaluation' });
      // Jadwal pelajaran (one-to-many)
      Class.hasMany(models.Schedule, { foreignKey: 'class_id', as: 'schedule' });
      // Kategori nilai (one-to-many)
      Class.hasMany(models.GradeCategory, { foreignKey: 'class_id', as: 'grade_category' });
    }
  }

  Class.init(
    {
      /**
       * id - Primary key auto-increment.
       */
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      /**
       * name - Nama kelas (contoh: "6A", "6B", "VII-A").
       * Harus unik dalam kombinasi dengan academic_year_id (dicek di controller).
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * teacher_id - Foreign key ke users.id (wali kelas).
       * Boleh null jika kelas belum memiliki wali kelas.
       */
      teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      /**
       * academic_year_id - Foreign key ke academic_years.id (wajib).
       * Menentukan tahun ajaran di mana kelas ini beroperasi.
       */
      academic_year_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'academic_years',
          key: 'id',
        },
        onDelete: 'CASCADE',   // Jika tahun ajaran dihapus, kelas ikut terhapus
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'Class',
      tableName: 'classes',
      timestamps: false,        // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Class;
};