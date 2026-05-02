// Pembungkus untuk menangani error async/await tanpa try-catch berulang
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
