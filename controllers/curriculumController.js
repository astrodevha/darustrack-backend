const { Curriculum } = require('../models');
const Validator = require('fastest-validator');
const v = new Validator();

// Get data kurikulum (hanya satu yang tersedia)
exports.getCurriculum = async (req, res) => {
    try {
        const curriculum = await Curriculum.findOne({
            attributes: ['name', 'description']
        });
        res.json(curriculum || {});
    } catch (error) {
        res.status(500).json({ message: 'Error fetching curriculum', error });
    }
};

exports.updateCurriculum = async (req, res) => {
    const id = req.params.id;

    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID' });
    }

    let curriculum = await Curriculum.findByPk(id);
    if (!curriculum) {
        return res.status(404).json({ message: 'Curriculum not found' });
    }

    const schema = {
        name: { type: "string", optional: true, empty: false },
        description: { type: "string", optional: true, empty: false }
    };

    const validate = v.validate(req.body, schema);
    if (validate.length) {
        return res.status(400).json(validate);
    }

    await curriculum.update(req.body);
    return res.status(200).json({ 
        message: 'Curriculum updated successfully',
        data: curriculum
    });
};