const asyncHandler = require('express-async-handler');
const jwt         = require('jsonwebtoken');
const LRU         = require('lru-cache');
const { User }    = require('../models');

const userCache = new LRU({ max: 1000, ttl: 5000 }); // 5 detik

module.exports = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token' });
  }

  try {
    const token = auth.split(' ')[1];
    const { id } = jwt.verify(token, process.env.JWT_SECRET);

    let user = userCache.get(id);
    if (!user) {
      user = await User.findByPk(id, { raw: true, attributes: ['id', 'role'] });
      if (!user) return res.status(401).json({ message: 'Unauthorized: User not found' });
      userCache.set(id, user);
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token', error: err.message });
  }
});
