/**
 * models/curriculum.js
 *
 * Model untuk kurikulum yang digunakan di sekolah.
 * Sistem dapat memiliki beberapa kurikulum (misal: Kurikulum 2013, Kurikulum Merdeka),
 * namun hanya satu yang aktif sebagai acuan pembelajaran (status aktif tidak disimpan di sini;
 * biasanya diatur di level aplikasi atau melalui konfigurasi terpisah).
 *
 * ============================================================
 * RELASI
 * ============================================================
 * Model ini tidak memiliki foreign key ke tabel lain (independen).
 * Jika suatu saat kurikulum perlu dikaitkan dengan kelas atau mata pelajaran,
 * tambahkan field curriculum_id di tabel terkait dan definisikan relasi di sini.
 *
 * ============================================================
 * FIELD
 * ============================================================
 * - id          : Primary key auto-increment (integer)
 * - name        : Nama kurikulum (max 255 karakter). Contoh: "Kurikulum 2013", "Kurikulum Merdeka"
 * - description : Deskripsi kurikulum (TEXT long, bisa sangat panjang)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika suatu saat
 *   perlu audit perubahan, tambahkan kolom timestamps via migration.
 * - Gunakan charset latin1 dan collate latin1_swedish_ci untuk kompatibilitas
 *   dengan legacy system. Jika perlu dukungan Unicode penuh (emojis, karakter
 *   non-Latin), ubah ke utf8mb4.
 * - Untuk mengambil kurikulum yang sedang aktif, controller harus memiliki logika
 *   tersendiri (misal: mengambil kurikulum dengan id tertentu dari konfigurasi, atau
 *   menambahkan field `is_active` jika diperlukan).
 *
 * @module Curriculum
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Curriculum extends Model {
    /**
     * Mendefinisikan asosiasi dengan model lain.
     * @param {Object} models - Semua model yang terdaftar
     */
    static associate(models) {
      // Tidak ada foreign key child. Tabel ini independen.
    }
  }

  Curriculum.init(
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
       * name - Nama kurikulum (wajib, max 255 karakter).
       * Contoh: "Kurikulum 2013", "Kurikulum Merdeka", "Cambridge International".
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * description - Deskripsi kurikulum (opsional, bisa sangat panjang).
       * Menggunakan tipe TEXT long untuk menampung dokumen deskripsi yang panjang.
       */
      description: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Curriculum',
      tableName: 'curriculums',
      timestamps: false,        // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Curriculum;
};