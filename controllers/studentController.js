const { Student } = require('../models');
const { Op } = require('sequelize');

class StudentController {
  // Get all students (optimized query)
  static async getAllStudents(req, res) {
    try {
      const students = await Student.findAll({
        attributes: ['id', 'name', 'nisn'],
        order: [['name', 'ASC']],
        raw: true
      });
      res.json(students);
    } catch (error) {
      res.status(500).json({ 
        message: 'Gagal mengambil data siswa', 
        error: error.message 
      });
    }
  }

  // Create new student
  static async createStudent(req, res) {
    try {
      const { name, nisn, birth_date, parent_id } = req.body;

      const existing = await Student.findOne({ 
        where: { nisn }, 
        attributes: ['id'], 
        raw: true 
      });
      
      if (existing) {
        return res.status(409).json({ 
          message: 'Siswa dengan NISN ini sudah terdaftar' 
        });
      }

      const newStudent = await Student.create({ 
        name, 
        nisn, 
        birth_date, 
        parent_id 
      });
      
      res.status(201).json(newStudent);
    } catch (error) {
      res.status(500).json({ 
        message: 'Gagal menambahkan siswa', 
        error: error.message 
      });
    }
  }

  // Update student
  static async updateStudent(req, res) {
    try {
      const { name, nisn, birth_date, parent_id } = req.body;
      const studentId = req.params.id;

      const student = await Student.findByPk(studentId);
      if (!student) {
        return res.status(404).json({ 
          message: 'Siswa tidak ditemukan' 
        });
      }

      if (nisn && nisn !== student.nisn) {
        const existing = await Student.findOne({ 
          where: { 
            nisn, 
            id: { [Op.ne]: student.id } 
          },
          attributes: ['id'],
          raw: true
        });
        
        if (existing) {
          return res.status(409).json({ 
            message: 'NISN sudah digunakan oleh siswa lain' 
          });
        }
      }

      await student.update({ 
        name, 
        nisn, 
        birth_date, 
        parent_id 
      });
      
      res.json({ 
        message: 'Siswa berhasil diperbarui' 
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Gagal memperbarui siswa', 
        error: error.message 
      });
    }
  }

  // Delete student
  static async deleteStudent(req, res) {
    try {
      const studentId = req.params.id;
      const deleted = await Student.destroy({ 
        where: { id: studentId } 
      });
      
      if (!deleted) {
        return res.status(404).json({ 
          message: 'Siswa tidak ditemukan' 
        });
      }
      
      res.json({ 
        message: 'Siswa berhasil dihapus' 
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Gagal menghapus siswa', 
        error: error.message 
      });
    }
  }
}

module.exports = StudentController;