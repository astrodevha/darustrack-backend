/**
 * models/user.js
 *
 * Model utama untuk data pengguna sistem (User).
 * Pengguna dapat memiliki role: admin, wali_kelas, kepala_sekolah, orang_tua.
 * Setiap pengguna dapat memiliki relasi sebagai wali kelas (Class), orang tua (Student),
 * maupun permintaan reset password (PasswordReset).
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - User.hasMany(Class)        as 'class'          → kelas yang diampu (untuk role wali_kelas)
 * - User.hasMany(Student)      as 'student'        → anak asuh (untuk role orang_tua)
 * - User.hasMany(PasswordReset)as 'password_reset' → token reset password
 *
 * ============================================================
 * FIELD & KEAMANAN
 * ============================================================
 * - password disimpan dalam bentuk hash (bcrypt) – hash dilakukan di hook model.
 * - token_version digunakan untuk mekanisme rotasi refresh token (H-02).
 * - NIP (Nomor Induk Pegawai) bersifat unik dan boleh null (untuk role orang_tua).
 * - Email harus unik dan digunakan untuk autentikasi.
 *
 * ============================================================
 * TIMESTAMPS
 * ============================================================
 * Tabel ini memiliki kolom created_at dan updated_at (timestamps: true).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan pernah mengembalikan field `password` atau `token_version` ke client.
 * - Pastikan hash password dilakukan di hook `beforeCreate` dan `beforeUpdate`.
 * - Jika ingin menambah scope untuk mengecualikan field sensitif, gunakan defaultScope.
 * - Index pada email dan nip diperlukan untuk performa unique constraint.
 *
 * @module User
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Relasi ke kelas (bagi wali kelas)
      User.hasMany(models.Class, { foreignKey: 'teacher_id', as: 'class' });
      // Relasi ke siswa (bagi orang tua)
      User.hasMany(models.Student, { foreignKey: 'parent_id', as: 'student' });
      // Relasi ke token reset password
      User.hasMany(models.PasswordReset, { foreignKey: 'user_id', as: 'password_reset' });
    }
  }

  User.init(
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
       * name - Nama lengkap pengguna (wajib, max 255 karakter).
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * nip - Nomor Induk Pegawai (opsional, unik).
       * Biasanya diisi untuk role wali_kelas, kepala_sekolah, admin.
       * Untuk role orang_tua, NIP biasanya null.
       */
      nip: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: true,
      },
      /**
       * email - Alamat email pengguna (wajib, unik).
       * Digunakan untuk login dan komunikasi.
       */
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      /**
       * password - Hash password (bcrypt) – tidak boleh null.
       * Field ini tidak boleh dikembalikan ke client.
       */
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * role - Role pengguna (ENUM).
       * Nilai yang valid: 'orang_tua', 'kepala_sekolah', 'wali_kelas', 'admin'.
       * Role menentukan akses ke berbagai endpoint.
       */
      role: {
        type: DataTypes.ENUM('orang_tua', 'kepala_sekolah', 'wali_kelas', 'admin'),
        allowNull: false,
      },
      /**
       * token_version - Versi token untuk rotasi refresh token (H-02).
       * Setiap kali refresh token digunakan atau logout, nilai ini dinaikkan.
       * Membantu revoke token lama tanpa mengubah secret key.
       * Default: 0.
       */
      token_version: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,               // Aktifkan timestamps (created_at, updated_at)
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return User;
};