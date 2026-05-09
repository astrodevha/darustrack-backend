/**
 * middlewares/accessValidation.js
 *
 * Middleware autentikasi berbasis JWT (Bearer Token).
 * Memverifikasi token dari header Authorization: `Bearer <token>`.
 *
 * ============================================================
 * ALUR KERJA
 * ============================================================
 * 1. Baca header `Authorization: Bearer <token>`
 * 2. Verifikasi token dengan JWT_SECRET
 * 3. Cek user di cache LRU (TTL 5 detik) — hindari hit DB berulang
 * 4. Jika tidak ada di cache, ambil dari DB dan simpan ke cache
 * 5. Set `req.user = { id, role }` dan lanjutkan ke middleware/handler berikutnya
 *
 * ============================================================
 * KEAMANAN & PERFORMA
 * ============================================================
 * [Cache] – Performance Optimization:
 *   Menggunakan LRU cache dengan TTL 5 detik untuk user data.
 *   Alasan TTL pendek: Jika admin mengubah role atau menonaktifkan user,
 *   perubahan akan terefleksi dalam maksimal 5 detik tanpa invalidasi manual.
 *   Konfigurasi: max 1000 entri, ttl 5000ms.
 *
 * ============================================================
 * DEPENDENCIES
 * ============================================================
 * - express-async-handler : menangani error async otomatis
 * - jsonwebtoken          : verifikasi token JWT
 * - lru-cache             : cache sederhana untuk user data
 * - models/User           : model pengguna
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Middleware ini HARUS dipasang SEBELUM `roleValidation` karena
 *   roleValidation bergantung pada `req.user` yang diisi oleh middleware ini.
 * - Jangan mengubah pesan generic di response 401 tanpa mempertimbangkan
 *   implikasi keamanan (mencegah informasi bocor ke client).
 * - Jika menggunakan serverless/jika cache tidak sesuai, atur ulang konfigurasi
 *   LRU (max, ttl) sesuai kapasitas dan kebutuhan propagasi perubahan data.
 *
 * @module accessValidation
 */

// ============================================================
// Dependencies
// ============================================================
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const LRU = require('lru-cache');
const { User } = require('../models');

// ============================================================
// Cache Configuration
// ============================================================

/**
 * Cache untuk menyimpan data user berdasarkan ID.
 * @type {LRU<string, Object>}
 */
const userCache = new LRU({
  max: 1000,       // Maksimal 1000 entri dalam cache
  ttl: 5000,       // Time-to-live: 5 detik (milidetik)
});

// ============================================================
// Middleware Utama
// ============================================================

/**
 * Middleware autentikasi JWT.
 *
 * Memverifikasi token dan mengisi `req.user` dengan { id, role }.
 * Menggunakan asyncHandler agar error async otomatis diteruskan ke global error handler.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
module.exports = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  // Validasi format: harus "Bearer <token>"
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Token autentikasi tidak ditemukan. Sertakan header Authorization: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  // Verifikasi dan decode token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    /**
     * [BUG #37] Security Fix:
     * Tidak mengembalikan error message detail ke client untuk mencegah
     * informasi bocor tentang struktur token (expired, signature, malformed).
     * Detail error tetap dicatat di server untuk debugging.
     */
    console.warn(`[accessValidation] Token verification failed: ${err.name} — ${err.message}`);

    return res.status(401).json({
      message: 'Token tidak valid atau sudah kedaluwarsa. Silakan login kembali.',
    });
  }

  // Cek cache terlebih dahulu untuk mengurangi query database
  let user = userCache.get(decoded.id);

  if (!user) {
    // Cache miss — ambil data user dari database
    user = await User.findByPk(decoded.id, {
      raw: true,        // Hanya data field, tanpa instance Sequelize
      attributes: ['id', 'role'],
    });

    if (!user) {
      // Token valid, tetapi user sudah dihapus dari sistem
      return res.status(401).json({
        message: 'Token tidak valid. Akun tidak ditemukan.',
      });
    }

    // Simpan ke cache untuk request berikutnya
    userCache.set(decoded.id, user);
  }

  /**
   * Set data user ke request object untuk digunakan oleh middleware/handler berikutnya
   * (misalnya roleValidation, controller).
   */
  req.user = user;
  return next();
});