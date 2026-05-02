const { Class, StudentGrade, Student, GradeCategory, GradeDetail, Attendance, Subject, AcademicYear, Semester, StudentClass } = require('../models');

// Endpoint: Get all classes summary
exports.getAllClassesSummary = async (req, res) => {
    try {
        // Mendapatkan tahun ajaran aktif
        const academicYear = await AcademicYear.findOne({ where: { is_active: true } });
        if (!academicYear) {
            return res.status(404).json({ message: 'No active academic year found.' });
        }

        // Mendapatkan semester aktif
        const semester = await Semester.findOne({
            where: {
                academic_year_id: academicYear.id,
                is_active: true
            }
        });
        if (!semester) {
            return res.status(404).json({ message: 'No active semester found.' });
        }

        // Mendapatkan kelas yang terkait dengan tahun ajaran aktif
        const classes = await Class.findAll({
            where: {
                academic_year_id: academicYear.id
            },
            include: [
                {
                    model: StudentClass,
                    as: 'student_class',
                    include: [
                        {
                            model: Attendance,
                            as: 'attendance',
                            where: { semester_id: semester.id },
                            required: false, // ← Supaya tidak error kalau tidak ada data
                            attributes: ['status']
                        },
                        {
                            model: StudentGrade,
                            as: 'student_grade',
                            attributes: ['score'],
                            include: [
                                {
                                    model: GradeDetail,
                                    as: 'grade_detail',
                                    attributes: [],
                                    include: [
                                        {
                                            model: GradeCategory,
                                            as: 'grade_category',
                                            attributes: [],
                                            where: { semester_id: semester.id }
                                        }
                                    ]
                                }
                            ],
                            required: false
                        }
                    ]
                }
            ]
        });                
        
        // Format data untuk kelas
        const formattedClasses = classes.map(classItem => {
            const grade_level_match = classItem.name.match(/\d+/); // Ambil angka pertama dari nama kelas
            const grade_level = grade_level_match ? parseInt(grade_level_match[0]) : null; // Ubah ke number

            // Hitung total siswa
            const total_students = classItem.student_class.length;

            // Hitung rata-rata nilai
            const totalScore = classItem.student_class.reduce((acc, studentClass) => {
                const scores = studentClass.student_grade.map(grade => grade.score || 0);
                return acc + scores.reduce((sum, score) => sum + score, 0);
            }, 0);
            
            const totalGrades = classItem.student_class.reduce((acc, studentClass) => {
                return acc + studentClass.student_grade.length;
            }, 0);
            
            const average_score = totalGrades ? (totalScore / totalGrades) : 0;

            // Hitung persentase kehadiran
            const totalAttendance = classItem.student_class.reduce((acc, studentClass) => {
                return acc + studentClass.attendance.length;
            }, 0);
            const presentAttendance = classItem.student_class.reduce((acc, studentClass) => {
                return acc + studentClass.attendance.filter(att => att.status === 'Hadir').length;
            }, 0);
            const attendance_percentage = (totalAttendance === 0) ? '0%' : `${(presentAttendance / totalAttendance) * 100}%`;

            // Kembalikan data yang sudah diformat
            return {
                id: classItem.id,
                name: classItem.name,
                grade_level, // Sekarang dalam bentuk number
                total_students,
                average_score: average_score.toFixed(2),
                attendance_percentage
            };
        });

        // Urutkan berdasarkan nama kelas (alphabetical)
        formattedClasses.sort((a, b) => a.name.localeCompare(b.name)); 
        
        // Kirim data dalam bentuk JSON
        return res.json(formattedClasses);
    } catch (error) {
        console.error(error); // Log error untuk debugging
        return res.status(500).json({ message: 'Internal Server Error', error });
    }
};

// Endpoint: Get detail class
exports.getDetailClassesSummary = async (req, res) => {
    try {
        const { classId } = req.params;

        // Cari tahun ajaran & semester aktif
        const academicYear = await AcademicYear.findOne({ where: { is_active: true } });
        if (!academicYear) return res.status(404).json({ message: 'No active academic year found.' });

        const semester = await Semester.findOne({
            where: { academic_year_id: academicYear.id, is_active: true }
        });
        if (!semester) return res.status(404).json({ message: 'No active semester found.' });

        // Ambil data kelas & relasinya
        const classData = await Class.findOne({
            where: { id: classId, academic_year_id: academicYear.id },
            include: [{
                model: StudentClass,
                as: 'student_class',
                include: [
                    {
                        model: Student,
                        as: 'student'
                    },
                    {
                        model: Attendance,
                        as: 'attendance',
                        where: { semester_id: semester.id },
                        required: false,
                        attributes: ['status']
                    },
                    {
                        model: StudentGrade,
                        as: 'student_grade',
                        required: false,
                        include: [{
                            model: GradeDetail,
                            as: 'grade_detail',
                            include: [{
                                model: GradeCategory,
                                as: 'grade_category',
                                where: { semester_id: semester.id },
                                attributes: ['subject_id'],
                                include: [{
                                    model: Subject,
                                    as: 'subject',
                                    attributes: ['id', 'name']
                                }]
                            }]
                        }]
                    }
                ]
            }]
        });

        if (!classData) return res.status(404).json({ message: 'Class not found or not in active academic year.' });

        // Hitung total siswa
        const total_students = classData.student_class.length;

        const subjectScores = {};
        let totalScore = 0, totalGradeCount = 0;
        let presentCount = 0, totalAttendanceCount = 0;
        const studentRankings = [];

        for (const studentClass of classData.student_class) {
            const student = studentClass.student;
            const grades = studentClass.student_grade;
            const attendances = studentClass.attendance;

            let studentScoreSum = 0, studentGradeCount = 0;

            for (const grade of grades) {
                const subject = grade.grade_detail?.grade_category?.subject;
                if (!subject) continue;

                if (!subjectScores[subject.id]) {
                    subjectScores[subject.id] = {
                        subject_id: subject.id,
                        subject_name: subject.name,
                        scores: []
                    };
                }

                subjectScores[subject.id].scores.push(grade.score);

                studentScoreSum += grade.score;
                studentGradeCount++;
            }

            if (studentGradeCount > 0) {
                const avgScore = studentScoreSum / studentGradeCount;
                studentRankings.push({
                    id: student.id,
                    name: student.name,
                    average_score: parseFloat(avgScore.toFixed(2))
                });
                totalScore += studentScoreSum;
                totalGradeCount += studentGradeCount;
            }

            presentCount += attendances.filter(a => a.status === 'Hadir').length;
            totalAttendanceCount += attendances.length;
        }

        // Hitung rata-rata per mata pelajaran
        const average_score_per_subject = [];
        for (const subjectId in subjectScores) {
            const { subject_id, subject_name, scores } = subjectScores[subjectId];
            const average_score = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
            average_score_per_subject.push({ subject_id, subject_name, average_score });
        }

        // Hitung overall rata-rata dan kehadiran
        const overall_average_score = totalGradeCount ? parseFloat((totalScore / totalGradeCount).toFixed(2)) : 0;
        const attendance_percentage = totalAttendanceCount ? `${((presentCount / totalAttendanceCount) * 100).toFixed(1)}%` : '0%';

        // Urutkan dan beri peringkat siswa
        studentRankings.sort((a, b) => b.average_score - a.average_score);

        let currentRank = 1;
        let previousScore = null;
        let tieCount = 0;

        for (let i = 0; i < studentRankings.length; i++) {
            const student = studentRankings[i];

            if (student.average_score === previousScore) {
                student.rank = currentRank;
                tieCount++;
            } else {
                currentRank += tieCount;
                student.rank = currentRank;
                tieCount = 1;
            }

            previousScore = student.average_score;
        }

        // Ekstrak grade level
        const grade_level = parseInt(classData.name.match(/\d+/)?.[0] || 0);

        // Return response
        return res.json({
            id: classData.id,
            name: classData.name,
            grade_level,
            total_students,
            average_score_per_subject,
            overall_average_score,
            attendance_percentage,
            student_rankings: studentRankings
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
};