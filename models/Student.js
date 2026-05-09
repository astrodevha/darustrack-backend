/**
 * models/student.js
 *
 * Model untuk data siswa (student) dalam sistem.
 * Setiap siswa dapat memiliki orang tua (parent) yang terdaftar sebagai user dengan role 'orang_tua'.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Student.belongsTo(User) as 'parent' → orang tua siswa (opsional, FK parent_id)
 * - Student.hasMany(StudentClass) as 'student_class' → pendaftaran siswa ke kelas (junction)
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - NISN (Nomor Induk Siswa Nasional) bersifat unik di seluruh sistem.
 * - Tanggal lahir (birth_date) wajib diisi, format YYYY-MM-DD (validasi di controller).
 * - Orang tua (parent_id) merujuk ke user dengan role 'orang_tua'.
 * - Satu siswa hanya boleh terdaftar di satu kelas dalam satu tahun ajaran (dicek di controller).
 * - Jika siswa dihapus, semua StudentClass (pendaftaran kelas) akan ikut terhapus (CASCADE).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit perubahan data siswa, tambahkan kolom timestamps via migration.
 * - Pastikan NISN di-trim dan divalidasi format (8-10 digit, di controller).
 * - Index pada kolom `nisn` harus UNIQUE (sudah di model).
 * - Index pada `parent_id` direkomendasikan untuk query join ke users.
 *
 * @module Student
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Student extends Model {
    static associate(models) {
      // Relasi ke user (orang tua siswa) – opsional
      Student.belongsTo(models.User, { foreignKey: 'parent_id', as: 'parent' });
      // Relasi ke student_class (pendaftaran siswa ke kelas)
      Student.hasMany(models.StudentClass, { foreignKey: 'student_id', as: 'student_class' });
    }
  }

  Student.init(
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
       * name - Nama lengkap siswa (wajib, max 255 karakter).
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * nisn - Nomor Induk Siswa Nasional (wajib, unik).
       * Panjang ideal 8-10 digit (validasi di controller).
       */
      nisn: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      /**
       * birth_date - Tanggal lahir siswa (wajib, format YYYY-MM-DD).
       * Tidak boleh di masa depan (validasi di controller).
       */
      birth_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      /**
       * parent_id - Foreign key ke users.id (orang tua siswa, opsional).
       * Bisa null jika siswa belum punya akun orang tua atau orang tua belum terdaftar.
       */
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'Student',
      tableName: 'students',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Student;
};