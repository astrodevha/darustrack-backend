/**
 * models/studentClass.js
 *
 * Model untuk tabel junction (many-to-many) antara Student dan Class,
 * namun juga berfungsi sebagai entitas utama yang menghubungkan siswa dengan
 * kelas pada tahun ajaran tertentu. Tabel ini memiliki child tables:
 * Attendance, StudentEvaluation, StudentGrade.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - StudentClass.belongsTo(Student) as 'student'          → siswa
 * - StudentClass.belongsTo(Class)   as 'class'            → kelas
 * - StudentClass.hasMany(Attendance)        as 'attendance'        → kehadiran siswa di kelas ini
 * - StudentClass.hasMany(StudentEvaluation) as 'student_evaluation' → evaluasi siswa di kelas ini
 * - StudentClass.hasMany(StudentGrade)      as 'student_grade'      → nilai siswa di kelas ini
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Satu siswa hanya boleh terdaftar di satu kelas dalam satu tahun ajaran.
 *   (Aturan ini diimplementasikan di controller, bukan di model).
 * - Operasi penambahan siswa ke kelas bersifat atomik (menggunakan transaction)
 *   karena dapat melibatkan pembuatan Attendance, StudentGrade, StudentEvaluation.
 * - Penghapusan StudentClass akan cascade ke Attendance, StudentGrade, StudentEvaluation
 *   jika foreign key menggunakan ON DELETE CASCADE (pastikan di migration).
 * - Tabel ini merupakan sumber utama untuk mengetahui kehadiran, evaluasi, dan nilai
 *   siswa dalam konteks kelas & tahun ajaran.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit jejak perubahan pendaftaran siswa ke kelas, tambahkan kolom timestamps.
 * - Pastikan foreign key constraints di migration diatur dengan benar:
 *   `student_id` → ON DELETE CASCADE (siswa dihapus → hapus pendaftaran kelas)
 *   `class_id`   → ON DELETE CASCADE (kelas dihapus → hapus pendaftaran siswa)
 * - Index pada (student_id, class_id) direkomendasikan untuk keunikan (unique constraint)
 *   juga untuk performa query.
 *
 * @module StudentClass
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StudentClass extends Model {
    static associate(models) {
      // Siswa yang terdaftar
      StudentClass.belongsTo(models.Student, { foreignKey: 'student_id', as: 'student' });
      // Kelas tempat siswa terdaftar
      StudentClass.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
      // Data kehadiran siswa di kelas ini
      StudentClass.hasMany(models.Attendance, { foreignKey: 'student_class_id', as: 'attendance' });
      // Evaluasi deskriptif siswa di kelas ini
      StudentClass.hasMany(models.StudentEvaluation, { foreignKey: 'student_class_id', as: 'student_evaluation' });
      // Nilai (grade) siswa di kelas ini
      StudentClass.hasMany(models.StudentGrade, { foreignKey: 'student_class_id', as: 'student_grade' });
    }
  }

  StudentClass.init(
    {
      /**
       * id - Primary key auto-increment.
       * Digunakan sebagai identifier unik untuk relasi StudentClass.
       */
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      /**
       * student_id - Foreign key ke students.id (wajib).
       * Menentukan siswa yang terdaftar.
       */
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'students',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * class_id - Foreign key ke classes.id (wajib).
       * Menentukan kelas tujuan pendaftaran.
       */
      class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'classes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'StudentClass',
      tableName: 'student_classes',
      timestamps: false,               // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return StudentClass;
};