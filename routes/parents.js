var express = require('express');
var router = express.Router();
const { Op } = require('sequelize');
const Validator = require('fastest-validator');
const { User, AcademicYear, Semester, Student, StudentClass, Attendance, Schedule, Subject, Class, Evaluation, AcademicCalendar, Curriculum, StudentEvaluation, GradeCategory, GradeDetail, StudentGrade } = require('../models');
const v = new Validator();

// Profile Anak
router.get('/student', async (req, res) => {
    try {
        const parentId = req.user.id;

        const student = await Student.findOne({
            where: { parent_id: parentId },
            attributes: ['id', 'name', 'nisn', 'birth_date'],
            include: [{
                model: StudentClass,
                as: 'student_class',
                attributes: ['id'],
                include: [{
                    model: Class,
                    as: 'class',
                    attributes: ['name'],
                    include: [
                        {
                            model: AcademicYear,
                            as: 'academic_year',
                            where: { is_active: true },
                            required: true,         // Hanya untuk filter, tidak ditampilkan
                            attributes: []          // Jangan tampilkan di response
                        },
                        {
                            model: User,
                            as: 'teacher',
                            attributes: ['name']
                        }
                    ]
                }]
            }]
        });

        if (!student || !student.student_class?.length) {
            return res.status(404).json({ message: 'Data anak tidak ditemukan atau tidak ada kelas di tahun ajaran aktif' });
        }

        // Ambil hanya student_class yang berisi class dari academic_year aktif
        const activeStudentClass = student.student_class.filter(sc => sc.class?.name);

        if (!activeStudentClass.length) {
            return res.status(404).json({ message: 'Kelas anak tidak berada di tahun ajaran aktif' });
        }

        const result = {
            name: student.name,
            nisn: student.nisn,
            birth_date: student.birth_date,
            student_class: activeStudentClass
        };

        res.json(result);
    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Jadwal Mata Pelajaran Anak berdasarkan Hari
router.get('/schedule', async (req, res) => {
    try {
        const parentId = req.user.id;
        console.log(`Parent ID: ${parentId}`);

        const student = await Student.findOne({
            where: { parent_id: parentId },
            include: [{
                model: StudentClass,
                as: 'student_class',
                include: [{
                    model: Class,
                    as: 'class',
                    include: [{
                        model: AcademicYear,
                        as: 'academic_year',
                        where: { is_active: true }, // Hanya tahun ajaran aktif
                        attributes: ['id']
                    }],
                    attributes: ['id', 'academic_year_id']
                }],
                attributes: ['class_id']
            }]
        });

        if (!student || !student.student_class?.length) {
            return res.status(404).json({ message: 'Data anak tidak ditemukan atau tidak memiliki kelas di tahun ajaran aktif' });
        }

        // Cari student_class yang memiliki class & academic_year aktif
        const activeStudentClass = student.student_class.find(sc => sc.class && sc.class.academic_year);

        if (!activeStudentClass) {
            return res.status(404).json({ message: 'Kelas anak tidak berada di tahun ajaran aktif' });
        }

        const classId = activeStudentClass.class.id;

        // Ambil parameter "day" dari query
        const { day } = req.query;
        const whereCondition = { class_id: classId };

        if (day) {
            whereCondition.day = { [Op.eq]: day };
        }

        // Ambil jadwal
        const schedules = await Schedule.findAll({
            where: whereCondition,
            attributes: ['day', 'start_time', 'end_time'],
            include: [{
                model: Subject,
                as: 'subject',
                attributes: ['name']
            }],
            order: [
                ['day', 'ASC'],
                ['start_time', 'ASC']
            ]
        });

        res.json(schedules);
    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Kehadiran anak per semester
router.get('/attendances/:semesterId', async (req, res) => {
    try {
        const parentId = req.user.id;
        const semesterId = req.params.semesterId;

        // Validasi semester harus berada di tahun ajaran aktif
        const semester = await Semester.findOne({
            where: { id: semesterId },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true },
                attributes: []
            }
        });

        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak berada di tahun ajaran aktif' });
        }

        // Cari data siswa
        const student = await Student.findOne({ where: { parent_id: parentId } });
        if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

        // Cari student_class milik siswa yang berada di tahun ajaran semester ini
        const studentClass = await StudentClass.findOne({
            where: { student_id: student.id },
            include: {
                model: Class,
                as: 'class',
                where: { academic_year_id: semester.academic_year_id }
            }
        });

        if (!studentClass) {
            return res.status(404).json({ message: 'Kelas siswa di tahun ajaran semester ini tidak ditemukan' });
        }

        // Ambil data kehadiran berdasarkan semester dan student_class
        const attendances = await Attendance.findAll({
            where: {
                student_class_id: studentClass.id,
                semester_id: semesterId
            },
            order: [['date', 'DESC']]
        });

        if (attendances.length === 0) {
            return res.status(404).json({ message: 'Data kehadiran tidak ditemukan untuk semester ini' });
        }

        // Format hasil
        const formattedAttendances = attendances.map(attendance => {
            const date = attendance.date;
            const day = new Date(date).toLocaleString('id-ID', { weekday: 'long' });
            return {
                date,
                day,
                status: attendance.status
            };
        });

        res.json(formattedAttendances);
    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ message: 'Terjadi kesalahan server', error: error.message });
    }
});

// Daftar title evaluasi per semester
router.get('/evaluations/:semesterId', async (req, res) => {
    try {
        const { semesterId } = req.params;

        // Cek semester dan pastikan berada di tahun ajaran aktif
        const semester = await Semester.findOne({
            where: { id: semesterId },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true }
            }
        });

        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
        }

        // Cari siswa berdasarkan orang tua
        const student = await Student.findOne({ where: { parent_id: req.user.id } });
        if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

        // Cari kelas siswa di tahun ajaran aktif
        const studentClass = await StudentClass.findOne({
            where: { student_id: student.id },
            include: {
                model: Class,
                as: 'class',
                where: { academic_year_id: semester.academic_year_id }
            }
        });

        if (!studentClass) {
            return res.status(404).json({ message: 'Kelas siswa di tahun ajaran aktif tidak ditemukan' });
        }

        // Ambil semua evaluasi yang terkait dengan kelas siswa dan semester
        const evaluations = await Evaluation.findAll({
            where: {
                class_id: studentClass.class_id,
                semester_id: semester.id
            },
            include: {
                model: Semester,
                as: 'semester',
                attributes: ['id', 'name']
            },
            order: [['title', 'ASC']]
        });

        if (evaluations.length === 0) {
            return res.status(404).json({ message: 'Belum ada evaluasi untuk semester ini' });
        }

        // Ambil nilai evaluasi siswa
        const studentEvaluations = await StudentEvaluation.findAll({
            where: {
                student_class_id: studentClass.id,
                evaluation_id: evaluations.map(e => e.id)
            }
        });

        // Gabungkan hasil evaluasi dengan nilai siswa (jika ada)
        const result = evaluations.map(evaluation => {
            const studentEval = studentEvaluations.find(se => se.evaluation_id === evaluation.id);
            return {
                id: evaluation.id,
                title: evaluation.title,
                semester_id: evaluation.semester.id,
                semester_name: evaluation.semester.name
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching evaluations for parent:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data evaluasi', error: error.message });
    }
});

// Deskripsi evaluasi per semester
router.get('/evaluations/:semesterId/:evaluationId', async (req, res) => {
    try {
        const { semesterId, evaluationId } = req.params;

        // Validasi semester dan pastikan semester berada di tahun ajaran aktif
        const semester = await Semester.findOne({
            where: { id: semesterId },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true }
            }
        });

        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak valid atau tidak aktif' });
        }

        // Cari siswa berdasarkan parent_id
        const student = await Student.findOne({ where: { parent_id: req.user.id } });
        if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

        // Cari kelas siswa pada tahun ajaran aktif
        const studentClass = await StudentClass.findOne({
            where: { student_id: student.id },
            include: {
                model: Class,
                as: 'class',
                where: { academic_year_id: semester.academic_year_id }
            }
        });

        if (!studentClass) {
            return res.status(404).json({ message: 'Kelas siswa pada tahun ajaran aktif tidak ditemukan' });
        }

        // Ambil data evaluasi siswa
        const studentEvaluation = await StudentEvaluation.findOne({
            where: {
                student_class_id: studentClass.id,
                evaluation_id: evaluationId
            },
            include: {
                model: Evaluation,
                as: 'evaluation',
                where: { semester_id: semesterId },
                attributes: ['id', 'title']
            }
        });

        if (!studentEvaluation) {
            return res.status(404).json({ message: 'Evaluasi tidak ditemukan untuk siswa pada semester ini.' });
        }

        const formattedEvaluation = {
            id: studentEvaluation.evaluation.id,
            title: studentEvaluation.evaluation.title,
            description: studentEvaluation.description // deskripsi penilaian dari StudentEvaluation
        };

        res.json(formattedEvaluation);
    } catch (error) {
        console.error('Error fetching evaluation detail:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil detail evaluasi', error: error.message });
    }
});

// Daftar Mata Pelajaran Anak
router.get('/grades/:semesterId/subjects', async (req, res) => {
    try {
        const { semesterId } = req.params;

        // Ambil semester & pastikan relasi ke tahun ajaran aktif
        const semester = await Semester.findOne({
            where: { id: semesterId },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true },
                attributes: ['id', 'year', 'is_active']
            }
        });
        if (!semester) return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak berada di tahun ajaran aktif' });

        // Ambil data siswa berdasarkan user parent
        const student = await Student.findOne({ where: { parent_id: req.user.id } });
        if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

        // Cari studentClass berdasarkan tahun ajaran aktif
        const studentClass = await StudentClass.findOne({
            where: { student_id: student.id },
            include: {
                model: Class,
                as: 'class',
                where: { academic_year_id: semester.academic_year_id }
            }
        });
        if (!studentClass) return res.status(404).json({ message: 'Kelas siswa untuk tahun ajaran aktif tidak ditemukan' });

        // Ambil semua jadwal kelas berdasarkan class_id
        const schedules = await Schedule.findAll({
            where: {
                class_id: studentClass.class_id
            },
            include: {
                model: Subject,
                as: 'subject',
                attributes: ['id', 'name']
            }
        });

        // Buat list mata pelajaran unik dari jadwal
        const uniqueSubjectsMap = {};
        schedules.forEach(schedule => {
            const subj = schedule.subject;
            if (subj && !uniqueSubjectsMap[subj.id]) {
                uniqueSubjectsMap[subj.id] = {
                    ...subj.toJSON(),
                    semester_id: semester.id,
                    semester_name: semester.name,
                    academic_year_id: semester.academic_year.id,
                    academic_year_name: semester.academic_year.year,
                    is_academic_year_active: semester.academic_year.is_active
                };
            }
        });

        // Konversi ke array dan urutkan berdasarkan nama
        const uniqueSubjects = Object.values(uniqueSubjectsMap);
        uniqueSubjects.sort((a, b) => a.name.localeCompare(b.name));

        res.json(uniqueSubjects);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data mata pelajaran', error: error.message });
    }
});

// Daftar kategori mapel
router.get('/grades/:semesterId/:subjectId/categories', async (req, res) => {
    try {
        const { semesterId, subjectId } = req.params;

        // 1. Validasi semester dan tahun ajaran aktif
        const semester = await Semester.findOne({
            where: { id: semesterId },
            include: {
                model: AcademicYear,
                as: 'academic_year',
                where: { is_active: true },
                attributes: ['id', 'year']
            }
        });

        if (!semester) {
            return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak berada di tahun ajaran aktif.' });
        }

        // 2. Ambil siswa dan kelasnya berdasarkan tahun ajaran aktif
        const student = await Student.findOne({ where: { parent_id: req.user.id } });
        if (!student) {
            return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
        }

        const studentClass = await StudentClass.findOne({
            where: { student_id: student.id },
            include: {
                model: Class,
                as: 'class',
                where: { academic_year_id: semester.academic_year.id }
            }
        });

        if (!studentClass) {
            return res.status(404).json({ message: 'Kelas siswa di tahun ajaran aktif tidak ditemukan.' });
        }

        // 3. Ambil kategori penilaian
        const gradeCategories = await GradeCategory.findAll({
            where: {
                subject_id: subjectId,
                semester_id: semesterId,
                class_id: studentClass.class_id
            },
            order: [['name', 'ASC']],
            attributes: ['id', 'name']
        });

        res.json(gradeCategories);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Detail Kategori (nilai dari jenis kategori)
router.get('/grades/categories/:gradeCategoryId/details', async (req, res) => {
    try {
        // 1. Dapatkan student berdasarkan parent
        const student = await Student.findOne({ where: { parent_id: req.user.id } });
        if (!student) return res.status(404).json({ message: 'Siswa tidak ditemukan' });

        // 2. Dapatkan grade category untuk validasi class
        const gradeCategory = await GradeCategory.findByPk(req.params.gradeCategoryId);
        if (!gradeCategory) return res.status(404).json({ message: 'Kategori nilai tidak ditemukan' });

        // 3. Cari student class yang sesuai dengan class di grade category
        const studentClass = await StudentClass.findOne({
            where: {
                student_id: student.id,
                class_id: gradeCategory.class_id // Pastikan class sesuai dengan grade category
            }
        });
        if (!studentClass) return res.status(404).json({ message: 'Siswa tidak terdaftar di kelas ini' });

        // 4. Query grade details dengan student grade yang sesuai
        const gradeDetails = await GradeDetail.findAll({
            where: { grade_category_id: req.params.gradeCategoryId },
            include: {
                model: StudentGrade,
                as: 'student_grade',
                where: { student_class_id: studentClass.id },
                required: false // Tetap tampilkan detail meski belum ada nilai
            }
        });

        // 5. Transformasi data
        const result = gradeDetails.map(detail => ({
            title: detail.name,
            date: detail.date,
            day: new Date(detail.date).toLocaleString('id-ID', { weekday: 'long' }),
            score: detail.student_grade.length > 0 ? detail.student_grade[0].score : null
        }));

        // 6. Urutkan berdasarkan tanggal
        result.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;