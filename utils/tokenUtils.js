/**
 * utils/tokenUtils.js
 *
 * Utilitas untuk menghasilkan JWT access token dan refresh token.
 *
 * ============================================================
 * ARSITEKTUR TOKEN DARUSTRACK
 * ============================================================
 * - Access Token  : JWT berumur pendek (4-8 jam), dikirim di header
 *                   `Authorization: Bearer <token>` pada setiap request.
 * - Refresh Token : JWT berumur 7 hari, disimpan di httpOnly cookie,
 *                   digunakan untuk mendapatkan access token baru tanpa login ulang.
 *
 * Mengapa dua jenis token?
 *   Jika access token dicuri (XSS, log leakage), kerusakan terbatas karena
 *   akan kedaluwarsa dalam beberapa jam. Refresh token aman di httpOnly cookie
 *   karena JavaScript di browser tidak dapat membacanya.
 *
 * ============================================================
 * KEAMANAN – Token Rotation & Revocation
 * ============================================================
 *   Token Rotation dengan `tokenVersion`:
 *   1. Tabel `users` memiliki kolom `token_version` (INTEGER, default 0)
 *   2. Setiap refresh token diterbitkan, nilai `token_version` user saat itu
 *      disematkan di payload JWT sebagai `tokenVersion`.
 *   3. Saat `/auth/refresh-token` dipanggil:
 *      a. Verifikasi signature JWT.
 *      b. Bandingkan `decoded.tokenVersion` dengan `user.token_version` di DB.
 *      c. Jika TIDAK SAMA → token sudah dirotasi atau direvoke → tolak.
 *      d. Jika SAMA → naikkan `token_version` di DB → terbitkan token baru.
 *   4. Logout: naikkan `token_version` → semua refresh token lama langsung tidak valid.
 *
 * Contoh skenario serangan yang tertangani:
 *   - Attacker mencuri refresh token (tokenVersion=5).
 *   - User legitimate melakukan refresh → DB: token_version menjadi 6.
 *   - Attacker mencoba pakai token curian (versi 5) → ditolak (5 ≠ 6).
 *
 * ============================================================
 * MIGRATION YANG DIPERLUKAN
 * ============================================================
 * Jalankan: `migrations/20260507000002-add-token-version-to-users.js`
 * untuk menambahkan kolom `token_version` ke tabel `users`.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Durasi access token: ubah di `ACCESS_TOKEN_EXPIRY`.
 * - JANGAN set access token > 24 jam.
 * - Refresh token boleh 7-30 hari (disimpan di httpOnly cookie).
 * - Jangan tambahkan data sensitif (password, email) ke payload JWT —
 *   payload bisa didekode tanpa secret key.
 * - Pastikan kolom `token_version` ada sebelum menggunakan generateRefreshToken.
 *
 * @module tokenUtils
 */

// ============================================================
// Dependencies
// ============================================================
const jwt = require('jsonwebtoken');

// ============================================================
// Constants
// ============================================================

/**
 * Durasi access token berdasarkan role pengguna.
 *
 * Pertimbangan keamanan:
 *   - admin          : 4 jam — sesi kerja pendek, hak akses paling tinggi.
 *   - wali_kelas     : 8 jam — mencakup satu hari kerja penuh.
 *   - kepala_sekolah : 8 jam — monitoring harian, tidak butuh akses malam.
 *   - orang_tua      : 8 jam — cukup untuk cek data anak satu hari.
 *
 * @type {Record<string, string>}
 */
const ACCESS_TOKEN_EXPIRY = {
  admin: '4h',
  wali_kelas: '8h',
  kepala_sekolah: '8h',
  orang_tua: '8h',
};

/** Durasi default refresh token (jika tidak diatur di environment) */
const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';

// ============================================================
// Helper Functions (tidak diekspor)
// ============================================================

/**
 * Mendapatkan durasi access token yang sesuai untuk role user.
 *
 * @param {string} role - Role user
 * @returns {string} Durasi dalam format string (misal: '4h', '8h')
 */
function getAccessTokenExpiry(role) {
  return ACCESS_TOKEN_EXPIRY[role] || '4h';
}

// ============================================================
// Exported Functions
// ============================================================

/**
 * Menghasilkan JWT access token untuk user yang berhasil login atau refresh.
 *
 * Payload yang disematkan (minimal – hanya data yang dibutuhkan sistem):
 *   id   : Untuk lookup user di middleware accessValidation.
 *   name : Ditampilkan di frontend tanpa query tambahan.
 *   role : Untuk cek otorisasi di roleValidation.
 *
 * KEAMANAN: Payload JWT bisa didekode oleh siapa pun tanpa secret key.
 * JANGAN tambahkan: password, email, nomor telepon, atau data sensitif lainnya.
 *
 * @param {Object} user - Object user
 * @param {string} user.id - ID user (nanoid 10 karakter)
 * @param {string} user.name - Nama lengkap user
 * @param {string} user.role - Role (admin, wali_kelas, kepala_sekolah, orang_tua)
 * @returns {string} JWT access token yang ditandatangani dengan JWT_SECRET
 */
const generateAccessToken = (user) => {
  const expiresIn = getAccessTokenExpiry(user.role);

  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn },
  );
};

/**
 * Menghasilkan JWT refresh token dengan mekanisme rotasi via `tokenVersion`.
 *
 * [Fix H-02] Field `tokenVersion` ditambahkan ke payload untuk mendukung
 * token rotation dan revocation.
 *
 * `tokenVersion` adalah nilai kolom `token_version` dari tabel `users`
 * pada saat token diterbitkan. Saat token digunakan di `/auth/refresh-token`,
 * nilai ini dibandingkan dengan `token_version` terkini di database.
 * Jika berbeda, token ditolak (sudah dirotasi atau direvoke).
 *
 * Alur token rotation:
 *   PENERBITAN (login/refresh):
 *     1. Baca user.token_version dari DB (misal: 5).
 *     2. Sematkan { tokenVersion: 5 } di payload JWT.
 *     3. Naikkan token_version di DB menjadi 6 (dilakukan di controller).
 *
 *   VALIDASI (saat refresh berikutnya):
 *     1. Decode JWT → decoded.tokenVersion = 5.
 *     2. Baca user.token_version dari DB → 6.
 *     3. 5 ≠ 6 → TOLAK (token sudah dirotasi).
 *
 *   REVOKASI (saat logout atau ganti password):
 *     Naikkan user.token_version di DB → semua token lama dengan versi lama
 *     menjadi tidak valid, bahkan jika masih dalam masa berlaku.
 *
 * Payload refresh token lebih minimal dari access token:
 *   id           : Untuk mencari user di DB.
 *   role         : Untuk membuat access token baru tanpa query tambahan.
 *   tokenVersion : Untuk validasi rotasi.
 *
 * @param {Object} user - Object user
 * @param {string} user.id - ID user
 * @param {string} user.role - Role user
 * @param {number} [user.token_version=0] - Versi token saat ini (dari DB)
 * @returns {string} JWT refresh token yang ditandatangani dengan REFRESH_TOKEN_SECRET
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      // [Fix H-02] tokenVersion untuk rotasi; default 0 jika field belum ada
      tokenVersion: user.token_version ?? 0,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRY,
    },
  );
};

// ============================================================
// Ekspor
// ============================================================
module.exports = {
  generateAccessToken,
  generateRefreshToken,
};