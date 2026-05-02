const { AcademicYear, Semester } = require('../models');
const { Op } = require('sequelize');
const Validator = require('fastest-validator');
const v = new Validator();

exports.getAllAcademicYears = async (req, res) => {
    try {
        const academicYears = await AcademicYear.findAll({
            include: [{
                model: Semester,
                as: 'semester',
                attributes: ['id', 'name', 'is_active']
            }],
            order: [['year', 'DESC']]
        });
        res.json(academicYears);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createAcademicYear = async (req, res) => {
    try {
        const { year, is_active = false } = req.body;

        const existingAcademicYear = await AcademicYear.findOne({ where: { year } });
        if (existingAcademicYear) {
            return res.status(400).json({ message: 'Tahun ajaran sudah ada.' });
        }

        if (is_active) {
            const activeAcademicYears = await AcademicYear.findAll({ where: { is_active: true } });
            for (const ay of activeAcademicYears) {
                await ay.update({ is_active: false });
                await Semester.update(
                    { is_active: false },
                    { where: { academic_year_id: ay.id } }
                );
            }
        }

        const newAcademicYear = await AcademicYear.create({ year, is_active });

        if (!is_active) {
            await Semester.update(
                { is_active: false },
                { where: { academic_year_id: newAcademicYear.id } }
            );
        }

        res.status(201).json({
            message: `Tahun ajaran berhasil ditambahkan${is_active ? ' dan diaktifkan' : ''}.`,
            data: newAcademicYear
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
    }
};

exports.updateAcademicYear = async (req, res) => {
    try {
        const { id } = req.params;
        const { year, is_active } = req.body;

        const academicYear = await AcademicYear.findByPk(id);
        if (!academicYear) {
            return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
        }

        if (is_active) {
            await AcademicYear.update({ is_active: false }, { where: {} });
        }

        if (year && academicYear.year !== year) {
            const existing = await AcademicYear.findOne({ where: { year } });
            if (existing && existing.id !== id) {
                return res.status(400).json({ message: `Tahun ajaran '${year}' sudah ada.` });
            }
            academicYear.year = year;
        }

        if (typeof is_active !== 'undefined') {
            academicYear.is_active = is_active;
        }

        await academicYear.save();
        res.json({ message: 'Tahun ajaran berhasil diperbarui' });
    } catch (error) {
        console.error('Error updating academic year', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server', error: error.message });
    }
};

exports.deleteAcademicYear = async (req, res) => {
    try {
        await AcademicYear.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Deleted Successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};