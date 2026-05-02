/**
 * middlewares/accessValidation.js
 * --------------------------------
 * Middleware autentikasi berbasis JWT (Bearer token).
 *
 * Alur kerja:
 *  1. Baca header `Authorization: Bearer <token>`
 *  2. Verifikasi token menggunakan JWT_SECRET
 *  3. Cari user di database (dengan cache LRU 5 detik untuk performa)
 *  4. Set `req.user` dengan data user yang valid, lalu panggil `next()`
 *
 * LRU Cache mencegah database query berulang untuk setiap request dari
 * user yang sama dalam window 5 detik. Max 1000 entry.
 *
 * @module middlewares/accessValidation
 */

const asyncHandler = require('express-async-handler');
const jwt          = require('jsonwebtoken');
const LRU          = require('lru-cache');
const { User }     = require('../models');

/**
 * Cache user berdasarkan user ID.
 * TTL: 5 detik — cukup untuk menghindari flood query, tapi tidak terlalu lama
 * sehingga perubahan role/status user tetap propagasi dengan cepat.
 */
const userCache = new LRU({ max: 1000, ttl: 5_000 });

module.exports = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';

  // Validasi format header Authorization
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Token tidak ditemukan' });
  }

  const token = auth.split(' ')[1];

  // Verifikasi dan decode JWT
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Token tidak valid', error: err.message });
  }

  // Cek cache terlebih dahulu sebelum hit database
  let user = userCache.get(decoded.id);

  if (!user) {
    // Hanya ambil field yang diperlukan untuk autorisasi
    user = await User.findByPk(decoded.id, {
      raw:        true,
      attributes: ['id', 'role'],
    });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User tidak ditemukan' });
    }

    userCache.set(decoded.id, user);
  }

  req.user = user;
  return next();
});
