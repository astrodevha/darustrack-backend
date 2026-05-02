/**
 * controllers/authController.js
 * ------------------------------
 * Controller untuk autentikasi pengguna.
 *
 * Endpoints yang dilayani:
 *  - POST /auth/login         → Login dengan email & password
 *  - POST /auth/refresh-token → Refresh access token menggunakan cookie
 *  - GET  /auth/profile       → Ambil profil user yang sedang login
 *  - PUT  /auth/profile       → Update profil user yang sedang login
 *
 * Keamanan:
 *  - Password di-hash menggunakan bcrypt sebelum disimpan ke DB
 *  - Access token (JWT) berdurasi pendek, refresh token disimpan di httpOnly cookie
 *  - Plaintext password TIDAK pernah dikembalikan dalam response
 *
 * @module controllers/authController
 */

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');

// ── Login ────────────────────────────────────────────────────────────────────

/**
 * Login pengguna dengan email dan password.
 *
 * @route  POST /auth/login
 * @access Public
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // Validasi input wajib
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi' });
  }

  try {
    // Cari user beserta password hash-nya
    const user = await User.findOne({
      where:      { email },
      attributes: ['id', 'name', 'role', 'password'],
    });

    // Gunakan pesan error generik agar penyerang tidak bisa enumerate email
    if (!user) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Verifikasi password dengan bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // Buat access token dan refresh token secara paralel
    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(user),
      generateRefreshToken(user),
    ]);

    // Simpan refresh token di httpOnly cookie (tidak bisa diakses JavaScript client)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',    // HTTPS only di production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 hari dalam milliseconds
    });

    return res.status(200).json({
      message: 'Login berhasil',
      accessToken,
      user: {
        id:   user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[auth/login] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * Menerbitkan access token baru menggunakan refresh token dari cookie.
 *
 * @route  POST /auth/refresh-token
 * @access Public (menggunakan refresh token dari cookie)
 */
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: 'Refresh token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user    = await User.findByPk(decoded.id, { attributes: ['id', 'name', 'role'] });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const newAccessToken = generateAccessToken(user);
    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    // Token kedaluwarsa atau tidak valid
    return res.status(403).json({ message: 'Refresh token tidak valid atau sudah kedaluwarsa' });
  }
};

// ── Get Profile ───────────────────────────────────────────────────────────────

/**
 * Mengambil data profil user yang sedang login.
 *
 * @route  GET /auth/profile
 * @access Private (butuh access token)
 */
exports.getProfile = async (req, res) => {
  try {
    // Hanya ambil field yang dibutuhkan — password tidak perlu dimuat
    const user = await User.findByPk(req.user.id, {
      attributes: ['name', 'nip', 'email'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    return res.json({
      name:  user.name,
      nip:   user.nip,
      email: user.email,
    });
  } catch (error) {
    console.error('[auth/getProfile] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Update Profile ────────────────────────────────────────────────────────────

/**
 * Mengupdate profil user yang sedang login.
 * Field yang bisa diupdate: name, email, password.
 *
 * KEAMANAN: Password baru akan di-hash sebelum disimpan.
 * Plaintext password TIDAK dikembalikan dalam response.
 *
 * @route  PUT /auth/profile
 * @access Private (butuh access token)
 */
exports.updateProfile = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Update field hanya jika dikirimkan dalam request body
    if (name)     user.name  = name;
    if (email)    user.email = email;
    if (password) {
      // Selalu hash password baru sebelum menyimpan ke database
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    // Kembalikan data yang diupdate — TANPA password dalam bentuk apapun
    return res.json({
      message: 'Profil berhasil diperbarui',
      data: {
        name:  user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[auth/updateProfile] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
