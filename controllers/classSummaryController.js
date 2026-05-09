/**
 * controllers/classSummaryController.js
 *
 * Controller untuk ringkasan performa kelas, digunakan oleh kepala sekolah (headmaster).
 * Menyediakan data agregasi nilai dan kehadiran per kelas serta ranking siswa.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET /headmaster/classes          → Ringkasan semua kelas di semester aktif
 * GET /headmaster/classes/:classId → Detail performa satu kelas (nilai per mapel, ranking)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Gunakan helper calculateAverage, extractGradeLevel yang didefinisikan di sini.
 * - Agregasi DB menggunakan raw query dengan parameter placeholders (?).
 * - Pastikan indexing pada kolom foreign key (class_id, semester_id, student_class_id).
 * - Jangan mengubah applyRanking tanpa memahami ranking kompetisi ("1224").
 *
 * @module classSummaryController
 */

// ============================================================
// Dependencies
// ============================================================
const { QueryTypes } = require('sequelize');
const {
  Class,
  StudentGrade,
  Student,
  GradeCategory,
  GradeDetail,
  Attendance,
  Subject,
  AcademicYear,
  Semester,
  StudentClass,
  sequelize,
} = require('../models');

// ============================================================
// Helper Functions
// ============================================================

/**
 * Menghitung rata-rata dari array angka, mengabaikan nilai null/undefined/NaN.
 *
 * @param {Array<number|null|undefined>} scores
 * @returns {number}
 */
function calculateAverage(scores) {
  const valid = scores.filter((s) => s !== null && s !== undefined && !isNaN(Number(s)));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, s) => sum + Number(s), 0) / valid.length;
}

/**
 * Ekstrak grade level (tingkatan kelas) dari nama kelas.
 * Contoh: "6A" → 6, "Kelas 4B" → 4, "Al-Fatihah" → null.
 *
 * @param {string} className
 * @returns {number|null}
 */
function extractGradeLevel(className) {
  const match = className.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Menerapkan ranking kompetisi (competition ranking) ke array siswa yang sudah diurutkan.
 *
 * Aturan ranking kompetisi ("1224" ranking):
 *   - Siswa dengan nilai sama mendapat rank yang sama.
 *   - Rank berikutnya melompat sesuai jumlah siswa yang tie.
 *
 * Contoh:
 *   Input scores : [95, 90, 90, 85, 85, 85, 70]
 *   Output ranks : [ 1,  2,  2,  4,  4,  4,  7]
 *
 * Edge cases yang ditangani:
 *   - Array kosong: dikembalikan tanpa error.
 *   - Satu elemen: rank = 1.
 *   - Semua nilai sama: semua rank = 1.
 *   - Semua nilai berbeda: rank 1, 2, 3, ...
 *
 * @param {Array<{average_score: number}>} sortedStudents - Array siswa diurutkan descending berdasarkan average_score.
 * @returns {Array<{average_score: number, rank: number}>} Array yang sama dengan properti `rank`.
 */
function applyRanking(sortedStudents) {
  if (!sortedStudents || sortedStudents.length === 0) return sortedStudents;

  let currentRank = 1;
  let tieCount = 1;                    // nilai saat ini sudah muncul 1 kali
  let previousScore = sortedStudents[0].average_score;
  sortedStudents[0].rank = 1;

  for (let i = 1; i < sortedStudents.length; i++) {
    const student = sortedStudents[i];
    if (student.average_score === previousScore) {
      // Nilai sama: rank tidak berubah, tieCount bertambah
      student.rank = currentRank;
      tieCount++;
    } else {
      // Nilai berbeda: rank melompat sebesar tieCount, reset
      currentRank += tieCount;
      student.rank = currentRank;
      tieCount = 1;
      previousScore = student.average_score;
    }
  }
  return sortedStudents;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /headmaster/classes
 *
 * Ringkasan semua kelas di tahun ajaran & semester aktif.
 * Menggunakan 3 query terpisah dengan agregasi DB (bukan nested eager loading).
 *
 * [M-03] Strategi query terpisah:
 *   - Q1: daftar kelas (metadata)
 *   - Q2: rata-rata nilai per kelas (GROUP BY)
 *   - Q3: persentase kehadiran per kelas (GROUP BY)
 *   - Q4: jumlah siswa per kelas (GROUP BY)
 *
 * Semua query dijalankan paralel via Promise.all.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getAllClassesSummary = async (req, res) => {
  try {
    // Cari tahun ajaran dan semester aktif
    const [academicYear, semester] = await Promise.all([
      AcademicYear.findOne({ where: { is_active: true } }),
      Semester.findOne({
        include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } },
        where: { is_active: true },
      }),
    ]);

    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    if (!semester) {
      return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    }

    // Ambil semua kelas (metadata ringan)
    const classes = await Class.findAll({
      where: { academic_year_id: academicYear.id },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    if (classes.length === 0) {
      return res.json([]);
    }

    const classIds = classes.map((c) => c.id);
    const placeholders = classIds.map(() => '?').join(', ');

    // Jalankan agregasi paralel
    const [avgScoreRows, attendanceRows, studentCountRows] = await Promise.all([
      // Rata-rata nilai per kelas
      sequelize.query(
        `SELECT sc.class_id, ROUND(AVG(sg.score), 2) AS average_score
         FROM student_classes sc
         INNER JOIN student_grades sg ON sg.student_class_id = sc.id
         INNER JOIN grade_details gd ON gd.id = sg.grade_detail_id
         INNER JOIN grade_categories gc ON gc.id = gd.grade_category_id
         WHERE sc.class_id IN (${placeholders})
           AND gc.semester_id = ?
           AND sg.score IS NOT NULL
         GROUP BY sc.class_id`,
        { replacements: [...classIds, semester.id], type: QueryTypes.SELECT }
      ),
      // Persentase kehadiran per kelas
      sequelize.query(
        `SELECT sc.class_id,
                COUNT(a.id) AS total_attendance,
                SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END) AS present_count
         FROM student_classes sc
         LEFT JOIN attendances a ON a.student_class_id = sc.id AND a.semester_id = ?
         WHERE sc.class_id IN (${placeholders})
         GROUP BY sc.class_id`,
        { replacements: [semester.id, ...classIds], type: QueryTypes.SELECT }
      ),
      // Jumlah siswa per kelas
      sequelize.query(
        `SELECT class_id, COUNT(*) AS total_students
         FROM student_classes
         WHERE class_id IN (${placeholders})
         GROUP BY class_id`,
        { replacements: classIds, type: QueryTypes.SELECT }
      ),
    ]);

    // Konversi hasil ke map untuk lookup O(1)
    const avgScoreMap = Object.fromEntries(
      avgScoreRows.map((r) => [r.class_id, parseFloat(r.average_score) || 0])
    );
    const attendanceMap = Object.fromEntries(
      attendanceRows.map((r) => [r.class_id, r])
    );
    const studentCountMap = Object.fromEntries(
      studentCountRows.map((r) => [r.class_id, parseInt(r.total_students, 10) || 0])
    );

    // Susun response
    const result = classes.map((cls) => {
      const attendance = attendanceMap[cls.id];
      const totalAttend = attendance ? parseInt(attendance.total_attendance, 10) : 0;
      const presentCount = attendance ? parseInt(attendance.present_count, 10) : 0;
      const attendancePct = totalAttend > 0 ? `${((presentCount / totalAttend) * 100).toFixed(1)}%` : '0%';

      return {
        id: cls.id,
        name: cls.name,
        grade_level: extractGradeLevel(cls.name),
        total_students: studentCountMap[cls.id] || 0,
        average_score: avgScoreMap[cls.id] || 0,
        attendance_percentage: attendancePct,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('[classSummary/getAll] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil ringkasan semua kelas' });
  }
};

/**
 * GET /headmaster/classes/:classId
 *
 * Detail performa satu kelas: nilai per mata pelajaran, kehadiran, ranking siswa.
 * Data diambil dengan eager loading karena terbatas pada satu kelas (aman).
 *
 * [M-04] Ranking dihitung menggunakan applyRanking yang sudah diperbaiki.
 *
 * @param {import('express').Request} req - Params: { classId }
 * @param {import('express').Response} res
 */
exports.getDetailClassesSummary = async (req, res) => {
  try {
    const { classId } = req.params;

    // Cari tahun ajaran dan semester aktif
    const [academicYear, semester] = await Promise.all([
      AcademicYear.findOne({ where: { is_active: true } }),
      Semester.findOne({
        include: { model: AcademicYear, as: 'academic_year', where: { is_active: true } },
        where: { is_active: true },
      }),
    ]);

    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    if (!semester) {
      return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    }

    // Ambil data kelas beserta relasi
    const classData = await Class.findOne({
      where: { id: classId, academic_year_id: academicYear.id },
      include: [
        {
          model: StudentClass,
          as: 'student_class',
          include: [
            {
              model: Student,
              as: 'student',
              attributes: ['id', 'name'],
            },
            {
              model: Attendance,
              as: 'attendance',
              where: { semester_id: semester.id },
              required: false,
              attributes: ['status'],
            },
            {
              model: StudentGrade,
              as: 'student_grade',
              required: false,
              include: [
                {
                  model: GradeDetail,
                  as: 'grade_detail',
                  include: [
                    {
                      model: GradeCategory,
                      as: 'grade_category',
                      where: { semester_id: semester.id },
                      attributes: ['subject_id'],
                      include: [
                        {
                          model: Subject,
                          as: 'subject',
                          attributes: ['id', 'name'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!classData) {
      return res.status(404).json({
        message: 'Kelas tidak ditemukan atau bukan bagian dari tahun ajaran aktif',
      });
    }

    // Proses data per siswa
    const subjectScoresMap = {};  // { subjectId: { subject_name, scores[] } }
    let totalScore = 0;
    let totalGradeCount = 0;
    let presentCount = 0;
    let totalAttendCount = 0;
    const studentRankings = [];

    for (const sc of classData.student_class) {
      const { student, student_grade: grades, attendance: attendances } = sc;
      if (!student) continue;

      let studentScoreSum = 0;
      let studentGradeCount = 0;

      for (const grade of grades) {
        const subject = grade.grade_detail?.grade_category?.subject;
        if (!subject) continue;
        if (grade.score === null || grade.score === undefined || isNaN(grade.score)) continue;

        const score = Number(grade.score);
        if (!subjectScoresMap[subject.id]) {
          subjectScoresMap[subject.id] = { subject_name: subject.name, scores: [] };
        }
        subjectScoresMap[subject.id].scores.push(score);
        studentScoreSum += score;
        studentGradeCount++;
      }

      if (studentGradeCount > 0) {
        const avgScore = studentScoreSum / studentGradeCount;
        studentRankings.push({
          id: student.id,
          name: student.name,
          average_score: parseFloat(avgScore.toFixed(2)),
        });
        totalScore += studentScoreSum;
        totalGradeCount += studentGradeCount;
      }

      presentCount += attendances.filter((a) => a.status === 'Hadir').length;
      totalAttendCount += attendances.length;
    }

    // Rata-rata per mata pelajaran
    const averageScorePerSubject = Object.entries(subjectScoresMap).map(
      ([subjectId, { subject_name, scores }]) => ({
        subject_id: subjectId,
        subject_name,
        average_score: parseFloat(calculateAverage(scores).toFixed(2)),
      })
    ).sort((a, b) => a.subject_name.localeCompare(b.subject_name));

    // Statistik keseluruhan
    const overallAverageScore = totalGradeCount
      ? parseFloat((totalScore / totalGradeCount).toFixed(2))
      : 0;
    const attendancePercentage = totalAttendCount
      ? `${((presentCount / totalAttendCount) * 100).toFixed(1)}%`
      : '0%';

    // Ranking siswa (descending berdasarkan average_score)
    studentRankings.sort((a, b) => b.average_score - a.average_score);
    applyRanking(studentRankings); // in-place modification

    return res.json({
      id: classData.id,
      name: classData.name,
      grade_level: extractGradeLevel(classData.name),
      total_students: classData.student_class.length,
      average_score_per_subject: averageScorePerSubject,
      overall_average_score: overallAverageScore,
      attendance_percentage: attendancePercentage,
      student_rankings: studentRankings,
    });
  } catch (error) {
    console.error('[classSummary/getDetail] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil detail ringkasan kelas' });
  }
};