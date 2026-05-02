const { AcademicYear, Class, Schedule, Subject } = require('../models');
const { Op } = require('sequelize');

exports.getClassesByAcademicYear = async (req, res) => {
    try {
        const { id } = req.params;
        const academicYear = await AcademicYear.findByPk(id, {
            include: [{
                model: Class,
                as: 'class',
                attributes: ['id', 'name']
            }]
        });

        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        const classList = academicYear.class.map(cls => {
            const gradeLevel = parseInt(cls.name.charAt(0));
            return {
                id: cls.id,
                name: cls.name,
                grade_level: isNaN(gradeLevel) ? null : gradeLevel
            };
        });

        classList.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            id: academicYear.id,
            year: academicYear.year,
            is_active: academicYear.is_active,
            classes: classList
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

exports.createClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, teacher_id } = req.body;

        const academicYear = await AcademicYear.findByPk(id);
        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        const existingClass = await Class.findOne({
            where: { name, academic_year_id: id }
        });

        if (existingClass) {
            return res.status(400).json({ message: 'Kelas dengan nama yang sama sudah ada di tahun ajaran ini' });
        }

        const newClass = await Class.create({
            name,
            teacher_id,
            academic_year_id: id
        });

        res.status(201).json(newClass);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

exports.updateClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const { name, teacher_id } = req.body;

        const existingClass = await Class.findByPk(classId);
        if (!existingClass) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan' });
        }

        const updateFields = {};
        if (name) updateFields.name = name;
        if (teacher_id) updateFields.teacher_id = teacher_id;

        if (Object.keys(updateFields).length > 0) {
            await existingClass.update(updateFields);
        }

        res.json({ message: 'Kelas berhasil diperbarui', data: existingClass });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
    }
};

exports.deleteClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const existingClass = await Class.findByPk(classId);
        if (!existingClass) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan' });
        }

        await existingClass.destroy();
        res.json({ message: 'Kelas berhasil dihapus' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
};

exports.getActiveClasses = async (req, res) => {
    try {
        const { grade_level } = req.query;

        const activeAcademicYear = await AcademicYear.findOne({
            where: { is_active: true }
        });

        if (!activeAcademicYear) {
            return res.status(404).json({ message: 'Tidak ada tahun ajaran aktif ditemukan' });
        }

        const whereConditions = {
            academic_year_id: activeAcademicYear.id
        };

        if (grade_level) {
            whereConditions.name = {
                [Op.like]: `${grade_level}%`
            };
        }

        const foundClasses = await Class.findAll({
            where: whereConditions,
            attributes: ['id', 'name', 'academic_year_id', 'teacher_id'],
            order: [['name', 'ASC']]
        });

        const classesWithGradeLevel = foundClasses.map(cls => {
            const gradeLevel = parseInt(cls.name.charAt(0));
            return {
                ...cls.toJSON(),
                grade_level: isNaN(gradeLevel) ? null : gradeLevel
            };
        });

        res.json(classesWithGradeLevel);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Gagal mengambil data kelas', error: error.message });
    }
};

exports.getMyClass = async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });

    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeYear.id }
    });
    if (!myClass) return res.status(404).json({ message: 'Kelas tidak ditemukan untuk wali kelas ini' });

    return res.json({ message: 'Kelas wali kelas berhasil ditemukan', class: myClass });
  } catch (error) {
    return res.status(500).json({ message: 'Error mengambil data kelas', error: error.message });
  }
};

exports.getSchedules = async (req, res) => {
  try {
    const { day } = req.query;
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });

    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeYear.id }
    });
    if (!myClass) return res.status(404).json({ message: 'Anda tidak mengampu kelas' });

    const where = { class_id: myClass.id };
    if (day) where.day = day;

    const schedules = await Schedule.findAll({
      where,
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] },
      order: [['day', 'ASC'], ['start_time', 'ASC']]
    });

    const output = schedules.map(s => ({
      class_id: myClass.id,
      class_name: myClass.name,
      subject_id: s.subject_id,
      subject_name: s.subject.name,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time
    }));

    return res.json(output);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil jadwal', error: err.message });
  }
};
