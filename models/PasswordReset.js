module.exports = (sequelize, DataTypes) => {
    const PasswordReset = sequelize.define('PasswordReset', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.STRING(5),
            allowNull: false
        },
        token: {
            type: DataTypes.STRING,
            allowNull: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'password_resets',
    });

    PasswordReset.associate = (models) => {
        PasswordReset.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return PasswordReset;
};
