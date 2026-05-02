require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const indexRouter = require('./routes/index');
const authRouter = require('./routes/authRoutes');
const academicYearsRouter = require('./routes/academicYearRoutes');
const semestersRouter = require('./routes/semesterRoutes')
const usersRouter = require('./routes/userRoutes');
const teachersRouter = require('./routes/teachers');
const parentsRouter = require('./routes/parents');
const headmasterRouter = require('./routes/headmasterRoutes');
const classesRouter = require('./routes/classRoutes');
const studentsRouter = require('./routes/studentRoutes');
const curriculumsRouter = require('./routes/curriculumRoutes');
const subjectsRouter = require('./routes/subjectRoutes');
const accessValidation = require('./middlewares/accessValidation');
const roleValidation = require('./middlewares/roleValidation');

const app = express();
const os = require('os');

console.log('Server specs:');
console.log(`Platform: ${os.platform()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`CPU Info:`, os.cpus());
console.log(`Total Memory: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
console.log(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024)} MB`);

const allowedOrigins = [
  'http://localhost:3000',
  'https://darustrack.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // untuk preflight

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(compression());
app.use(helmet());

// Routing
app.use('/', indexRouter);
app.use('/academic-years', accessValidation, roleValidation(['admin']), academicYearsRouter);
app.use('/semesters', accessValidation, semestersRouter);
app.use('/auth', authRouter);
app.use('/users', accessValidation, roleValidation(['admin']), usersRouter);
app.use('/teachers', accessValidation, roleValidation(['wali_kelas']), teachersRouter);
app.use('/parents', accessValidation, roleValidation(['orang_tua']), parentsRouter);
app.use('/headmaster', accessValidation, roleValidation(['kepala_sekolah']), headmasterRouter);
app.use('/classes', accessValidation, roleValidation(['admin']), classesRouter);
app.use('/students', accessValidation, roleValidation(['admin']), studentsRouter);
app.use('/curriculums', accessValidation, curriculumsRouter);
app.use('/subjects', accessValidation, subjectsRouter);

// Database connection
const sequelize = require('./config/database');

sequelize.authenticate()
  .then(() => console.log('Database connected...'))
  .catch(err => console.error('Error connecting to database:', err));

module.exports = app;