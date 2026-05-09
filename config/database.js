/**
 * config/database.js
 *
 * Konfigurasi koneksi database Sequelize menggunakan DATABASE_URL.
 * File ini di-load oleh aplikasi saat startup (biasanya di models/index.js).
 *
 * ============================================================
 * PENGGUNAAN
 * ============================================================
 * - Digunakan oleh Sequelize untuk membuat koneksi ke database MySQL.
 * - Menggunakan DATABASE_URL dari environment variable (format: mysql://user:pass@host:port/db)
 * - Connection pool dioptimalkan untuk production.
 *
 * ============================================================
 * ENVIRONMENT VARIABLES
 * ============================================================
 * DATABASE_URL : URL lengkap koneksi database MySQL.
 *                Contoh: mysql://root:password@localhost:3306/sakti_db
 *
 * ============================================================
 * POOL CONFIGURATION
 * ============================================================
 * - max: 40   → jumlah maksimum koneksi dalam pool
 * - min: 5    → jumlah minimum koneksi yang dijaga tetap hidup
 * - acquire: 30000 → waktu maksimum (ms) untuk mendapatkan koneksi sebelum timeout
 * - idle: 10000    → waktu maksimum (ms) koneksi idle sebelum dilepaskan
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan mengubah parameter pool tanpa memahami beban aplikasi.
 * - Pastikan DATABASE_URL sudah diatur di file .env atau environment.
 * - Jika menggunakan migration CLI, Sequelize akan membaca config dari file ini
 *   melalui models/index.js yang mengimpor sequelize instance.
 * - Logging dimatikan (false) untuk mengurangi noise; aktifkan jika perlu debugging.
 */

const { Sequelize } = require('sequelize');

/**
 * Instance Sequelize yang terkoneksi ke database.
 * @type {Sequelize}
 */
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql',
  pool: {
    max: 40,
    min: 5,
    acquire: 30000,
    idle: 10000,
  },
  logging: false, // Set ke console.log untuk melihat query SQL saat debugging
});

module.exports = sequelize;