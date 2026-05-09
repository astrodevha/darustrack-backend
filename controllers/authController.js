/**
 * controllers/authController.js
 *
 * Controller untuk autentikasi pengguna Darustrack API.
 * Mengelola login, refresh token, logout, serta profil pengguna.
 *
 * ============================================================
 * ARSITEKTUR TOKEN
 * ============================================================
 * - Access Token  : JWT berumur pendek (4-8 jam), dikirim via Authorization header
 * - Refresh Token : JWT berumur 7 hari, disimpan dalam httpOnly cookie
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * POST   /auth/login          → Login dengan email & password
 * POST   /auth/refresh-token  → Perbarui access token (menggunakan cookie)
 * POST   /auth/logout         → Logout, revoke semua refresh token user
 * GET    /auth/profile        → Ambil profil user yang sedang login
 * PUT    /auth/profile        → Update profil user (termasuk email/password)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Kunci untuk token rotation: field `token_version` di tabel users.
 * - Saat mengubah password, token_version otomatis dinaikkan → semua session direvoke.
 * - Cookie refresh token menggunakan httpOnly, secure di production, sameSite='None'.
 * - Jangan ubah nilai `maxAge` cookie tanpa menyesuaikan expiry JWT refresh token.
 *
 * @module authController
 */

// ============================================================
// Dependencies
// ============================================================
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const { Op } = require('sequelize');

// ============================================================
// Helper Functions
// ============================================================

/**
 * Konfigurasi cookie untuk refresh token (httpOnly, secure di production).
 * @returns {import('express').CookieOptions}
 */
function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
  };
}

/**
 * Opsi cookie untuk menghapus refresh token (maxAge = 0).
 * @returns {import('express').CookieOptions}
 */
function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 0,
  };
}

/**
 * Validasi format email sederhana.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validasi kekuatan password (minimal 8 karakter).
 * @param {string} password
 * @returns {boolean}
 */
function isStrongPassword(password) {
  return password && password.length >= 8;
}

// ============================================================
// Controllers
// ============================================================

/**
 * POST /auth/login
 *
 * Login user dengan email dan password.
 * Pesan error generik untuk mencegah user enumeration.
 *
 * @param {import('express').Request} req - Body: { email, password }
 * @param {import('express').Response} res
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ message: 'Email wajib diisi' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ message: 'Password wajib diisi' });
  }

  try {
    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() },
      attributes: ['id', 'name', 'role', 'password', 'token_version'],
    });

    // Pesan identik untuk email tidak ditemukan dan password salah
    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(user),
      generateRefreshToken(user),
    ]);

    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    return res.json({
      message: 'Login berhasil',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * POST /auth/refresh-token
 *
 * Memperbarui access token dan refresh token menggunakan token dari cookie.
 * [H-02] Implementasi token rotation dengan token_version.
 *
 * Alur:
 *   1. Verifikasi signature & ekstraksi payload refresh token.
 *   2. Cari user di DB, bandingkan token_version.
 *   3. Jika versi cocok, naikkan token_version di DB.
 *   4. Terbitkan access token dan refresh token baru.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: 'Sesi tidak ditemukan. Silakan login kembali.' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (jwtError) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      return res.status(401).json({ message: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.' });
    }

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'name', 'role', 'token_version'],
    });

    if (!user) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      return res.status(401).json({ message: 'Pengguna tidak ditemukan. Silakan login kembali.' });
    }

    // Token rotation: bandingkan token_version
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
      res.clearCookie('refreshToken', getClearCookieOptions());
      console.warn(
        `[auth/refresh] Token rotation mismatch — userId: ${user.id} — ` +
        `tokenVersion di JWT: ${decoded.tokenVersion}, di DB: ${user.token_version}`
      );
      return res.status(401).json({
        message: 'Sesi tidak valid. Kemungkinan sesi Anda digunakan dari perangkat lain. Silakan login kembali.',
      });
    }

    const newTokenVersion = (user.token_version || 0) + 1;
    await user.update({ token_version: newTokenVersion });

    const updatedUser = { ...user.toJSON(), token_version: newTokenVersion };
    const [newAccessToken, newRefreshToken] = await Promise.all([
      generateAccessToken(updatedUser),
      generateRefreshToken(updatedUser),
    ]);

    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    return res.json({
      message: 'Token berhasil diperbarui',
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error('[auth/refreshToken] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * POST /auth/logout
 *
 * Logout user: menaikkan token_version (revoke semua refresh token),
 * dan menghapus cookie refresh token.
 *
 * @param {import('express').Request} req - req.user diisi middleware accessValidation
 * @param {import('express').Response} res
 */
exports.logout = async (req, res) => {
  try {
    await User.increment('token_version', { where: { id: req.user.id } });
    res.clearCookie('refreshToken', getClearCookieOptions());
    return res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('[auth/logout] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /auth/profile
 *
 * Mengambil profil user yang sedang login.
 * Hanya mengembalikan field aman: name, nip, email.
 *
 * @param {import('express').Request} req - req.user.id
 * @param {import('express').Response} res
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['name', 'nip', 'email'],
    });
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    return res.json({
      name: user.name,
      nip: user.nip,
      email: user.email,
    });
  } catch (error) {
    console.error('[auth/getProfile] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * PUT /auth/profile
 *
 * Update profil user yang sedang login.
 * [M-01] Jika mengubah email atau password, current_password WAJIB dan harus cocok.
 *
 * Aturan:
 *   - Hanya name → tanpa current_password.
 *   - Mengubah email dan/atau password → current_password wajib.
 *   - Password baru minimal 8 karakter, tidak boleh sama dengan lama.
 *   - Email baru harus valid dan tidak digunakan user lain.
 *
 * @param {import('express').Request} req - Body: { name?, email?, password?, current_password? }
 * @param {import('express').Response} res
 */
exports.updateProfile = async (req, res) => {
  const { name, email, password, current_password } = req.body;

  if (!name && !email && !password) {
    return res.status(400).json({
      message: 'Tidak ada data yang diperbarui. Kirimkan setidaknya satu field: name, email, atau password.',
    });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: 'Format email tidak valid' });
  }
  if (password && !isStrongPassword(password)) {
    return res.status(400).json({ message: 'Password baru minimal 8 karakter' });
  }

  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'nip', 'email', 'password', 'token_version'],
    });
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    // [M-01] Perubahan sensitif membutuhkan current_password
    const isChangingSensitive = email || password;
    if (isChangingSensitive) {
      if (!current_password) {
        return res.status(400).json({
          message: 'Password saat ini wajib diisi untuk mengubah email atau password',
        });
      }
      const isValidCurrent = await bcrypt.compare(current_password, user.password);
      if (!isValidCurrent) {
        return res.status(401).json({ message: 'Password saat ini tidak benar' });
      }
    }

    // Cek duplikasi email
    if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const existing = await User.findOne({
        where: { email: email.trim().toLowerCase(), id: { [Op.ne]: user.id } },
        attributes: ['id'],
      });
      if (existing) {
        return res.status(409).json({ message: 'Email sudah digunakan oleh pengguna lain' });
      }
    }

    // Password baru tidak boleh sama dengan lama
    if (password) {
      const isSame = await bcrypt.compare(password, user.password);
      if (isSame) {
        return res.status(400).json({ message: 'Password baru tidak boleh sama dengan password saat ini' });
      }
    }

    // Terapkan perubahan
    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (password) {
      user.password = await bcrypt.hash(password, 10);
      user.token_version = (user.token_version || 0) + 1; // revoke semua refresh token
    }

    await user.save();

    if (password) {
      res.clearCookie('refreshToken', getClearCookieOptions());
    }

    return res.json({
      message: 'Profil berhasil diperbarui' + (password ? '. Silakan login kembali di semua perangkat.' : ''),
      data: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[auth/updateProfile] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};