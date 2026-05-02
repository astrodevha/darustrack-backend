const { Op } = require('sequelize');
const {
  Student, StudentClass, Class, AcademicYear, AcademicCalendar,
  Semester, Schedule, Subject, Attendance, Evaluation,
  StudentEvaluation, GradeCategory, GradeDetail, StudentGrade
} = require('../models');

// GET /student
exports.profile = async (req, res) => {
  try {
    const student = await Student.findOne({
      where: { parent_id: req.user.id },
      attributes: ['name', 'nisn', 'birth_date'],
      include: {
        model: StudentClass,
        as: 'student_class',
        attributes: ['id'],
        include: {
          model: Class,
          as: 'class',
          attributes: ['name'],
          include: [
            { model: AcademicYear, as: 'academic_year', where: { is_active: true }, attributes: [] },
            { model: require('../models').User, as: 'teacher', attributes: ['name'] }
          ]
        }
      }
    });

    if (!student || !student.student_class?.length)
      return res.status(404).json({ message: 'Data anak tidak ditemukan' });

    const sc = student.student_class.filter(sc => sc.class?.name);
    if (!sc.length) return res.status(404).json({ message: 'Kelas tidak aktif' });

    return res.json({
      name: student.name, nisn: student.nisn, birth_date: student.birth_date, student_class: sc
    });
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /schedule?day=
exports.schedule = async (req, res) => {
  try {
    const { day } = req.query;
    const student = await Student.findOne({
      where: { parent_id: req.user.id },
      include: {
        model: StudentClass, as: 'student_class',
        include: {
          model: Class, as: 'class',
          include: { model: AcademicYear, as: 'academic_year', where: { is_active: true }, attributes: ['id'] },
          attributes: ['id']
        }, attributes: ['class_id']
      }
    });
    if (!student) return res.status(404).json({ message: 'Siswa tidak ditemukan' });

    const sc = student.student_class.find(sc => sc.class?.academic_year);
    if (!sc) return res.status(404).json({ message: 'Kelas tidak aktif' });

    const where = { class_id: sc.class.id };
    if (day) where.day = { [Op.eq]: day };

    const schedules = await Schedule.findAll({
      where,
      include: { model: Subject, as: 'subject', attributes: ['name'] },
      attributes: ['day', 'start_time', 'end_time'],
      order: [['day', 'ASC'], ['start_time', 'ASC']]
    });
    return res.json(schedules);
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /attendances/:semesterId
exports.attendances = async (req, res) => {
  try {
    const semester = await Semester.findOne({
      where: { id: req.params.semesterId },
      include: { model: AcademicYear, as: 'academic_year', where: { is_active: true }, attributes: [] }
    });
    if (!semester) return res.status(404).json({ message: 'Semester tidak aktif' });

    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Siswa tidak ditemukan' });

    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id },
      include: { model: Class, as: 'class', where: { academic_year_id: semester.academic_year_id } }
    });
    if (!studentClass) return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });

    const attendances = await Attendance.findAll({
      where: { student_class_id: studentClass.id, semester_id: semester.id },
      order: [['date', 'DESC']]
    });
    if (!attendances.length) return res.status(404).json({ message: 'Data kehadiran kosong' });

    return res.json(attendances.map(a => ({
      date: a.date,
      day: new Date(a.date).toLocaleString('id-ID', { weekday: 'long' }),
      status: a.status
    })));
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /evaluations/:semesterId
exports.evaluationTitles = async (req, res) => {
  try {
    const semester = await Semester.findOne({
      where: { id: req.params.semesterId },
      include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } }
    });
    if (!semester) return res.status(404).json({ message: 'Semester tidak aktif' });

    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id },
      include: { model: Class, as: 'class', where: { academic_year_id: semester.academic_year_id } }
    });
    if (!studentClass) return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });

    const evals = await Evaluation.findAll({
      where: { class_id: studentClass.class_id, semester_id: semester.id },
      order: [['title', 'ASC']]
    });
    if (!evals.length) return res.status(404).json({ message: 'Belum ada evaluasi' });

    return res.json(evals.map(e => ({ id: e.id, title: e.title, semester_id: semester.id, semester_name: semester.name })));
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /evaluations/:semesterId/:evaluationId
exports.evaluationDetail = async (req, res) => {
  try {
    const { semesterId, evaluationId } = req.params;
    const semester = await Semester.findOne({
      where: { id: semesterId }, include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } }
    });
    if (!semester) return res.status(404).json({ message: 'Semester tidak aktif' });

    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id },
      include: { model: Class, as: 'class', where: { academic_year_id: semester.academic_year_id } }
    });
    if (!studentClass) return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });

    const se = await StudentEvaluation.findOne({
      where: { student_class_id: studentClass.id, evaluation_id: evaluationId },
      include: { model: Evaluation, as: 'evaluation', attributes: ['id', 'title'] }
    });
    if (!se) return res.status(404).json({ message: 'Evaluasi tidak ditemukan' });

    return res.json({ id: se.evaluation.id, title: se.evaluation.title, description: se.description });
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /grades/:semesterId/subjects
exports.subjects = async (req, res) => {
  try {
    const semester = await Semester.findOne({
      where: { id: req.params.semesterId },
      include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } }
    });
    if (!semester) return res.status(404).json({ message: 'Semester tidak aktif' });

    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id },
      include: { model: Class, as: 'class', where: { academic_year_id: semester.academic_year_id }, attributes: ['id'] }
    });
    if (!studentClass) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    const schedules = await Schedule.findAll({
      where: { class_id: studentClass.class_id },
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] }
    });

    const uniq = {};
    schedules.forEach(s => { if (s.subject) uniq[s.subject.id] = s.subject; });
    return res.json(Object.values(uniq).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /grades/:semesterId/:subjectId/categories
exports.categories = async (req, res) => {
  try {
    const { semesterId, subjectId } = req.params;
    const semester = await Semester.findOne({
      where: { id: semesterId }, include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } }
    });
    if (!semester) return res.status(404).json({ message: 'Semester tidak aktif' });

    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id },
      include: { model: Class, as: 'class', where: { academic_year_id: semester.academic_year.id } }
    });
    if (!studentClass) return res.status(404).json({ message: 'Kelas tidak ditemukan' });

    const cats = await GradeCategory.findAll({
      where: { class_id: studentClass.class_id, semester_id: semesterId, subject_id: subjectId },
      order: [['name', 'ASC']]
    });
    return res.json(cats);
  } catch (e) { return res.status(500).json({ message: e.message }); }
};

// GET /grades/categories/:gradeCategoryId/details
exports.detailScores = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    const category = await GradeCategory.findByPk(req.params.gradeCategoryId);
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id, class_id: category.class_id }
    });
    if (!studentClass) return res.status(404).json({ message: 'Siswa tidak di kelas' });

    const details = await GradeDetail.findAll({
      where: { grade_category_id: category.id },
      include: {
        model: StudentGrade,
        as: 'student_grade',
        where: { student_class_id: studentClass.id },
        required: false
      }
    });

    return res.json(details.map(d => ({
      title: d.name,
      date: d.date,
      day: new Date(d.date).toLocaleString('id-ID', { weekday: 'long' }),
      score: d.student_grade.length ? d.student_grade[0].score : null
    })).sort((a, b) => new Date(b.date) - new Date(a.date)));
  } catch (e) { return res.status(500).json({ message: e.message }); }
};
