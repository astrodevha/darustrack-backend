const bcrypt = require('bcryptjs');
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

const BCRYPT_COST_FACTOR = 8; // Semula 10

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.STRING(5),
            // defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false,
            defaultValue: () => nanoid()
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        nip: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, 
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('orang_tua', 'kepala_sekolah', 'wali_kelas', 'admin'),
            allowNull: false
        }
    }, {
        tableName: 'users',
        hooks: {
            beforeCreate: async (user) => {
                user.password = await bcrypt.hash(user.password, BCRYPT_COST_FACTOR);
            }
        }
    });

    // Method untuk compare password yang dioptimasi
    User.prototype.comparePassword = async function(candidatePassword) {
        return bcrypt.compare(candidatePassword, this.password);
    };

    User.associate = (models) => {
        User.hasMany(models.Student, { foreignKey: 'parent_id', as: 'student' });
        User.hasOne(models.Class, { foreignKey: 'teacher_id', as: 'class' });
        User.hasMany(models.PasswordReset, { foreignKey: 'user_id' });
    };

    return User;
};
