/**
 * middlewares/asyncHandler.js
 *
 * Wrapper utility untuk route handler Express yang bersifat async.
 * Menangkap Promise rejection secara otomatis dan meneruskannya ke
 * Express global error handler (`next(err)`).
 *
 * ============================================================
 * TUJUAN & MANFAAT
 * ============================================================
 * Tanpa wrapper ini, setiap route handler async harus dibungkus dengan
 * blok try/catch manual untuk menangkap error dan meneruskannya ke next():
 *
 * // Tanpa asyncHandler (verbose, rawan duplikasi)
 * app.get('/users', async (req, res, next) => {
 *   try {
 *     const users = await User.findAll();
 *     res.json(users);
 *   } catch (err) {
 *     next(err);
 *   }
 * });
 *
 * // Dengan asyncHandler (clean, DRY)
 * app.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 *
 * ============================================================
 * CARA KERJA
 * ============================================================
 * 1. asyncHandler menerima fungsi async (fn) sebagai parameter.
 * 2. Mengembalikan fungsi middleware Express (req, res, next).
 * 3. Di dalamnya, Promise.resolve(fn(req, res, next)) dipanggil.
 * 4. Jika fn melempar error atau Promise rejection, .catch(next) akan
 *    menangkapnya dan meneruskan error ke Express error handler.
 * 5. Jika fn berhasil dijalankan (resolved), middleware selesai normal.
 *
 * ============================================================
 * KETAHANAN
 * ============================================================
 * Promise.resolve() digunakan untuk mengamankan dari error sinkron:
 *   - Jika fn adalah fungsi sinkron (bukan async) namun tetap bisa throw,
 *     tetap akan tertangkap karena Promise.resolve mengubahnya menjadi
 *     Promise yang akan di-catch.
 *   - Jika fn mengembalikan Promise biasa, Promise.resolve() akan
 *     mengembalikan Promise tersebut.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan menghapus Promise.resolve(). Ini memastikan error sinkron
 *   (seperti ReferenceError di dalam fungsi) juga tertangani.
 * - Wrapper ini harus digunakan untuk SEMUA route handler yang melakukan
 *   operasi asynchronous (database, API eksternal, dll.) untuk menjaga
 *   konsistensi error handling.
 * - Jika ada kebutuhan logging error sebelum diteruskan, dapat diekstensi
 *   dengan menambahkan log di dalam catch() sebelum memanggil next(err).
 *
 * @module asyncHandler
 * @param {Function} fn - Fungsi route handler async: (req, res, next) => Promise<any>
 * @returns {Function} Express middleware function yang menangani Promise rejection
 *
 * @example
 * const asyncHandler = require('./middlewares/asyncHandler');
 *
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);