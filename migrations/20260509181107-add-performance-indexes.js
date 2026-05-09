'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ============================================================
    // INDEKS UNTUK TABEL `users`
    // ============================================================
    // email sudah unique (otomatis terindex), tidak perlu tambah index lagi
    await queryInterface.addIndex('users', ['nip'], {
      name: 'idx_users_nip',
      unique: false,
    });
    await queryInterface.addIndex('users', ['role'], {
      name: 'idx_users_role',
    });
    await queryInterface.addIndex('users', ['token_version'], {
      name: 'idx_users_token_version',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `students`
    // ============================================================
    await queryInterface.addIndex('students', ['parent_id'], {
      name: 'idx_students_parent_id',
    });
    await queryInterface.addIndex('students', ['nisn'], {
      name: 'idx_students_nisn',
      unique: false,
    });

    // ============================================================
    // INDEKS UNTUK TABEL `semesters`
    // ============================================================
    await queryInterface.addIndex('semesters', ['academic_year_id'], {
      name: 'idx_semesters_academic_year_id',
    });
    await queryInterface.addIndex('semesters', ['is_active'], {
      name: 'idx_semesters_is_active',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `classes`
    // ============================================================
    await queryInterface.addIndex('classes', ['teacher_id'], {
      name: 'idx_classes_teacher_id',
    });
    await queryInterface.addIndex('classes', ['academic_year_id'], {
      name: 'idx_classes_academic_year_id',
    });
    // Composite index untuk filter kelas aktif berdasarkan tahun ajaran
    await queryInterface.addIndex('classes', ['academic_year_id', 'name'], {
      name: 'idx_classes_year_name',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `student_classes`
    // ============================================================
    await queryInterface.addIndex('student_classes', ['student_id'], {
      name: 'idx_student_classes_student_id',
    });
    await queryInterface.addIndex('student_classes', ['class_id'], {
      name: 'idx_student_classes_class_id',
    });
    // Unique constraint untuk mencegah duplikasi (sudah ada di model? pastikan)
    // Sebaiknya buat unique constraint jika belum ada di migration awal
    try {
      await queryInterface.addConstraint('student_classes', {
        fields: ['student_id', 'class_id'],
        type: 'unique',
        name: 'uq_student_classes_student_class',
      });
    } catch (err) {
      // constraint mungkin sudah ada; ignore duplicate error
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }

    // ============================================================
    // INDEKS UNTUK TABEL `attendances`
    // ============================================================
    await queryInterface.addIndex('attendances', ['student_class_id'], {
      name: 'idx_attendances_student_class_id',
    });
    await queryInterface.addIndex('attendances', ['semester_id'], {
      name: 'idx_attendances_semester_id',
    });
    await queryInterface.addIndex('attendances', ['date'], {
      name: 'idx_attendances_date',
    });
    // Composite index untuk query rekap (semester + date + student_class)
    await queryInterface.addIndex('attendances', ['semester_id', 'date', 'student_class_id'], {
      name: 'idx_attendances_semester_date_class',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `schedules`
    // ============================================================
    await queryInterface.addIndex('schedules', ['class_id'], {
      name: 'idx_schedules_class_id',
    });
    await queryInterface.addIndex('schedules', ['subject_id'], {
      name: 'idx_schedules_subject_id',
    });
    await queryInterface.addIndex('schedules', ['day'], {
      name: 'idx_schedules_day',
    });
    // Composite index untuk overlap checking
    await queryInterface.addIndex('schedules', ['class_id', 'day', 'start_time', 'end_time'], {
      name: 'idx_schedules_class_day_time',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `grade_categories`
    // ============================================================
    await queryInterface.addIndex('grade_categories', ['class_id'], {
      name: 'idx_gc_class_id',
    });
    await queryInterface.addIndex('grade_categories', ['subject_id'], {
      name: 'idx_gc_subject_id',
    });
    await queryInterface.addIndex('grade_categories', ['semester_id'], {
      name: 'idx_gc_semester_id',
    });
    // Composite untuk filter cepat
    await queryInterface.addIndex('grade_categories', ['class_id', 'subject_id', 'semester_id'], {
      name: 'idx_gc_class_subject_semester',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `grade_details`
    // ============================================================
    await queryInterface.addIndex('grade_details', ['grade_category_id'], {
      name: 'idx_gd_grade_category_id',
    });
    await queryInterface.addIndex('grade_details', ['date'], {
      name: 'idx_gd_date',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `student_grades`
    // ============================================================
    await queryInterface.addIndex('student_grades', ['student_class_id'], {
      name: 'idx_sg_student_class_id',
    });
    await queryInterface.addIndex('student_grades', ['grade_detail_id'], {
      name: 'idx_sg_grade_detail_id',
    });
    // Unique constraint untuk menghindari duplikasi nilai (satu siswa, satu detail)
    try {
      await queryInterface.addConstraint('student_grades', {
        fields: ['student_class_id', 'grade_detail_id'],
        type: 'unique',
        name: 'uq_student_grades_unique',
      });
    } catch (err) {
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }

    // ============================================================
    // INDEKS UNTUK TABEL `evaluations`
    // ============================================================
    await queryInterface.addIndex('evaluations', ['class_id'], {
      name: 'idx_ev_class_id',
    });
    await queryInterface.addIndex('evaluations', ['semester_id'], {
      name: 'idx_ev_semester_id',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `student_evaluations`
    // ============================================================
    await queryInterface.addIndex('student_evaluations', ['student_class_id'], {
      name: 'idx_se_student_class_id',
    });
    await queryInterface.addIndex('student_evaluations', ['evaluation_id'], {
      name: 'idx_se_evaluation_id',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `password_resets`
    // ============================================================
    await queryInterface.addIndex('password_resets', ['token'], {
      name: 'idx_pr_token',
    });
    await queryInterface.addIndex('password_resets', ['user_id'], {
      name: 'idx_pr_user_id',
    });
    await queryInterface.addIndex('password_resets', ['expires_at'], {
      name: 'idx_pr_expires_at',
    });

    // ============================================================
    // INDEKS UNTUK TABEL `academic_calendar`
    // ============================================================
    await queryInterface.addIndex('academic_calendar', ['start_date'], {
      name: 'idx_ac_start_date',
    });
    await queryInterface.addIndex('academic_calendar', ['end_date'], {
      name: 'idx_ac_end_date',
    });
  },

  async down(queryInterface, Sequelize) {
    // Hapus semua indeks yang ditambahkan (urutan terbalik)
    // Tabel users
    await queryInterface.removeIndex('users', 'idx_users_nip');
    await queryInterface.removeIndex('users', 'idx_users_role');
    await queryInterface.removeIndex('users', 'idx_users_token_version');
    // Tabel students
    await queryInterface.removeIndex('students', 'idx_students_parent_id');
    await queryInterface.removeIndex('students', 'idx_students_nisn');
    // Tabel semesters
    await queryInterface.removeIndex('semesters', 'idx_semesters_academic_year_id');
    await queryInterface.removeIndex('semesters', 'idx_semesters_is_active');
    // Tabel classes
    await queryInterface.removeIndex('classes', 'idx_classes_teacher_id');
    await queryInterface.removeIndex('classes', 'idx_classes_academic_year_id');
    await queryInterface.removeIndex('classes', 'idx_classes_year_name');
    // Tabel student_classes
    await queryInterface.removeIndex('student_classes', 'idx_student_classes_student_id');
    await queryInterface.removeIndex('student_classes', 'idx_student_classes_class_id');
    try {
      await queryInterface.removeConstraint('student_classes', 'uq_student_classes_student_class');
    } catch {}
    // Tabel attendances
    await queryInterface.removeIndex('attendances', 'idx_attendances_student_class_id');
    await queryInterface.removeIndex('attendances', 'idx_attendances_semester_id');
    await queryInterface.removeIndex('attendances', 'idx_attendances_date');
    await queryInterface.removeIndex('attendances', 'idx_attendances_semester_date_class');
    // Tabel schedules
    await queryInterface.removeIndex('schedules', 'idx_schedules_class_id');
    await queryInterface.removeIndex('schedules', 'idx_schedules_subject_id');
    await queryInterface.removeIndex('schedules', 'idx_schedules_day');
    await queryInterface.removeIndex('schedules', 'idx_schedules_class_day_time');
    // Tabel grade_categories
    await queryInterface.removeIndex('grade_categories', 'idx_gc_class_id');
    await queryInterface.removeIndex('grade_categories', 'idx_gc_subject_id');
    await queryInterface.removeIndex('grade_categories', 'idx_gc_semester_id');
    await queryInterface.removeIndex('grade_categories', 'idx_gc_class_subject_semester');
    // Tabel grade_details
    await queryInterface.removeIndex('grade_details', 'idx_gd_grade_category_id');
    await queryInterface.removeIndex('grade_details', 'idx_gd_date');
    // Tabel student_grades
    await queryInterface.removeIndex('student_grades', 'idx_sg_student_class_id');
    await queryInterface.removeIndex('student_grades', 'idx_sg_grade_detail_id');
    try {
      await queryInterface.removeConstraint('student_grades', 'uq_student_grades_unique');
    } catch {}
    // Tabel evaluations
    await queryInterface.removeIndex('evaluations', 'idx_ev_class_id');
    await queryInterface.removeIndex('evaluations', 'idx_ev_semester_id');
    // Tabel student_evaluations
    await queryInterface.removeIndex('student_evaluations', 'idx_se_student_class_id');
    await queryInterface.removeIndex('student_evaluations', 'idx_se_evaluation_id');
    // Tabel password_resets
    await queryInterface.removeIndex('password_resets', 'idx_pr_token');
    await queryInterface.removeIndex('password_resets', 'idx_pr_user_id');
    await queryInterface.removeIndex('password_resets', 'idx_pr_expires_at');
    // Tabel academic_calendar
    await queryInterface.removeIndex('academic_calendar', 'idx_ac_start_date');
    await queryInterface.removeIndex('academic_calendar', 'idx_ac_end_date');
  },
};