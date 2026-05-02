module.exports = (roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Anda harus login' });

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Akses ditolak' });
  }

  // validasi khusus wali_kelas / kepala_sekolah (jika masih dibutuhkan)
  if (req.user.role === 'wali_kelas' && req.user.class_id !== req.params.class_id) {
    return res.status(403).json({ message: 'Tidak berwenang mengakses data kelas ini' });
  }
  if (req.user.role === 'kepala_sekolah' && req.params.class_id) {
    return res.status(403).json({ message: 'Kepala sekolah tidak memerlukan class_id' });
  }

  next();
};
