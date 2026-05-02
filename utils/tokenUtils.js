const jwt = require('jsonwebtoken');

const jwtExpiryByRole = {
  admin: '4h',
  wali_kelas: '12h',
  kepala_sekolah: '12h',
  orang_tua: '1y',
};

const generateAccessToken = (user) => {
  const expiresIn = jwtExpiryByRole[user.role] || '4h';
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
