/**
 * config/database.js
 *
 * Konfigurasi koneksi database Sequelize untuk environment development, test, dan production.
 * File ini digunakan oleh:
 * - Aplikasi utama (melalui models/index.js)
 * - Sequelize CLI untuk menjalankan migrasi (npx sequelize-cli db:migrate)
 *
 * ============================================================
 * SUMBER KONFIGURASI
 * ============================================================
 * - Environment variables dari file .env (dimuat dengan dotenv)
 * - Mendukung dua mode:
 *   1. Variabel terpisah (DB_USER, DB_PASS, DB_NAME, DB_HOST, DB_PORT) [default]
 *   2. DATABASE_URL (connection string tunggal) – tinggal uncomment bagian yang sesuai
 *
 * ============================================================
 * PRIORITAS
 * ============================================================
 * - Jika menggunakan DATABASE_URL, aktifkan blok `urlConfig` dan komentari blok ekspor biasa.
 * - Pastikan variabel environment DATABASE_URL tersedia saat menggunakan mode tersebut.
 *
 * ============================================================
 * PENGGUNAAN DENGAN SEQUELIZE CLI
 * ============================================================
 * Sequelize CLI membaca properti berdasarkan NODE_ENV saat ini.
 * Contoh:
 *   NODE_ENV=development npx sequelize-cli db:migrate
 *   NODE_ENV=production node app.js
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan ubah struktur objek export tanpa menyesuaikan `models/index.js`.
 * - Jika menambah environment baru (staging), tambahkan konfigurasi di sini.
 * - Pastikan password database tidak hardcode; gunakan env var.
 * - Di production, atur pool size sesuai kapasitas server (default max=10).
 * - Logging di development aktif (console.log) untuk debugging, matikan di production/test.
 */

require('dotenv').config();

// ============================================================
// Konfigurasi Dasar (shared antar environment)
// ============================================================

/**
 * Base configuration yang akan di-extend oleh setiap environment.
 * @type {Object}
 */
const baseConfig = {
  dialect: 'mysql',
  logging: false,            // default: matikan logging (akan di-override per environment)
  define: {
    underscored: true,       // Ubah camelCase ke snake_case (contoh: createdAt → created_at)
    timestamps: true,        // Otomatis tambahkan kolom created_at dan updated_at
    paranoid: false,         // Tidak menggunakan soft delete (hard delete langsung)
  },
};

// ============================================================
// Konfigurasi per Environment (menggunakan variabel terpisah)
// ============================================================

/**
 * Konfigurasi untuk environment development.
 * Menampilkan query SQL ke console untuk memudahkan debugging.
 */
const development = {
  ...baseConfig,
  username: process.env.DB_USER,
  password: process.env.DB_PASS || null,   // null lebih aman daripada string kosong
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  logging: console.log,                    // Tampilkan query SQL di development
};

/**
 * Konfigurasi untuk environment test (biasanya digunakan untuk unit testing).
 * Logging dimatikan untuk menghindari clutter saat test.
 */
const test = {
  ...baseConfig,
  username: process.env.DB_USER,
  password: process.env.DB_PASS || null,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  logging: false,                          // Tidak perlu log query saat test
};

/**
 * Konfigurasi untuk environment production.
 * Mengaktifkan connection pooling dan mematikan logging untuk performa.
 */
const production = {
  ...baseConfig,
  use_env_variable: 'MYSQL_PUBLIC_URL', // Gunakan DATABASE_URL jika tersedia, fallback ke variabel terpisah
  logging: false,                          // Matikan logging di production
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    // Required untuk Railway MySQL
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
};

// ============================================================
// Opsional: Konfigurasi menggunakan DATABASE_URL (connection string tunggal)
// ============================================================
/**
 * Jika ingin menggunakan DATABASE_URL (misal dari platform PaaS seperti Heroku, Railway),
 * aktifkan blok kode di bawah dengan meng-comentari module.exports yang lama.
 * 
 * Pastikan environment variable DATABASE_URL tersedia.
 *
 * const urlConfig = {
 *   development: { use_env_variable: 'DATABASE_URL', dialect: 'mysql', ...baseConfig },
 *   test: { use_env_variable: 'DATABASE_URL', dialect: 'mysql', ...baseConfig },
 *   production: { use_env_variable: 'DATABASE_URL', dialect: 'mysql', ...baseConfig },
 * };
 * module.exports = urlConfig;
 */

// ============================================================
// Ekspor konfigurasi berdasarkan NODE_ENV
// ============================================================

/**
 * Objek konfigurasi yang diekspor.
 * Sequelize CLI dan models/index.js akan membaca properti `development`, `test`, `production`
 * sesuai dengan nilai environment variable `NODE_ENV`.
 */
module.exports = {
  development,
  test,
  production,
};