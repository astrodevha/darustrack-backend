'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. academic_years
    await queryInterface.bulkInsert('academic_years', [
      { id: 1, year: '2024/2025', is_active: 1 },
      { id: 2, year: '2025/2026', is_active: 0 },
    ]);

    // 2. semesters
    await queryInterface.bulkInsert('semesters', [
      { id: 1, name: 'Ganjil', is_active: 1, academic_year_id: 1 },
      { id: 2, name: 'Genap', is_active: 0, academic_year_id: 1 },
      { id: 3, name: 'Ganjil', is_active: 0, academic_year_id: 2 },
    ]);

    // 3. curriculums
    await queryInterface.bulkInsert('curriculums', [
      { id: 1, name: 'Kurikulum 2013', description: 'K-13 revisi' },
      { id: 2, name: 'Kurikulum Merdeka', description: 'Kurikulum Merdeka' },
    ]);

    // 4. subjects
    await queryInterface.bulkInsert('subjects', [
      { id: 1, name: 'Matematika', description: 'Ilmu hitung' },
      { id: 2, name: 'Bahasa Indonesia', description: 'Bahasa Indonesia' },
      { id: 3, name: 'Bahasa Inggris', description: 'English' },
      { id: 4, name: 'IPA', description: 'Ilmu Pengetahuan Alam' },
      { id: 5, name: 'IPS', description: 'Ilmu Pengetahuan Sosial' },
      { id: 6, name: 'Pendidikan Agama Islam', description: 'PAI' },
      { id: 7, name: 'Pendidikan Kewarganegaraan', description: 'PKN' },
      { id: 8, name: 'PJOK', description: 'Pendidikan Jasmani dan Kesehatan' },
    ]);

    // 5. users
    await queryInterface.bulkInsert('users', [
      { id: 1, name: 'Admin Utama', nip: '197501012005011001', email: 'admin@darussalam1.co.id', password: hashedPassword, role: 'admin', token_version: 0 },
      { id: 2, name: 'Budi Santoso', nip: '198505152010121001', email: 'budi@darussalam1.co.id', password: hashedPassword, role: 'wali_kelas', token_version: 0 },
      { id: 3, name: 'Siti Aisyah', nip: '198808152015032002', email: 'siti@darussalam1.co.id', password: hashedPassword, role: 'wali_kelas', token_version: 0 },
      { id: 4, name: 'Dr. H. Ahmad Dahlan', nip: '196905201998031004', email: 'kepsek@darussalam1.co.id', password: hashedPassword, role: 'kepala_sekolah', token_version: 0 },
      { id: 5, name: 'Rachmat Hidayat', nip: null, email: 'rachmat@gmail.com', password: hashedPassword, role: 'orang_tua', token_version: 0 },
      { id: 6, name: 'Nurul Aini', nip: null, email: 'nurul@gmail.com', password: hashedPassword, role: 'orang_tua', token_version: 0 },
    ]);

    // 6. students
    await queryInterface.bulkInsert('students', [
      { id: 1, name: 'Ahmad Fauzan', nisn: '1234567890', birth_date: '2012-05-15', parent_id: 5 },
      { id: 2, name: 'Siti Fatimah', nisn: '1234567891', birth_date: '2012-08-22', parent_id: 6 },
      { id: 3, name: 'Muhammad Rizki', nisn: '1234567892', birth_date: '2012-03-10', parent_id: 5 },
      { id: 4, name: 'Zahra Aulia', nisn: '1234567893', birth_date: '2012-11-30', parent_id: 6 },
    ]);

    // 7. classes
    await queryInterface.bulkInsert('classes', [
      { id: 1, name: '6A', teacher_id: 2, academic_year_id: 1 },
      { id: 2, name: '6B', teacher_id: 3, academic_year_id: 1 },
    ]);

    // 8. student_classes
    await queryInterface.bulkInsert('student_classes', [
      { id: 1, student_id: 1, class_id: 1 },
      { id: 2, student_id: 2, class_id: 1 },
      { id: 3, student_id: 3, class_id: 2 },
      { id: 4, student_id: 4, class_id: 2 },
    ]);

    // 9. schedules
    await queryInterface.bulkInsert('schedules', [
      // kelas 6A
      { id: 1, class_id: 1, subject_id: 1, day: 'Senin', start_time: '07:30', end_time: '09:00' },
      { id: 2, class_id: 1, subject_id: 2, day: 'Senin', start_time: '09:15', end_time: '10:45' },
      { id: 3, class_id: 1, subject_id: 3, day: 'Selasa', start_time: '07:30', end_time: '09:00' },
      { id: 4, class_id: 1, subject_id: 4, day: 'Rabu', start_time: '07:30', end_time: '09:00' },
      { id: 5, class_id: 1, subject_id: 5, day: 'Kamis', start_time: '07:30', end_time: '09:00' },
      { id: 6, class_id: 1, subject_id: 6, day: 'Jumat', start_time: '07:30', end_time: '09:00' },
      // kelas 6B
      { id: 7, class_id: 2, subject_id: 1, day: 'Senin', start_time: '07:30', end_time: '09:00' },
      { id: 8, class_id: 2, subject_id: 2, day: 'Selasa', start_time: '07:30', end_time: '09:00' },
      { id: 9, class_id: 2, subject_id: 3, day: 'Rabu', start_time: '07:30', end_time: '09:00' },
      { id: 10, class_id: 2, subject_id: 4, day: 'Kamis', start_time: '07:30', end_time: '09:00' },
      { id: 11, class_id: 2, subject_id: 5, day: 'Jumat', start_time: '07:30', end_time: '09:00' },
      { id: 12, class_id: 2, subject_id: 6, day: 'Jumat', start_time: '09:15', end_time: '10:45' },
    ]);

    // 10. grade_categories (untuk kelas 6A semester Ganjil)
    await queryInterface.bulkInsert('grade_categories', [
      { id: 1, name: 'Ulangan Harian', subject_id: 1, class_id: 1, semester_id: 1 },
      { id: 2, name: 'UTS', subject_id: 1, class_id: 1, semester_id: 1 },
      { id: 3, name: 'UAS', subject_id: 1, class_id: 1, semester_id: 1 },
      { id: 4, name: 'Ulangan Harian', subject_id: 2, class_id: 1, semester_id: 1 },
      { id: 5, name: 'UTS', subject_id: 2, class_id: 1, semester_id: 1 },
      { id: 6, name: 'UAS', subject_id: 2, class_id: 1, semester_id: 1 },
      { id: 7, name: 'Ulangan Harian', subject_id: 4, class_id: 1, semester_id: 1 },
      { id: 8, name: 'UTS', subject_id: 4, class_id: 1, semester_id: 1 },
      { id: 9, name: 'UAS', subject_id: 4, class_id: 1, semester_id: 1 },
    ]);

    // 11. grade_details
    await queryInterface.bulkInsert('grade_details', [
      { id: 1, name: 'Bilangan Bulat', date: '2024-08-15', grade_category_id: 1 },
      { id: 2, name: 'Pecahan', date: '2024-08-30', grade_category_id: 1 },
      { id: 3, name: 'Bangun Datar', date: '2024-09-20', grade_category_id: 1 },
      { id: 4, name: 'UTS Ganjil', date: '2024-10-10', grade_category_id: 2 },
      { id: 5, name: 'UAS Ganjil', date: '2024-12-05', grade_category_id: 3 },
      { id: 6, name: 'Teks Deskripsi', date: '2024-08-20', grade_category_id: 4 },
      { id: 7, name: 'Puisi', date: '2024-09-10', grade_category_id: 4 },
      { id: 8, name: 'UTS Ganjil', date: '2024-10-12', grade_category_id: 5 },
      { id: 9, name: 'UAS Ganjil', date: '2024-12-07', grade_category_id: 6 },
      { id: 10, name: 'Sistem Pernapasan', date: '2024-08-25', grade_category_id: 7 },
      { id: 11, name: 'Sistem Peredaran Darah', date: '2024-09-15', grade_category_id: 7 },
      { id: 12, name: 'UTS Ganjil', date: '2024-10-15', grade_category_id: 8 },
      { id: 13, name: 'UAS Ganjil', date: '2024-12-10', grade_category_id: 9 },
    ]);

    // 12. student_grades (for student_class_id 1 and 2 – siswa di kelas 6A)
    const studentGrades = [];
    let sgId = 1;
    const detailIds = [1,2,3,4,5,6,7,8,9,10,11,12,13];
    for (const sc of [1,2]) {
      for (const gd of detailIds) {
        const score = Math.floor(Math.random() * (95 - 70 + 1) + 70);
        studentGrades.push({
          id: sgId++,
          student_class_id: sc,
          grade_detail_id: gd,
          score: score,
        });
      }
    }
    await queryInterface.bulkInsert('student_grades', studentGrades);

    // 13. attendances
    const attendances = [];
    let attId = 1;
    const dates = ['2024-08-01','2024-08-02','2024-08-05','2024-08-06','2024-08-07','2024-08-08','2024-08-09','2024-08-12'];
    const statuses = ['Hadir', 'Hadir', 'Izin', 'Sakit', 'Hadir', 'Hadir', 'Alpa', 'Hadir'];
    const allStudentClasses = [1,2,3,4];
    for (const date of dates) {
      for (const sc of allStudentClasses) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        attendances.push({
          id: attId++,
          student_class_id: sc,
          semester_id: 1,
          date: date,
          status: status,
        });
      }
    }
    await queryInterface.bulkInsert('attendances', attendances);

    // 14. evaluations
    await queryInterface.bulkInsert('evaluations', [
      { id: 1, title: 'Sikap Spiritual', class_id: 1, semester_id: 1 },
      { id: 2, title: 'Sikap Sosial', class_id: 1, semester_id: 1 },
    ]);

    // 15. student_evaluations
    await queryInterface.bulkInsert('student_evaluations', [
      { id: 1, student_class_id: 1, evaluation_id: 1, description: 'Baik, selalu berdoa sebelum belajar' },
      { id: 2, student_class_id: 1, evaluation_id: 2, description: 'Sangat baik, ramah dan membantu teman' },
      { id: 3, student_class_id: 2, evaluation_id: 1, description: 'Cukup, kadang lupa berdoa' },
      { id: 4, student_class_id: 2, evaluation_id: 2, description: 'Baik, namun kadang egois' },
    ]);

    // 16. academic_calendar
    await queryInterface.bulkInsert('academic_calendar', [
      { id: 1, event_name: 'Libur Awal Puasa', start_date: '2025-03-01', end_date: '2025-03-07' },
      { id: 2, event_name: 'Ujian Tengah Semester', start_date: '2025-03-15', end_date: '2025-03-25' },
      { id: 3, event_name: 'Penerimaan Rapor', start_date: '2025-06-10', end_date: null },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('academic_calendar', null, {});
    await queryInterface.bulkDelete('student_evaluations', null, {});
    await queryInterface.bulkDelete('evaluations', null, {});
    await queryInterface.bulkDelete('attendances', null, {});
    await queryInterface.bulkDelete('student_grades', null, {});
    await queryInterface.bulkDelete('grade_details', null, {});
    await queryInterface.bulkDelete('grade_categories', null, {});
    await queryInterface.bulkDelete('schedules', null, {});
    await queryInterface.bulkDelete('student_classes', null, {});
    await queryInterface.bulkDelete('classes', null, {});
    await queryInterface.bulkDelete('students', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('subjects', null, {});
    await queryInterface.bulkDelete('curriculums', null, {});
    await queryInterface.bulkDelete('semesters', null, {});
    await queryInterface.bulkDelete('academic_years', null, {});
  },
};