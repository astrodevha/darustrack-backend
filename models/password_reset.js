/**
 * models/passwordReset.js
 *
 * Model untuk menyimpan token reset password (self-service via email).
 * Digunakan untuk alur "lupa password" yang mengirim email berisi link reset.
 * Token di-generate saat user request reset password, memiliki masa berlaku (expires_at),
 * dan akan dihapus setelah digunakan atau expired.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - PasswordReset.belongsTo(User) as 'user' → user yang meminta reset
 *
 * ============================================================
 * ALUR BISNIS
 * ============================================================
 * 1. User mengisi email di halaman lupa password.
 * 2. Server membuat token unik (random string) dan menyimpannya di tabel ini
 *    bersama user_id dan expires_at (misal: now + 1 jam).
 * 3. Server mengirim email ke user berisi link: /reset-password?token=xxxx
 * 4. User klik link, kemudian submit password baru.
 * 5. Server memverifikasi token (valid, belum expired, cocok dengan user).
 * 6. Server update password user, lalu hapus token (atau biarkan expired).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   untuk audit, tambahkan kolom `created_at` via migration (tanpa updated_at).
 * - Pastikan token bersifat unik dan cukup panjang (gunakan crypto.randomBytes(32)).
 * - Index pada kolom `token` untuk pencarian cepat (harus unique).
 * - Job periodic cleaner dapat menghapus token expired secara berkala.
 *
 * @module PasswordReset
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PasswordReset extends Model {
    static associate(models) {
      // Relasi ke user yang meminta reset password
      PasswordReset.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
    }
  }

  PasswordReset.init(
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
       * token - Token reset password (string unik, max 255 karakter).
       * Biasanya di-generate dengan crypto.randomBytes(32).toString('hex').
       * Harus unik untuk mencegah collision.
       */
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      /**
       * user_id - Foreign key ke users.id (wajib).
       * User yang meminta reset password.
       */
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * expires_at - Waktu kedaluwarsa token.
       * Token hanya valid jika expires_at > NOW().
       */
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'PasswordReset',
      tableName: 'password_resets',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return PasswordReset;
};