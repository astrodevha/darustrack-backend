/**
 * controllers/classSummaryController.js
 * ---------------------------------------
 * Controller untuk ringkasan performa kelas, digunakan oleh kepala sekolah.
 *
 * Endpoints:
 *  - GET /headmaster/classes          → Ringkasan semua kelas di semester aktif
 *  - GET /headmaster/classes/:classId → Detail performa satu kelas (ranking, nilai, kehadiran)
 *
 * Catatan performa:
 *  - Query menggunakan eager loading (include) yang cukup dalam.
 *    Jika data tumbuh besar, pertimbangkan pagination atau query terpisah per section.
 *
 * @module controllers/classSummaryController
 */

const {
  Class, StudentGrade, Student, GradeCategory, GradeDetail,
  Attendance, Subject, AcademicYear, Semester, StudentClass,
} = require('../models');

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Hitung rata-rata dari array angka, mengabaikan nilai null/undefined.
 * Mengembalikan 0 jika tidak ada nilai valid.
 *
 * @param {Array<number|null>} scores
 * @returns {number}
 */
function calculateAverage(scores) {
  const validScores = scores.filter((s) => s !== null && s !== undefined && !isNaN(s));
  if (validScores.length === 0) return 0;
  return validScores.reduce((sum, s) => sum + Number(s), 0) / validScores.length;
}

/**
 * Ekstrak angka grade level dari nama kelas (contoh: "6A" → 6, "Kelas 4B" → 4).
 * Mengembalikan null jika tidak ditemukan angka.
 *
 * @param {string} className
 * @returns {number|null}
 */
function extractGradeLevel(className) {
  const match = className.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Terapkan ranking kompetisi (1,1,3,...) ke array siswa yang sudah diurutkan
 * berdasarkan average_score descending.
 *
 * @param {Array<{average_score: number}>} sortedStudents - Sudah diurutkan turun
 * @returns {Array<{average_score: number, rank: number}>}
 */
function applyRanking(sortedStudents) {
  let currentRank = 1;
  let tieCount    = 0;
  let previousScore = null;

  for (const student of sortedStudents) {
    if (student.average_score === previousScore) {
      // Nilai sama → rank sama (tieCount tetap bertambah)
      student.rank = currentRank;
      tieCount++;
    } else {
      // Nilai berbeda → rank melompat sesuai jumlah tie sebelumnya
      currentRank  += tieCount;
      student.rank  = currentRank;
      tieCount      = 1;
      previousScore = student.average_score;
    }
  }

  return sortedStudents;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /headmaster/classes
 * Ringkasan semua kelas di tahun ajaran & semester aktif.
 * Setiap kelas menampilkan: jumlah siswa, rata-rata nilai, persentase kehadiran.
 */
exports.getAllClassesSummary = async (req, res) => {
  try {
    // 1. Cari tahun ajaran dan semester aktif
    const academicYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const semester = await Semester.findOne({
      where: { academic_year_id: academicYear.id, is_active: true },
    });
    if (!semester) {
      return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    }

    // 2. Ambil semua kelas beserta data siswa, nilai, dan kehadiran
    const classes = await Class.findAll({
      where: { academic_year_id: academicYear.id },
      include: [{
        model: StudentClass,
        as:    'student_class',
        include: [
          {
            model:    Attendance,
            as:       'attendance',
            where:    { semester_id: semester.id },
            required: false, // Tetap tampilkan kelas walau belum ada kehadiran
            attributes: ['status'],
          },
          {
            model:    StudentGrade,
            as:       'student_grade',
            required: false,
            attributes: ['score'],
            include: [{
              model:    GradeDetail,
              as:       'grade_detail',
              attributes: [],
              include: [{
                model:      GradeCategory,
                as:         'grade_category',
                attributes: [],
                where:      { semester_id: semester.id },
              }],
            }],
          },
        ],
      }],
    });

    // 3. Format dan hitung statistik per kelas
    const result = classes.map((cls) => {
      const totalStudents = cls.student_class.length;

      // Kumpulkan semua score dari seluruh siswa di kelas ini (skip null)
      const allScores = cls.student_class.flatMap((sc) =>
        sc.student_grade.map((g) => g.score).filter((s) => s !== null && !isNaN(s)),
      );
      const averageScore = calculateAverage(allScores);

      // Hitung persentase kehadiran
      const totalAttendance   = cls.student_class.reduce((acc, sc) => acc + sc.attendance.length, 0);
      const presentAttendance = cls.student_class.reduce(
        (acc, sc) => acc + sc.attendance.filter((a) => a.status === 'Hadir').length,
        0,
      );
      const attendancePct = totalAttendance === 0
        ? '0%'
        : `${((presentAttendance / totalAttendance) * 100).toFixed(1)}%`;

      return {
        id:                   cls.id,
        name:                 cls.name,
        grade_level:          extractGradeLevel(cls.name),
        total_students:       totalStudents,
        average_score:        parseFloat(averageScore.toFixed(2)),
        attendance_percentage: attendancePct,
      };
    });

    // Urutkan berdasarkan nama kelas (alfabetis)
    result.sort((a, b) => a.name.localeCompare(b.name));

    return res.json(result);
  } catch (error) {
    console.error('[classSummary/getAll] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /headmaster/classes/:classId
 * Detail performa satu kelas: nilai per mapel, kehadiran, dan ranking siswa.
 */
exports.getDetailClassesSummary = async (req, res) => {
  try {
    const { classId } = req.params;

    // 1. Cari tahun ajaran dan semester aktif
    const academicYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const semester = await Semester.findOne({
      where: { academic_year_id: academicYear.id, is_active: true },
    });
    if (!semester) {
      return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    }

    // 2. Ambil data kelas beserta siswa, nilai, dan kehadiran
    const classData = await Class.findOne({
      where: { id: classId, academic_year_id: academicYear.id },
      include: [{
        model: StudentClass,
        as:    'student_class',
        include: [
          { model: Student, as: 'student' },
          {
            model:    Attendance,
            as:       'attendance',
            where:    { semester_id: semester.id },
            required: false,
            attributes: ['status'],
          },
          {
            model:    StudentGrade,
            as:       'student_grade',
            required: false,
            include: [{
              model: GradeDetail,
              as:    'grade_detail',
              include: [{
                model:      GradeCategory,
                as:         'grade_category',
                where:      { semester_id: semester.id },
                attributes: ['subject_id'],
                include: [{
                  model:      Subject,
                  as:         'subject',
                  attributes: ['id', 'name'],
                }],
              }],
            }],
          },
        ],
      }],
    });

    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan atau bukan di tahun ajaran aktif' });
    }

    // 3. Proses data per siswa
    const subjectScoresMap = {}; // { subjectId: { subject_name, scores[] } }
    let totalScore         = 0;
    let totalGradeCount    = 0;
    let presentCount       = 0;
    let totalAttendCount   = 0;
    const studentRankings  = [];

    for (const sc of classData.student_class) {
      const student    = sc.student;
      const grades     = sc.student_grade;
      const attendances = sc.attendance;

      let studentScoreSum   = 0;
      let studentGradeCount = 0;

      for (const grade of grades) {
        const subject = grade.grade_detail?.grade_category?.subject;
        if (!subject) continue;

        // Lewati nilai null — jangan masukkan ke perhitungan
        if (grade.score === null || grade.score === undefined || isNaN(grade.score)) continue;

        const score = Number(grade.score);

        if (!subjectScoresMap[subject.id]) {
          subjectScoresMap[subject.id] = { subject_name: subject.name, scores: [] };
        }
        subjectScoresMap[subject.id].scores.push(score);

        studentScoreSum   += score;
        studentGradeCount++;
      }

      // Hanya masukkan ke ranking jika ada nilai yang valid
      if (studentGradeCount > 0) {
        const avgScore = studentScoreSum / studentGradeCount;
        studentRankings.push({
          id:            student.id,
          name:          student.name,
          average_score: parseFloat(avgScore.toFixed(2)),
        });
        totalScore      += studentScoreSum;
        totalGradeCount += studentGradeCount;
      }

      presentCount     += attendances.filter((a) => a.status === 'Hadir').length;
      totalAttendCount += attendances.length;
    }

    // 4. Hitung rata-rata per mata pelajaran
    const averageScorePerSubject = Object.entries(subjectScoresMap).map(
      ([subjectId, { subject_name, scores }]) => ({
        subject_id:    subjectId,
        subject_name,
        average_score: parseFloat(calculateAverage(scores).toFixed(2)),
      }),
    );

    // 5. Hitung overall statistik
    const overallAverageScore  = totalGradeCount
      ? parseFloat((totalScore / totalGradeCount).toFixed(2))
      : 0;
    const attendancePercentage = totalAttendCount
      ? `${((presentCount / totalAttendCount) * 100).toFixed(1)}%`
      : '0%';

    // 6. Urutkan siswa dan beri ranking kompetisi
    studentRankings.sort((a, b) => b.average_score - a.average_score);
    applyRanking(studentRankings);

    return res.json({
      id:                       classData.id,
      name:                     classData.name,
      grade_level:              extractGradeLevel(classData.name),
      total_students:           classData.student_class.length,
      average_score_per_subject: averageScorePerSubject,
      overall_average_score:    overallAverageScore,
      attendance_percentage:    attendancePercentage,
      student_rankings:         studentRankings,
    });
  } catch (err) {
    console.error('[classSummary/getDetail] Error:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
