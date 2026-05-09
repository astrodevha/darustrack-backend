/**
 * models/semester.js
 *
 * Model untuk semester dalam suatu tahun ajaran.
 * Setiap tahun ajaran memiliki dua semester: Ganjil dan Genap.
 * Hanya satu semester yang boleh aktif dalam satu tahun ajaran.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Semester.belongsTo(AcademicYear) as 'academic_year' → tahun ajaran induk
 * - Semester.hasMany(Attendance)     as 'attendance'   → kehadiran siswa di semester ini
 * - Semester.hasMany(Evaluation)     as 'evaluation'   → evaluasi deskriptif di semester ini
 * - Semester.hasMany(GradeCategory)  as 'grade_category' → kategori nilai di semester ini
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Hanya satu semester yang boleh aktif (is_active = true) dalam satu tahun ajaran.
 * - Semester Ganjil dan Genap dibuat otomatis saat tahun ajaran baru dibuat
 *   (via hook afterCreate di model AcademicYear atau di controller).
 * - Semester hanya dapat diaktifkan/dinonaktifkan oleh admin, dengan transaction
 *   dan individualHooks untuk menjaga konsistensi.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan,
 *   tambahkan migration untuk menambah kolom timestamps.
 * - Hanya dua nilai ENUM name: 'Ganjil' dan 'Genap'. Jika suatu saat ada semester
 *   tambahan (misal: 'Pendek'), perlu migration ALTER ENUM.
 * - Index pada (academic_year_id, is_active) berguna untuk query semester aktif.
 *
 * @module Semester
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Semester extends Model {
    static associate(models) {
      // Induk tahun ajaran
      Semester.belongsTo(models.AcademicYear, {
        foreignKey: 'academic_year_id',
        as: 'academic_year',
      });
      // Kehadiran siswa di semester ini
      Semester.hasMany(models.Attendance, {
        foreignKey: 'semester_id',
        as: 'attendance',
      });
      // Evaluasi deskriptif di semester ini
      Semester.hasMany(models.Evaluation, {
        foreignKey: 'semester_id',
        as: 'evaluation',
      });
      // Kategori nilai di semester ini
      Semester.hasMany(models.GradeCategory, {
        foreignKey: 'semester_id',
        as: 'grade_category',
      });
    }
  }

  Semester.init(
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
       * name - Nama semester, hanya 'Ganjil' atau 'Genap'.
       * Menggunakan ENUM database untuk menjaga konsistensi.
       */
      name: {
        type: DataTypes.ENUM('Ganjil', 'Genap'),
        allowNull: false,
      },
      /**
       * is_active - Status aktif semester.
       * true  : semester sedang berlangsung.
       * false : semester sudah selesai atau belum dimulai.
       * Hanya satu semester per tahun ajaran yang boleh aktif.
       */
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /**
       * academic_year_id - Foreign key ke academic_years.id (wajib).
       * Menentukan tahun ajaran tempat semester ini berada.
       */
      academic_year_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'academic_years',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'Semester',
      tableName: 'semesters',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Semester;
};