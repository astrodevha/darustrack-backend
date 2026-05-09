/**
 * models/attendance.js
 *
 * Model untuk mencatat kehadiran siswa per hari dalam suatu semester.
 * Setiap record kehadiran terasosiasi dengan relasi StudentClass (siswa di kelas tertentu)
 * dan semester.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Attendance.belongsTo(StudentClass) as 'student_class' → siswa & kelas
 * - Attendance.belongsTo(Semester)      as 'semester'      → semester kehadiran
 *
 * ============================================================
 * STATUS KEHADIRAN (ENUM)
 * ============================================================
 * - 'Hadir'   : Siswa hadir
 * - 'Izin'    : Siswa izin (tidak hadir dengan alasan yang dibenarkan)
 * - 'Sakit'   : Siswa sakit
 * - 'Alpa'    : Siswa tidak hadir tanpa keterangan
 * - 'Not Set' : Status default saat sesi kehadiran baru dibuat
 *               (belum diisi oleh wali kelas)
 *
 * ============================================================
 * ALUR BISNIS
 * ============================================================
 * 1. Wali kelas membuat sesi kehadiran pada tanggal tertentu melalui
 *    POST /teachers/attendances → membuat record Attendance untuk setiap siswa
 *    di kelas dengan status 'Not Set'.
 * 2. Wali kelas mengupdate status per siswa melalui PUT /teachers/attendances.
 * 3. Orang tua dan kepala sekolah dapat melihat riwayat kehadiran.
 *
 * ============================================================
 * VALIDASI & CONSTRAINT
 * ============================================================
 * - Kombinasi (student_class_id, semester_id, date) harus unik?
 *   Tidak diatur di model, tetapi di controller dicek sebelum membuat sesi baru.
 * - Status hanya menerima nilai dari ENUM di atas (validasi database).
 * - Kolom `date` wajib diisi (allowNull: false secara implisit karena tidak
 *   ada allowNull: true). Pastikan controller mengisi `date`.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jika diperlukan status kehadiran tambahan (misal: 'Tugas Luar'),
 *   tambahkan nilai baru ke ENUM dengan migration:
 *     ALTER TABLE attendances MODIFY status ENUM('Hadir', 'Izin', 'Sakit', 'Alpa', 'Not Set', 'Tugas Luar');
 * - Jangan menghapus nilai ENUM yang sudah ada tanpa mempertimbangkan data historis.
 * - Tabel ini tidak memiliki timestamps; jika diperlukan audit trail, tambahkan
 *   kolom created_at/updated_at via migration.
 * - Pertimbangkan index pada (student_class_id, semester_id, date) untuk query yang sering.
 *
 * @module Attendance
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Attendance extends Model {
    static associate(models) {
      // Relasi ke StudentClass (siswa dalam konteks kelas & tahun ajaran)
      Attendance.belongsTo(models.StudentClass, {
        foreignKey: 'student_class_id',
        as: 'student_class',
      });
      // Relasi ke Semester (semester kehadiran)
      Attendance.belongsTo(models.Semester, {
        foreignKey: 'semester_id',
        as: 'semester',
      });
    }
  }

  Attendance.init(
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
       * student_class_id - Foreign key ke tabel student_classes.
       * Menentukan siswa dan kelas tempat ia terdaftar.
       * (FK tidak didefinisikan di model karena relations sudah di atur di associate,
       *  namun migration harus membuat foreign key constraint).
       */
      student_class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      /**
       * semester_id - Foreign key ke tabel semesters.
       * Menentukan semester (Ganjil/Genap) dari tahun ajaran tertentu.
       */
      semester_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      /**
       * date - Tanggal kehadiran (format YYYY-MM-DD).
       * Wajib diisi dan harus valid (controller memvalidasi format).
       */
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      /**
       * status - Status kehadiran siswa pada tanggal tersebut.
       * Menggunakan ENUM database untuk memastikan data valid.
       * Default 'Not Set' diatur di controller (bukan di model) karena
       * saat pembuatan sesi kehadiran, kita set status 'Not Set' secara eksplisit.
       */
      status: {
        type: DataTypes.ENUM('Hadir', 'Izin', 'Sakit', 'Alpa', 'Not Set'),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Attendance',
      tableName: 'attendances',
      timestamps: false,               // Tidak ada created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Attendance;
};