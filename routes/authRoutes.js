/**
 * routes/authRoutes.js
 *
 * Router untuk semua endpoint autentikasi Darustrack API.
 * Mengelola login, refresh token, profil, dan update profil.
 *
 * ============================================================
 * STRATEGI KEAMANAN
 * ============================================================
 * - Login       : Rate limiting ketat (loginLimiter) – mencegah brute force
 * - Refresh     : Rate limiting moderat (refreshLimiter) – mencegah token abuse
 * - Profile GET : Hanya bisa diakses dengan access token valid (accessValidation)
 * - Profile PUT : Memerlukan konfirmasi password lama (untuk perubahan email/password)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * POST   /auth/login          → login, dapatkan access token + refresh token (cookie)
 * POST   /auth/refresh-token  → perbarui access token menggunakan refresh token dari cookie
 * GET    /auth/profile        → ambil profil user (nama, nip, email)
 * PUT    /auth/profile        → update profil user (dengan verifikasi password untuk field sensitif)
 *
 * ============================================================
 * KEAMANAN
 * ============================================================
 * /auth/refresh-token dengan tambahan refreshLimiter.
 *         Konfigurasi: 30 request per 15 menit per IP.
 *
 * Update profil sensitif memerlukan current_password (diterapkan di controller).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Rate limiter refreshLimiter dibuat lokal di sini untuk visibilitas.
 * - Jika Redis tersedia (REDIS_URL), limiter otomatis menggunakan Redis store.
 * - Pastikan accessValidation dipasang sebelum endpoint yang membutuhkan token.
 * - Jangan mengubah batas rate limit tanpa mempertimbangkan beban legitimate.
 *
 * @module authRoutes
 */

// ============================================================
// Dependencies
// ============================================================
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const accessValidation = require('../middlewares/accessValidation');
const { loginLimiter } = require('../middlewares/rateLimiter');

// ============================================================
// Refresh Token Rate Limiter (H-09)
// ============================================================

/**
 * refreshLimiter – Rate limiter khusus untuk endpoint refresh token.
 *
 * Konfigurasi:
 *   - windowMs: 15 menit
 *   - max: 30 request per IP per window
 *
 * Mengapa 30 per 15 menit?
 *   - Client legitimate melakukan refresh token setiap kali access token kedaluwarsa.
 *   - Access token berumur 4-8 jam, sehingga refresh sangat jarang.
 *   - Nilai 30 memberikan buffer untuk multi-tab/multi-device.
 *   - Serangan (stolen token, DoS) yang melakukan >30 request dalam 15 menit
 *     dari satu IP akan diblokir.
 *
 * Logging: Jika limit tercapai, log peringatan ke console – ini sinyal anomali.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,          // 15 menit
  max: 30,                           // 30 request per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Terlalu banyak permintaan refresh token dari IP ini. Silakan coba lagi dalam beberapa menit.',
  },
  handler: (req, res, _next, options) => {
    console.warn(
      `[rateLimiter] Rate limit refresh-token tercapai — ` +
      `IP: ${req.ip} — Time: ${new Date().toISOString()}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

// ============================================================
// Public Endpoints (tanpa autentikasi)
// ============================================================

/**
 * POST /auth/login
 *
 * Login dengan email dan password.
 * Berhasil → mengembalikan access token (response body) dan refresh token (httpOnly cookie).
 *
 * @body {string} email - Email pengguna
 * @body {string} password - Password pengguna
 * @access Public
 */
router.post('/login', loginLimiter, authController.login);

/**
 * POST /auth/refresh-token
 *
 * Memperbarui access token menggunakan refresh token dari cookie.
 * Jika refresh token valid, server mengembalikan access token baru.
 *
 * [Fix H-09] Dilindungi refreshLimiter untuk mencegah abuse.
 *
 * @access Public (membutuhkan cookie refreshToken)
 */
router.post('/refresh-token', refreshLimiter, authController.refreshToken);

// ============================================================
// Protected Endpoints (memerlukan access token valid)
// ============================================================

/**
 * GET /auth/profile
 *
 * Mengambil data profil user yang sedang login (nama, nip, email).
 * Tidak memerlukan password.
 *
 * @header Authorization: Bearer <access_token>
 * @access Private
 */
router.get('/profile', accessValidation, authController.getProfile);

/**
 * PUT /auth/profile
 *
 * Memperbarui data profil user yang sedang login.
 * [Fix M-01] Jika mengubah email atau password, current_password wajib ada.
 *
 * Field yang dapat diubah:
 *   - name (opsional)
 *   - email (opsional, membutuhkan current_password jika diubah)
 *   - password (opsional, membutuhkan current_password jika diubah)
 *
 * @header Authorization: Bearer <access_token>
 * @body {string} [name] - Nama baru
 * @body {string} [email] - Email baru
 * @body {string} [password] - Password baru
 * @body {string} [current_password] - Password saat ini (wajib jika email/password diubah)
 * @access Private
 */
router.put('/profile', accessValidation, authController.updateProfile);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;