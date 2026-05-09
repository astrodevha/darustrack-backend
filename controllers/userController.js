/**
 * controllers/userController.js
 *
 * Controller untuk manajemen akun pengguna oleh admin.
 * Pengguna (User) adalah entitas autentikasi yang mewakili semua peran:
 * admin, wali_kelas, orang_tua, dan kepala_sekolah.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /users      → daftar semua user (filter role opsional)
 * GET    /users/:id  → detail satu user
 * POST   /users      → tambah user baru
 * PUT    /users/:id  → update user (partial update)
 * DELETE /users/:id  → hapus user
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Validasi input menggunakan fastest-validator dengan schema yang jelas.
 * - Semua field yang masuk ke database di-whitelist secara eksplisit.
 * - Password di-hash di model (hook sebelum create/update), controller hanya
 *   meneruskan plaintext. Jika ingin hash di controller, implementasikan sendiri.
 * - Jangan pernah mengembalikan password atau token ke client.
 * - Gunakan SAFE_USER_ATTRIBUTES untuk query SELECT.
 *
 * @module userController
 */

// ============================================================
// Dependencies
// ============================================================
const Validator = require('fastest-validator');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

// ============================================================
// Constants
// ============================================================

/** Valid roles yang tersedia di sistem */
const VALID_ROLES = ['admin', 'wali_kelas', 'kepala_sekolah', 'orang_tua'];

/** Field yang aman dikembalikan ke client (tidak mengandung password, timestamp) */
const SAFE_USER_ATTRIBUTES = {
  exclude: ['password', 'created_at', 'updated_at'],
};

/** Validator instance (dibuat sekali, digunakan di semua fungsi) */
const v = new Validator();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Mendapatkan daftar user dengan filter role opsional.
 * Digunakan di getAllUsers untuk menghindari duplikasi kode validasi.
 *
 * @param {string|null} role - Role yang akan difilter (opsional)
 * @returns {Promise<Array>} Daftar user (tanpa password)
 * @throws {Error} Jika query gagal
 */
async function getUsersByRole(role = null) {
  const where = {};
  if (role && VALID_ROLES.includes(role)) {
    where.role = role;
  }
  return User.findAll({
    where,
    attributes: SAFE_USER_ATTRIBUTES,
    order: [['name', 'ASC']],
  });
}

/**
 * Memvalidasi input untuk create/update user.
 * @param {Object} data - Data yang akan divalidasi
 * @param {boolean} isUpdate - Jika true, semua field bersifat opsional
 * @returns {Array|null} Array error jika tidak valid, null jika valid
 */
function validateUserInput(data, isUpdate = false) {
  const schema = {
    name: { type: 'string', optional: isUpdate, empty: false },
    nip: { type: 'string', optional: true },
    email: { type: 'email', optional: isUpdate },
    password: { type: 'string', optional: isUpdate, min: 6 },
    role: {
      type: 'enum',
      values: VALID_ROLES,
      optional: isUpdate,
    },
  };
  const errors = v.validate(data, schema);
  return errors.length ? errors : null;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /users
 *
 * Daftar semua pengguna, opsional difilter berdasarkan role.
 *
 * @param {import('express').Request} req - Query: { role? }
 * @param {import('express').Response} res
 */
exports.getAllUsers = async (req, res) => {
  const { role } = req.query;

  if (role && !VALID_ROLES.includes(role)) {
    return res.status(400).json({
      message: `Role tidak valid. Pilihan: ${VALID_ROLES.join(', ')}`,
    });
  }

  try {
    const users = await getUsersByRole(role || null);
    return res.json(users);
  } catch (error) {
    console.error('[user/getAll] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar pengguna' });
  }
};

/**
 * GET /users/:id
 *
 * Detail satu pengguna berdasarkan ID.
 *
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: SAFE_USER_ATTRIBUTES,
    });
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    return res.json(user);
  } catch (error) {
    console.error('[user/getById] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data pengguna' });
  }
};

/**
 * POST /users
 *
 * Menambahkan pengguna baru. Password akan di-hash secara otomatis oleh model.
 *
 * [Fix BUG #33] Semua operasi async dalam try/catch.
 * [Fix BUG #7] Whitelist field eksplisit.
 *
 * @param {import('express').Request} req - Body: { name, email, password, role, nip? }
 * @param {import('express').Response} res
 */
exports.createUser = async (req, res) => {
  // Validasi input (sinkron)
  const validationErrors = validateUserInput(req.body, false);
  if (validationErrors) {
    return res.status(400).json({ message: 'Data tidak valid', errors: validationErrors });
  }

  try {
    const { name, nip, email, password, role } = req.body;

    // Cek duplikat email
    const existingEmail = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }

    // Cek duplikat NIP jika diberikan
    const trimmedNip = nip?.trim() || null;
    if (trimmedNip) {
      const existingNip = await User.findOne({ where: { nip: trimmedNip } });
      if (existingNip) {
        return res.status(409).json({ message: 'NIP sudah digunakan oleh pengguna lain' });
      }
    }

    // Whitelist field – hanya field yang diizinkan yang masuk ke create
    const newUser = await User.create({
      name: name.trim(),
      nip: trimmedNip,
      email: email.toLowerCase(),
      password, // plaintext, model akan hash via hook beforeCreate
      role,
    });

    return res.status(201).json({
      message: 'Pengguna berhasil ditambahkan',
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('[user/create] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      return res.status(409).json({
        message: `${field === 'email' ? 'Email' : 'NIP'} sudah digunakan`,
      });
    }
    return res.status(500).json({ message: 'Gagal menambahkan pengguna' });
  }
};

/**
 * PUT /users/:id
 *
 * Memperbarui data pengguna (partial update). Hanya field yang dikirim yang diubah.
 * Jika password disertakan, akan di-hash ulang (hook model).
 *
 * [Fix BUG #29] try/catch ditambahkan.
 * [Fix BUG #8] Return 404 jika user tidak ditemukan.
 * [Fix BUG #7] Whitelist field – tidak menggunakan update(req.body).
 *
 * @param {import('express').Request} req - Params: { id }, Body: { name?, nip?, email?, role?, password? }
 * @param {import('express').Response} res
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validasi input (semua field opsional karena partial update)
    const validationErrors = validateUserInput(req.body, true);
    if (validationErrors) {
      return res.status(400).json({ message: 'Data tidak valid', errors: validationErrors });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const { name, nip, email, password, role } = req.body;

    // Update field secara eksplisit jika dikirim
    if (name !== undefined) user.name = name.trim();
    if (role !== undefined) user.role = role;

    // Email: cek duplikat jika berubah
    if (email !== undefined && email.toLowerCase() !== user.email) {
      const duplicate = await User.findOne({ where: { email: email.toLowerCase() } });
      if (duplicate && duplicate.id !== user.id) {
        return res.status(409).json({ message: 'Email sudah digunakan pengguna lain' });
      }
      user.email = email.toLowerCase();
    }

    // NIP: konversi string kosong ke null, cek duplikat jika berubah
    if (nip !== undefined) {
      const trimmedNip = nip.trim() || null;
      if (trimmedNip && trimmedNip !== user.nip) {
        const duplicate = await User.findOne({ where: { nip: trimmedNip } });
        if (duplicate && duplicate.id !== user.id) {
          return res.status(409).json({ message: 'NIP sudah digunakan pengguna lain' });
        }
      }
      user.nip = trimmedNip;
    }

    // Password: model akan handle hash via hook beforeUpdate
    if (password !== undefined) {
      user.password = password;
    }

    await user.save();

    return res.json({
      message: 'Pengguna berhasil diperbarui',
      data: {
        id: user.id,
        name: user.name,
        nip: user.nip,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[user/update] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      return res.status(409).json({
        message: `${field === 'email' ? 'Email' : 'NIP'} sudah digunakan`,
      });
    }
    return res.status(500).json({ message: 'Gagal memperbarui pengguna' });
  }
};

/**
 * DELETE /users/:id
 *
 * Menghapus pengguna. Akan gagal jika masih memiliki data terkait (FK constraint).
 *
 * [Fix BUG #29] try/catch ditambahkan.
 * [Fix BUG #8] Return 404 jika user tidak ditemukan.
 *
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    await user.destroy();
    return res.json({ message: 'Pengguna berhasil dihapus' });
  } catch (error) {
    console.error('[user/delete] Error:', error);
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        message: 'Pengguna tidak dapat dihapus karena masih memiliki data terkait',
      });
    }
    return res.status(500).json({ message: 'Gagal menghapus pengguna' });
  }
};