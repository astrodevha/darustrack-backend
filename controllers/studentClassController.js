const { AcademicYear, Class, StudentClass, Student } = require('../models');

exports.getStudentsInClass = async (req, res) => {
    try {
        const { academicYearId, classId } = req.params;

        const academicYear = await AcademicYear.findByPk(academicYearId);
        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        const classData = await Class.findOne({
            where: { id: classId, academic_year_id: academicYearId },
            include: [{
                model: StudentClass,
                as: 'student_class',
                include: [{
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'name', 'nisn', 'birth_date', 'parent_id']
                }]
            }]
        });

        if (!classData) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran ini' });
        }

        let students = classData.student_class ? classData.student_class.map(sc => sc.student) : [];
        students = students.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            class_id: classData.id,
            class_name: classData.name,
            students: students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server', error });
    }
};

exports.addStudentsToClass = async (req, res) => {
    try {
        const { academicYearId, classId } = req.params;
        const { studentIds } = req.body;

        if (!academicYearId || !classId) {
            return res.status(400).json({ message: 'Academic Year ID atau Class ID tidak ditemukan' });
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'Harap sertakan ID siswa yang valid dalam format array.' });
        }

        const academicYear = await AcademicYear.findByPk(academicYearId);
        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        const classData = await Class.findOne({
            where: { id: classId, academic_year_id: academicYearId }
        });

        if (!classData) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran ini' });
        }

        const students = await Student.findAll({ where: { id: studentIds } });
        if (students.length !== studentIds.length) {
            return res.status(400).json({ message: 'Beberapa siswa tidak ditemukan' });
        }

        const classesInYear = await Class.findAll({
            where: { academic_year_id: academicYearId },
            attributes: ['id']
        });
        const classIdsInYear = classesInYear.map(c => c.id);

        const existingStudentAssignments = await StudentClass.findAll({
            where: { student_id: studentIds, class_id: classIdsInYear }
        });

        if (existingStudentAssignments.length > 0) {
            const alreadyAssignedIds = existingStudentAssignments.map(entry => entry.student_id);
            return res.status(400).json({
                message: 'Tidak dapat menambahkan siswa dikarenakan terdapat siswa yang sudah terdaftar di kelas lain dalam tahun ajaran ini.',
                student_ids: alreadyAssignedIds
            });
        }

        const studentClasses = studentIds.map(studentId => ({
            student_id: studentId,
            class_id: classId
        }));

        await StudentClass.bulkCreate(studentClasses);
        res.status(201).json({ message: 'Siswa berhasil ditambahkan ke kelas.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
    }
};

exports.removeStudentFromClass = async (req, res) => {
    const { academicYearId, classId, studentId } = req.params;

    try {
        const academicYear = await AcademicYear.findByPk(academicYearId);
        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        const classData = await Class.findOne({
            where: { id: classId, academic_year_id: academicYearId }
        });
        if (!classData) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan pada tahun ajaran ini' });
        }

        const studentClass = await StudentClass.findOne({
            where: { student_id: studentId, class_id: classId }
        });

        if (!studentClass) {
            return res.status(404).json({ message: 'Siswa tidak terdaftar dalam kelas ini' });
        }

        await studentClass.destroy();
        res.status(200).json({ message: 'Siswa berhasil dihapus dari kelas' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan saat menghapus siswa dari kelas', error });
    }
};