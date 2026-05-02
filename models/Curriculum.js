module.exports = (sequelize, DataTypes) => {
    const Curriculum = sequelize.define('Curriculum', {
        id: {
            type: DataTypes.INTEGER,
            // defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        tableName: 'curriculums',
    });
    
    return Curriculum;
}