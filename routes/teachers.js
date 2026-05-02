const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize, User, Semester, Student, StudentClass, Evaluation, Attendance, StudentEvaluation, Schedule, Subject, GradeCategory, GradeDetail, StudentGrade, Class, AcademicYear } = require('../models');

// Middleware untuk cache semester aktif
const loadActiveSemester = async (req, res, next) => {
    try {
        const semester = await Semester.findOne({ where: { is_active: true } });
        if (!semester) return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
        req.activeSemester = semester;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Gagal memuat semester aktif', error: err.message });
    }
};

// Ambil kelas yang menjadi tanggung jawab wali kelas
router.get('/my-class', async (req, res) => {
    try {
        const userId = req.user.id;

        // Cari tahun ajaran aktif
        const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
        if (!activeYear) return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });

        // Cari kelas yang menjadi tanggung jawab wali kelas pada tahun ajaran aktif
        const myClass = await Class.findOne({
            where: {
                teacher_id: userId,
                academic_year_id: activeYear.id
            }
        });

        if (!myClass) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan untuk wali kelas ini di tahun ajaran aktif' });
        }

        res.json({ message: 'Kelas wali kelas berhasil ditemukan', class: myClass });
    } catch (error) {
        res.status(500).json({ message: 'Error mengambil data kelas wali kelas', error });
    }
});

// Mendapatkan jadwal kelas yang dikelola oleh wali kelas pada tahun ajaran aktif
router.get('/schedules', async (req, res) => {
    try {
        const userId = req.user.id; // ID wali kelas dari user yang login
        const { day } = req.query;  // Ambil filter hari dari query parameter (misal: /schedules?day=Senin)

        // 1. Cari tahun ajaran aktif
        const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
        if (!activeYear) {
            return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
        }

        // 2. Cari kelas yang diampu wali kelas
        const myClass = await Class.findOne({
            where: {
                teacher_id: userId,
                academic_year_id: activeYear.id
            }
        });
        if (!myClass) {
            return res.status(404).json({ message: 'Anda tidak mengampu kelas apapun di tahun ajaran aktif ini' });
        }

        // 3. Siapkan kondisi filter
        const whereCondition = { class_id: myClass.id };
        if (day) {
            whereCondition.day = day; // Tambahkan filter day jika diberikan
        }

        // 4. Ambil jadwal dengan filter
        const schedules = await Schedule.findAll({
            where: whereCondition,
            include: [
                {
                    model: Subject,
                    as: 'subject',
                    attributes: ['id', 'name']
                }
            ],
            order: [
                ['day', 'ASC'],
                ['start_time', 'ASC']
            ]
        });

        // 5. Format output
        const output = schedules.map(s => ({
            class_id: myClass.id,
            class_name: myClass.name,
            subject_id: s.subject_id,
            subject_name: s.subject.name,
            day: s.day,
            start_time: s.start_time,
            end_time: s.end_time
        }));

        res.json(output);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil jadwal kelas', error: error.message });
    }
});

// daftar tanggal kehadiran
router.get('/attendances/rekap', async (req, res) => {
    try {
        const userId = req.user.id;

        // Cek semester aktif
        const activeSemester = await Semester.findOne({ where: { is_active: true } });
        if (!activeSemester) {
            return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
        }

        // Cari kelas yang dikelola wali kelas
        const classData = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: activeSemester.academic_year_id },
        });

        if (!classData) {
            return res.status(404).json({ message: 'Wali kelas tidak mengelola kelas di semester aktif' });
        }

        // Ambil semua student_class_id dari kelas ini
        const studentClasses = await StudentClass.findAll({
            where: { class_id: classData.id },
            attributes: ['id']
        });

        const studentClassIds = studentClasses.map(sc => sc.id);
        if (studentClassIds.length === 0) {
            return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
        }

        // Ambil semua tanggal kehadiran unik berdasarkan kelas & semester
        const dates = await Attendance.findAll({
            where: {
                semester_id: activeSemester.id,
                student_class_id: {
                    [Op.in]: studentClassIds
                }
            },
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('date')), 'date']
            ],
            order: [['date', 'DESC']],
            raw: true
        });

        if (dates.length === 0) {
            return res.status(404).json({ message: 'Belum ada data kehadiran yang tercatat' });
        }

        res.json({
            semester_id: activeSemester.id,
            class_id: classData.id,
            total_dates: dates.length,
            dates: dates.map(d => d.date)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil rekapan tanggal kehadiran', error: error.message });
    }
});

// Ambil kehadiran
router.get('/attendances', loadActiveSemester, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.query;

        if (!date) return res.status(400).json({ message: 'Parameter query "date" wajib diisi' });

        const classData = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: req.activeSemester.academic_year_id },
        });

        if (!classData) return res.status(404).json({ message: 'Wali kelas tidak mengelola kelas di semester aktif' });

        const attendances = await Attendance.findAll({
            where: {
                semester_id: req.activeSemester.id,
                date: date,
            },
            include: [
                {
                    model: StudentClass,
                    as: 'student_class',
                    where: { class_id: classData.id },
                    include: [{
                        model: Student,
                        as: 'student',
                        attributes: ['id', 'name']
                    }]
                }
            ],
            attributes: ['id', 'student_class_id', 'status', 'date']
        });

        if (attendances.length === 0) {
            return res.status(404).json({ message: 'Tidak ada data kehadiran untuk tanggal tersebut' });
        }

        const attendanceData = attendances.map(att => ({
            student_class_id: att.student_class_id,
            studentName: att.student_class.student.name,
            status: att.status,
            date: att.date
        })).sort((a, b) => a.studentName.localeCompare(b.studentName));

        res.json(attendanceData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data kehadiran', error: error.message });
    }
});

// Tambah tanggal kehadiran
router.post('/attendances', loadActiveSemester, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.body;

        if (!date) return res.status(400).json({ message: 'Tanggal wajib diisi' });

        const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
        if (!activeYear) return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });

        const myClass = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: activeYear.id }
        });
        if (!myClass) return res.status(404).json({ message: 'Kelas wali kelas tidak ditemukan' });

        const students = await StudentClass.findAll({
            where: { class_id: myClass.id },
            attributes: ['id']
        });

        if (!students.length) return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });

        const studentClassIds = students.map(s => s.id);

        const existing = await Attendance.findAll({
            where: {
                semester_id: req.activeSemester.id,
                date,
                student_class_id: { [Op.in]: studentClassIds }
            },
            attributes: ['id']
        });

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Kehadiran untuk tanggal ini sudah ada' });
        }

        const attendanceRecords = studentClassIds.map(id => ({
            student_class_id: id,
            semester_id: req.activeSemester.id,
            date,
            status: 'Not Set'
        }));

        const t = await sequelize.transaction();
        await Attendance.bulkCreate(attendanceRecords, { transaction: t });
        await t.commit();

        res.status(201).json({ message: 'Tanggal kehadiran berhasil ditambahkan' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menambahkan kehadiran', error: error.message });
    }
});

// Perbarui status kehadiran
router.put('/attendances', loadActiveSemester, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.query;
        const { attendanceUpdates } = req.body;

        if (!date) return res.status(400).json({ message: 'Parameter query "date" wajib diisi' });
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date) || isNaN(Date.parse(date))) {
            return res.status(400).json({ message: 'Format tanggal tidak valid' });
        }

        if (!Array.isArray(attendanceUpdates) || attendanceUpdates.length === 0) {
            return res.status(400).json({ message: 'Data update kehadiran tidak valid' });
        }

        const classData = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: req.activeSemester.academic_year_id },
        });

        if (!classData) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

        const studentClasses = await StudentClass.findAll({
            where: { class_id: classData.id },
            attributes: ['id']
        });

        const validIds = studentClasses.map(s => s.id);
        const invalid = attendanceUpdates.filter(u => !validIds.includes(u.student_class_id));

        if (invalid.length > 0) {
            return res.status(400).json({ message: 'Beberapa student_class_id tidak valid', invalid });
        }

        const updatedResults = await Promise.all(attendanceUpdates.map(async (update) => {
            const existing = await Attendance.findOne({
                where: {
                    student_class_id: update.student_class_id,
                    semester_id: req.activeSemester.id,
                    date
                }
            });

            if (existing) {
                existing.status = update.status;
                await existing.save();
                return { updated: true, data: existing };
            } else {
                return { updated: false, student_class_id: update.student_class_id };
            }
        }));

        const updated = updatedResults.filter(r => r.updated).map(r => r.data);
        const notFound = updatedResults.filter(r => !r.updated).map(r => r.student_class_id);

        if (notFound.length === attendanceUpdates.length) {
            return res.status(400).json({ message: 'Tanggal kehadiran belum ditambahkan', notFoundStudentClassIds: notFound });
        }

        const responseMessage = notFound.length > 0
            ? `${updated.length} berhasil diperbarui, ${notFound.length} tidak ditemukan.`
            : `${updated.length} data berhasil diperbarui`;

        const statusCode = notFound.length > 0 ? 206 : 200;

        res.status(statusCode).json({
            message: responseMessage,
            updatedAttendances: updated,
            ...(notFound.length > 0 && { notFoundStudentClassIds: notFound })
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui kehadiran', error: error.message });
    }
});

// Hapus kehadiran berdasarkan tanggal
router.delete('/attendances', loadActiveSemester, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.query;

        if (!date) return res.status(400).json({ message: 'Parameter query "date" wajib diisi' });

        const classData = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: req.activeSemester.academic_year_id },
        });

        if (!classData) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

        const studentClasses = await StudentClass.findAll({
            where: { class_id: classData.id },
            attributes: ['id']
        });

        const ids = studentClasses.map(s => s.id);

        const deleted = await Attendance.destroy({
            where: {
                student_class_id: { [Op.in]: ids },
                semester_id: req.activeSemester.id,
                date
            }
        });

        if (deleted === 0) return res.status(404).json({ message: 'Tidak ada data kehadiran ditemukan' });

        res.json({ message: `${deleted} data kehadiran berhasil dihapus` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal menghapus kehadiran', error: error.message });
    }
});

// academic year aktif
router.get('/semesters', async (req, res) => {
    try {
        const activeYear = await AcademicYear.findOne({
            where: { is_active: true },
            include: [
                {
                    model: Semester,
                    as: 'semester'
                }
            ]
        });

        if (!activeYear) {
            return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
        }

        res.json({ semesters: activeYear.semester }); // sesuai dengan alias relasi
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil semester', error: error.message });
    }
});

// title evaluasi semester
router.get('/semesters/:semester_id/evaluations', async (req, res) => {
    try {
      const userId = req.user.id;
      const semesterId = req.params.semester_id;
  
      const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
      const myClass = await Class.findOne({ where: { teacher_id: userId, academic_year_id: activeYear.id } });
  
      if (!myClass) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
  
      const evaluations = await Evaluation.findAll({
        where: {
          class_id: myClass.id,
          semester_id: semesterId
        },
        order: [['title', 'ASC']] // Urut berdasarkan abjad judul evaluasi
      });
  
      res.json({ evaluations });
    } catch (error) {
      res.status(500).json({ message: 'Gagal mengambil evaluasi', error: error.message });
    }
});  

// Tambah title evaluasi per semester
router.post('/semesters/:semester_id/evaluations', async (req, res) => {
    try {
        const { semester_id } = req.params;
        const { title } = req.body;
        const userId = req.user.id;

        if (!title || title.trim() === '') {
            return res.status(400).json({ message: 'Judul evaluasi harus diisi' });
        }

        const semester = await Semester.findOne({
            where: { id: semester_id },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true }
            }
        });
        if (!semester) return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });

        const myClass = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: semester.academic_year_id }
        });
        if (!myClass) return res.status(404).json({ message: 'Anda tidak menjadi wali kelas pada tahun ajaran ini' });

        const existingEvaluation = await Evaluation.findOne({
            where: {
                title: title.trim(),
                class_id: myClass.id,
                semester_id: semester.id
            }
        });

        if (existingEvaluation) {
            return res.status(400).json({ message: 'Evaluasi dengan judul ini sudah ada di semester ini untuk kelas Anda' });
        }

        const evaluation = await Evaluation.create({
            title: title.trim(),
            class_id: myClass.id,
            semester_id: semester.id
        });

        const studentClasses = await StudentClass.findAll({ where: { class_id: myClass.id } });

        const evaluationsToInsert = studentClasses.map(sc => ({
            evaluation_id: evaluation.id,
            student_class_id: sc.id,
            description: null
        }));

        await StudentEvaluation.bulkCreate(evaluationsToInsert);

        res.status(201).json({ message: 'Evaluasi berhasil ditambahkan ke semua siswa', evaluation });
    } catch (error) {
        console.error('Error creating evaluation:', error);
        res.status(500).json({ message: 'Gagal menambahkan evaluasi', error: error.message });
    }
});

// Edit title evaluasi
router.put('/evaluations/:id', async (req, res) => {
    try {
        const { title } = req.body;
        const { id } = req.params;
        const userId = req.user.id;

        if (!title || title.trim() === '') {
            return res.status(400).json({ message: 'Judul evaluasi harus diisi' });
        }

        // Cari evaluasi yang mau diubah
        const evaluation = await Evaluation.findByPk(id);
        if (!evaluation) {
            return res.status(404).json({ message: 'Evaluasi tidak ditemukan' });
        }

        // Cari semester untuk ambil academic_year_id
        const semester = await Semester.findByPk(evaluation.semester_id);
        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak ditemukan' });
        }

        // Pastikan semester berada di tahun ajaran aktif
        const academicYear = await AcademicYear.findOne({
            where: { id: semester.academic_year_id, is_active: true }
        });
        if (!academicYear) {
            return res.status(400).json({ message: 'Tahun ajaran tidak aktif' });
        }

        // Cari kelas wali kelas
        const myClass = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: academicYear.id }
        });
        if (!myClass) {
            return res.status(403).json({ message: 'Anda bukan wali kelas pada tahun ajaran aktif' });
        }

        // Pastikan evaluasi ini memang milik kelas wali tersebut
        if (evaluation.class_id !== myClass.id) {
            return res.status(403).json({ message: 'Anda tidak berhak mengedit evaluasi ini' });
        }

        // Cek apakah title baru sudah ada di semester dan kelas yang sama
        const existingEvaluation = await Evaluation.findOne({
            where: {
                title: title.trim(),
                class_id: myClass.id,
                semester_id: evaluation.semester_id,
                id: { [Op.ne]: evaluation.id } // selain evaluasi yang sedang diedit
            }
        });

        if (existingEvaluation) {
            return res.status(400).json({ message: 'Judul evaluasi ini sudah digunakan di semester dan kelas Anda' });
        }

        // Update evaluasi
        await evaluation.update({ title: title.trim() });

        res.json({ message: 'Evaluasi berhasil diperbarui', evaluation });

    } catch (error) {
        console.error('Error updating evaluation:', error);
        res.status(500).json({ message: 'Gagal mengedit evaluasi', error: error.message });
    }
});

// Hapus title evaluasi
router.delete('/evaluations/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await Evaluation.destroy({ where: { id } });
      res.json({ message: 'Evaluasi berhasil dihapus' });
    } catch (error) {
      res.status(500).json({ message: 'Gagal menghapus evaluasi', error });
    }
});

// daftar evaluasi siswa per judul di tiap semester
router.get('/evaluations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const evaluation = await Evaluation.findByPk(id);
        if (!evaluation) {
            return res.status(404).json({ message: 'Evaluasi tidak ditemukan' });
        }

        const semester = await Semester.findByPk(evaluation.semester_id);
        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak ditemukan' });
        }

        const academicYear = await AcademicYear.findOne({
            where: { id: semester.academic_year_id, is_active: true }
        });
        if (!academicYear) {
            return res.status(403).json({ message: 'Tahun ajaran tidak aktif' });
        }

        const myClass = await Class.findOne({
            where: { teacher_id: userId, academic_year_id: academicYear.id }
        });
        if (!myClass || evaluation.class_id !== myClass.id) {
            return res.status(403).json({ message: 'Anda tidak berhak melihat evaluasi ini' });
        }

        const studentEvaluations = await StudentEvaluation.findAll({
            where: { evaluation_id: id },
            include: {
                model: StudentClass,
                as: 'student_class',
                include: {
                    model: Student,
                    as: 'student',
                    attributes: ['name', 'nisn']
                }
            }
        });

        const result = studentEvaluations.map(se => {
            const studentData = se.student_class?.student;
            return {
                student_evaluation_id: se.id,
                name: studentData?.name || null,
                nisn: studentData?.nisn || null,
                description: se.description
            };
        });

        // Urutkan berdasarkan nama siswa (secara alfabetis)
        result.sort((a, b) => a.name.localeCompare(b.name));

        res.json(result);
    } catch (error) {
        console.error('Error fetching student evaluations:', error);
        res.status(500).json({ message: 'Gagal mengambil evaluasi siswa', error: error.message });
    }
});

// Edit deskripsi evaluasi siswa
router.put('/student-evaluations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { description } = req.body;
        const userId = req.user.id;

        const studentEvaluation = await StudentEvaluation.findByPk(id, {
            include: {
                model: Evaluation,
                as: 'evaluation'
            }
        });

        if (!studentEvaluation) {
            return res.status(404).json({ message: "Evaluasi siswa tidak ditemukan" });
        }

        const evaluation = studentEvaluation.evaluation;

        const semester = await Semester.findByPk(evaluation.semester_id);
        const academicYear = await AcademicYear.findOne({ where: { id: semester.academic_year_id, is_active: true } });
        const myClass = await Class.findOne({ where: { teacher_id: userId, academic_year_id: academicYear.id } });

        if (!myClass || evaluation.class_id !== myClass.id) {
            return res.status(403).json({ message: 'Anda tidak berhak mengubah evaluasi ini' });
        }

        studentEvaluation.description = description;
        await studentEvaluation.save();

        res.json({ message: "Deskripsi evaluasi berhasil diperbarui" });
    } catch (error) {
        console.error('Error updating evaluation description:', error);
        res.status(500).json({ message: 'Gagal memperbarui deskripsi evaluasi', error: error.message });
    }
});

// *** GRADES ***
router.get('/grades/subjects', async (req, res) => {
  try {
    const activeAcademicYear = await AcademicYear.findOne({
      where: { is_active: true },
      attributes: ['id']
    });

    if (!activeAcademicYear) return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });

    const teacherClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeAcademicYear.id },
      attributes: ['id']
    });

    if (!teacherClass) return res.status(403).json({ message: 'Anda tidak memiliki kelas yang diajar di tahun ajaran aktif' });

    const subjects = await Schedule.findAll({
      where: { class_id: teacherClass.id },
      include: {
        model: Subject,
        as: 'subject',
        attributes: ['id', 'name']
      },
      attributes: ['subject_id'],
      raw: true,
      nest: true
    });

    const seen = new Set();
    const uniqueSubjects = subjects
      .filter(s => !seen.has(s.subject.id) && seen.add(s.subject.id))
      .map(s => ({
        subject_id: s.subject.id,
        subject_name: s.subject.name
      }))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

    res.json(uniqueSubjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/grades/:subject_id/:semester_id/categories', async (req, res) => {
  try {
    const teacherClass = await Class.findOne({
      where: { teacher_id: req.user.id },
      attributes: ['id']
    });
    if (!teacherClass) return res.status(403).json({ message: 'Anda tidak memiliki kelas yang diajar' });

    const categories = await GradeCategory.findAll({
      where: {
        class_id: teacherClass.id,
        subject_id: req.params.subject_id,
        semester_id: req.params.semester_id
      },
      attributes: ['id', 'name']
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/grades/:subject_id/:semester_id/categories', async (req, res) => {
  try {
    const { subject_id, semester_id } = req.params;
    const { name } = req.body;

    const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id }, attributes: ['id'] });
    if (!teacherClass) return res.status(403).json({ message: 'Anda tidak memiliki kelas yang diajar' });

    const exists = await GradeCategory.findOne({
      where: { subject_id, class_id: teacherClass.id, semester_id, name }
    });
    if (exists) return res.status(400).json({ message: 'Kategori sudah ada' });

    const newCategory = await GradeCategory.create({ subject_id, class_id: teacherClass.id, semester_id, name });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/grades/categories/:category_id', async (req, res) => {
  try {
    const { category_id } = req.params;
    const { name } = req.body;

    const category = await GradeCategory.findByPk(category_id);
    if (!category) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id }, attributes: ['id'] });
    if (!teacherClass || teacherClass.id !== category.class_id) return res.status(403).json({ message: 'Akses ditolak' });

    const duplicate = await GradeCategory.findOne({
      where: { name, class_id: teacherClass.id, subject_id: category.subject_id, id: { [Op.ne]: category_id } }
    });
    if (duplicate) return res.status(400).json({ message: 'Nama kategori sudah digunakan' });

    await category.update({ name });
    res.json({ message: 'Kategori berhasil diperbarui' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/grades/categories/:category_id', async (req, res) => {
  try {
    const category = await GradeCategory.findByPk(req.params.category_id);
    if (!category) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id }, attributes: ['id'] });
    if (!teacherClass || teacherClass.id !== category.class_id) return res.status(403).json({ message: 'Akses ditolak' });

    await GradeDetail.destroy({ where: { grade_category_id: category.id } });
    await category.destroy();
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// get detail penilaian dalam kategori
router.get('/grades/categories/:category_id/details', async (req, res) => {
    try {
        const { category_id } = req.params;

        const category = await GradeCategory.findOne({ where: { id: category_id } });
        if (!category) return res.status(404).json({ message: 'Category not found' });

        const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
        if (!teacherClass || category.class_id !== teacherClass.id)
            return res.status(403).json({ message: 'Access denied to this category' });

        const details = await GradeDetail.findAll({
            where: { grade_category_id: category_id },
            order: [['name', 'ASC']]
        });

        res.json(details);
    } catch (e) {
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

// tambah detail penilaian (macam-macam)
router.post('/grades/categories/:category_id/details', async (req, res) => {
  try {
    const { name, date } = req.body;
    const { category_id } = req.params;

    const category = await GradeCategory.findByPk(category_id);
    if (!category) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id }, attributes: ['id'] });
    if (!teacherClass || category.class_id !== teacherClass.id) return res.status(403).json({ message: 'Akses ditolak' });

    const existing = await GradeDetail.findOne({ where: { grade_category_id: category_id, name } });
    if (existing) return res.status(400).json({ message: 'Detail sudah ada' });

    const newDetail = await GradeDetail.create({ grade_category_id: category_id, name, date });

    const studentClasses = await StudentClass.findAll({ where: { class_id: teacherClass.id }, attributes: ['id'] });
    const grades = studentClasses.map(sc => ({
      student_class_id: sc.id,
      grade_detail_id: newDetail.id,
      score: null
    }));
    await StudentGrade.bulkCreate(grades);

    res.status(201).json({ message: 'Detail ditambahkan', newDetail });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
});

// Edit detail penilaian (macam-macam)
router.put('/grades/details/:detail_id', async (req, res) => {
    try {
        const { detail_id } = req.params;
        const { name, date } = req.body;

        const gradeDetail = await GradeDetail.findOne({
            where: { id: detail_id },
            include: {
                model: GradeCategory,
                as: 'grade_category'
            }
        });

        if (!gradeDetail) {
            return res.status(404).json({ message: 'Detail not found' });
        }

        const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
        if (!teacherClass || gradeDetail.grade_category.class_id !== teacherClass.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Cek duplikat hanya jika 'name' diubah
        if (name && name !== gradeDetail.name) {
            const duplicate = await GradeDetail.findOne({
                where: {
                    grade_category_id: gradeDetail.grade_category_id,
                    name,
                    id: { [Op.ne]: detail_id }
                }
            });
            if (duplicate) {
                return res.status(400).json({ message: 'Duplicate detail name' });
            }
        }

        // Update name dan/atau date
        await gradeDetail.update({
            name: name || gradeDetail.name,
            date: date || gradeDetail.date
        });

        res.json({ message: 'Detail category updated' });
    } catch (e) {
        console.error(e); // Debug
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

// Hapus detail penilaian (macam-macam)
router.delete('/grades/details/:detail_id', async (req, res) => {
    try {
        const { detail_id } = req.params;

        const gradeDetail = await GradeDetail.findOne({
            where: { id: detail_id },
            include: { model: GradeCategory, as: 'grade_category' }
        });

        if (!gradeDetail) return res.status(404).json({ message: 'Detail not found' });

        const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
        if (!teacherClass || gradeDetail.grade_category.class_id !== teacherClass.id)
            return res.status(403).json({ message: 'Access denied' });

        await StudentGrade.destroy({ where: { grade_detail_id: detail_id } });
        await GradeDetail.destroy({ where: { id: detail_id } });

        res.json({ message: 'Detail category deleted' });
    } catch (e) {
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

// Ambil skor siswa untuk suatu grade detail
router.get('/grades/details/:detail_id/students', async (req, res) => {
    try {
        const { detail_id } = req.params;

        // 1. Ambil detail penilaian dengan relasi kategori dan kelas
        const gradeDetail = await GradeDetail.findOne({
            where: { id: detail_id },
            include: {
                model: GradeCategory,
                as: 'grade_category',
                include: {
                    model: Class,
                    as: 'class'
                }
            }
        });

        if (!gradeDetail) return res.status(404).json({ message: 'Detail not found' });

        // 2. Pastikan wali kelas hanya bisa akses kelasnya
        const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
        if (!teacherClass || gradeDetail.grade_category.class.id !== teacherClass.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // 3. Ambil semua siswa dan skor (null jika belum dinilai), urut berdasarkan nama siswa
        const studentGrades = await StudentGrade.findAll({
            where: { grade_detail_id: detail_id },
            include: [
                {
                    model: StudentClass,
                    as: 'student_class',
                    include: {
                        model: Student,
                        as: 'student',
                        attributes: ['id', 'name']
                    }
                }
            ],
            order: [[{ model: StudentClass, as: 'student_class' }, { model: Student, as: 'student' }, 'name', 'ASC']]
        });

        const result = studentGrades.map(entry => ({
            student_grade_id: entry.id,
            student_id: entry.student_class?.student?.id,
            student_name: entry.student_class?.student?.name,
            score: entry.score
        }));

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Server error', error: e.message });
    }
});

// edit skor
router.patch('/grades/students/:student_grade_id', async (req, res) => {
    try {
        const { student_grade_id } = req.params;
        const { score } = req.body;

        // Validasi skor
        if (score === undefined || score === null || isNaN(score)) {
            return res.status(400).json({ message: 'Invalid score' });
        }

        // Ambil data StudentGrade beserta GradeDetail dan Class
        const studentGrade = await StudentGrade.findOne({
            where: { id: student_grade_id },
            include: [
                {
                    model: GradeDetail,
                    as: 'grade_detail',
                    include: {
                        model: GradeCategory,
                        as: 'grade_category',
                        include: {
                            model: Class,
                            as: 'class'
                        }
                    }
                },
                {
                    model: StudentClass,
                    as: 'student_class',
                    include: {
                        model: Student,
                        as: 'student'
                    }
                }
            ]
        });

        if (!studentGrade) {
            return res.status(404).json({ message: 'Student grade not found' });
        }

        // Pastikan wali kelas hanya bisa mengubah nilai di kelasnya
        const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
        if (!teacherClass || studentGrade.grade_detail.grade_category.class.id !== teacherClass.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Jika student_class_id belum ada, coba isi otomatis
        if (!studentGrade.student_class_id) {
            const gradeClassId = studentGrade.grade_detail.grade_category.class.id;

            // Coba dapatkan student_id dari relasi StudentClass > Student
            let studentId = studentGrade.student_class?.student?.id;

            // Kalau tidak tersedia dari relasi, coba ambil dari DB langsung (opsional, jaga-jaga)
            if (!studentId && studentGrade.student_class_id) {
                const sc = await StudentClass.findByPk(studentGrade.student_class_id);
                studentId = sc?.student_id;
            }

            if (!studentId) {
                return res.status(400).json({ message: 'Tidak bisa menetapkan student_class_id karena student tidak ditemukan' });
            }

            const studentClass = await StudentClass.findOne({
                where: {
                    class_id: gradeClassId,
                    student_id: studentId
                }
            });

            if (!studentClass) {
                return res.status(400).json({ message: 'StudentClass tidak ditemukan untuk siswa tersebut di kelas ini' });
            }

            studentGrade.student_class_id = studentClass.id;
        }

        // Update skor
        studentGrade.score = score;
        await studentGrade.save();

        return res.json({ message: 'Score updated successfully' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: 'Server error', error: e.message });
    }
});

module.exports = router