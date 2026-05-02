const { Semester } = require('../models');

module.exports = async function loadActiveSemester(req, res, next) {
  try {
    const semester = await Semester.findOne({ where: { is_active: true } });
    if (!semester) return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    req.activeSemester = semester;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal memuat semester aktif', error: err.message });
  }
};