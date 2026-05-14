/**
 * app.js
 *
 * Entry point Express untuk Darustrack API.
 * Tanggung jawab: konfigurasi middleware global, pendaftaran route,
 * verifikasi database, dan pemasangan error handler.
 *
 * ============================================================
 * TANGGUNG JAWAB
 * ============================================================
 * - Konfigurasi middleware global (CORS, Helmet, Morgan, compression)
 * - Pendaftaran semua route API dengan proteksi autentikasi & role
 * - Verifikasi koneksi database saat startup
 * - Pemasangan global error handler (Fix H-08)
 *
 * ============================================================
 * KEAMANAN
 * ============================================================
 * Morgan logger dikonfigurasi berbeda per environment:
 *   - DEVELOPMENT: format 'dev' (ringkas, colorized, cocok untuk debugging lokal)
 *   - PRODUCTION : format 'combined' (Apache log, cocok untuk log aggregator)
 *   - PRODUCTION skip log untuk health check endpoint (GET /)
 *   - jangan pernah menempatkan token/sensitif di query string
 *
 * Global error handler dipasang sebagai middleware terakhir untuk 
 * mencegah kebocoran stack trace ke client di production.
 *
 * trust proxy diaktifkan agar rate limiter membaca IP asli client.
 *
 * ============================================================
 * STRUKTUR ROUTE
 * ============================================================
 * PUBLIK (tanpa autentikasi):
 *   GET  /                → health check
 *   POST /auth/*          → login, refresh token
 *
 * ADMIN ONLY:
 *   /academic-years, /users, /classes, /students
 *
 * ROLE SPESIFIK:
 *   /teachers   (wali_kelas)
 *   /parents    (orang_tua)
 *   /headmaster (kepala_sekolah)
 *
 * SEMUA ROLE TERAUTENTIKASI:
 *   /semesters, /curriculums, /subjects, /academic-calendar
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan tambahkan data sensitif (token, password) di URL/query string.
 * - Saat menambah route baru, pastikan middleware accessValidation dan
 *   roleValidation sesuai dengan kebutuhan.
 * - Error handler HARUS tetap sebagai middleware terakhir.
 *
 * @module app
 */

// ============================================================
// Initial Setup
// ============================================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('morgan');

// ============================================================
// Route Imports
// ============================================================
const indexRouter = require('./routes/index');
const authRouter = require('./routes/authRoutes');
const academicYearsRouter = require('./routes/academicYearRoutes');
const semestersRouter = require('./routes/semesterRoutes');
const usersRouter = require('./routes/userRoutes');
const teachersRouter = require('./routes/teacherRoutes');
const parentsRouter = require('./routes/parentRoutes');
const headmasterRouter = require('./routes/headmasterRoutes');
const classesRouter = require('./routes/classRoutes');
const studentsRouter = require('./routes/studentRoutes');
const curriculumsRouter = require('./routes/curriculumRoutes');
const subjectsRouter = require('./routes/subjectRoutes');
const academicCalendarRouter = require('./routes/academicCalendarRoutes');

// ============================================================
// Middleware Imports
// ============================================================
const accessValidation = require('./middlewares/accessValidation');
const roleValidation = require('./middlewares/roleValidation');
const errorHandler = require('./middlewares/errorHandler'); // [Fix H-08]

// ============================================================
// App Initialization
// ============================================================
const app = express();

// ============================================================
// Trust Proxy (untuk rate limiter membaca IP asli)
// ============================================================
/**
 * [Fix C-01] Aktifkan trust proxy agar req.ip mengembalikan IP client asli.
 * Nilai 1 berarti percaya satu level proxy (Nginx, Railway, dll).
 * Diperlukan untuk rate limiter (loginLimiter) bekerja dengan benar.
 */
app.set('trust proxy', 1);

// ============================================================
// CORS Configuration
// ============================================================
/**
 * Daftar origin yang diizinkan.
 * Bisa dikonfigurasi via environment variable ALLOWED_ORIGINS (comma separated).
 * Default + localhost dan frontend Vercel.
 */
const corsOptions = {
  origin: 'https://darustrack.vercel.app', // Ganti dengan URL Vercel Anda
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================================
// Morgan Logger (Per Environment)
// ============================================================
/**
 * [Fix M-09] Morgan dikonfigurasi berbeda per environment.
 *
 * DEVELOPMENT: format 'dev' – ringkas, colorized, ideal untuk debugging lokal.
 * PRODUCTION : format 'combined' – Apache log format, cocok untuk log aggregator.
 *
 * Di production, skip logging health check request (GET /) yang sukses (200)
 * untuk mengurangi noise log dari uptime monitor.
 *
 * KEAMANAN: Jangan pernah menaruh token atau data sensitif di query string.
 */
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  logger(isProduction ? 'combined' : 'dev', {
    skip: isProduction
      ? (req, res) => req.path === '/' && res.statusCode === 200
      : undefined,
  })
);

// ============================================================
// Global Middleware
// ============================================================
app.use(express.json({ limit: '1mb' })); // Batasi ukuran JSON request
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());

/**
 * Helmet – memasang security headers:
 *   - Content-Security-Policy
 *   - X-Frame-Options (anti-clickjacking)
 *   - X-Content-Type-Options (anti-MIME-sniffing)
 *   - Strict-Transport-Security (HSTS)
 *   - Referrer-Policy
 */
app.use(helmet());

// ============================================================
// Routes Registration
// ============================================================

// Public routes (no authentication)
app.use('/', indexRouter);                     // health check
app.use('/auth', authRouter);                  // login, refresh token

// Admin only routes
app.use('/academic-years', accessValidation, roleValidation(['admin']), academicYearsRouter);
app.use('/users', accessValidation, roleValidation(['admin']), usersRouter);
app.use('/classes', accessValidation, roleValidation(['admin']), classesRouter);
app.use('/students', accessValidation, roleValidation(['admin']), studentsRouter);

// Role-specific routes
app.use('/teachers', accessValidation, roleValidation(['wali_kelas']), teachersRouter);
app.use('/parents', accessValidation, roleValidation(['orang_tua']), parentsRouter);
app.use('/headmaster', accessValidation, roleValidation(['kepala_sekolah']), headmasterRouter);

// Routes accessible by all authenticated users
app.use('/semesters', accessValidation, semestersRouter);
app.use('/curriculums', accessValidation, curriculumsRouter);
app.use('/subjects', accessValidation, subjectsRouter);
app.use('/academic-calendar', accessValidation, academicCalendarRouter);

// ============================================================
// Database Connection Check
// ============================================================
const { sequelize } = require('./models');

sequelize
  .authenticate()
  .then(() => console.log('[DB] Koneksi database berhasil'))
  .catch((err) => {
    console.error('[DB] Gagal koneksi ke database:', err.message);
    // Di production, bisa dipertimbangkan process.exit(1) jika DB adalah dependency kritis.
    // if (isProduction) process.exit(1);
  });

// ============================================================
// Global Error Handler
// ============================================================
/**
 * [Fix H-08] Error handler harus menjadi middleware TERAKHIR.
 * Express mengenali error handler dari 4 parameter (err, req, res, next).
 * Tanpa ini, Express default handler akan mengekspos stack trace ke client.
 */
app.use(errorHandler);

// ============================================================
// Ekspor App
// ============================================================
module.exports = app;