/**
 * middlewares/asyncHandler.js
 * ----------------------------
 * Wrapper utility untuk route handler async agar error yang di-throw
 * otomatis diteruskan ke Express error handler (`next(err)`) tanpa
 * perlu menulis blok `try/catch` manual di setiap handler.
 *
 * Cara penggunaan:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 *
 * @module middlewares/asyncHandler
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware yang menangkap rejected promise
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
