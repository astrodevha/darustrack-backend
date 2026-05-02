const Validator = require('fastest-validator');
const { Subject } = require('../models');
const v = new Validator();

// GET /subjects
exports.listSubjects = async (req, res) => {
  const subjects = await Subject.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  res.json(subjects);
};

// GET /subjects/:id
exports.getSubject = async (req, res) => {
  const { id } = req.params;

  const subject = await Subject.findByPk(id, {
    attributes: ['id', 'name', 'description']
  });

  if (!subject) return res.status(404).json({ message: 'Subject tidak ditemukan' });

  res.json(subject);
};

// POST /subjects
exports.createSubject = async (req, res) => {
  const schema = { name: 'string', description: 'string' };
  const validate = v.validate(req.body, schema);
  if (validate.length) return res.status(400).json(validate);

  const exists = await Subject.findOne({ where: { name: req.body.name }, limit: 1 });
  if (exists) return res.status(409).json({ message: `Subject '${req.body.name}' sudah ada` });

  const subject = await Subject.create(req.body);
  res.status(201).json({ message: 'Subject created', id: subject.id });
};

// PUT /subjects/:id
exports.updateSubject = async (req, res) => {
  const { id } = req.params;
  const subject = await Subject.findByPk(id);
  if (!subject) return res.status(404).json({ message: 'Subject tidak ditemukan' });

  const schema = { name: 'string|optional', description: 'string|optional' };
  const validate = v.validate(req.body, schema);
  if (validate.length) return res.status(400).json(validate);

  // Cek nama duplikat jika diubah
  if (req.body.name && req.body.name !== subject.name) {
    const exists = await Subject.findOne({ where: { name: req.body.name }, limit: 1 });
    if (exists && exists.id !== subject.id)
      return res.status(409).json({ message: `Nama '${req.body.name}' sudah digunakan` });
  }

  await subject.update(req.body);
  res.json({ message: 'Subject updated', subject });
};

// DELETE /subjects/:id
exports.deleteSubject = async (req, res) => {
  const { id } = req.params;
  const subject = await Subject.findByPk(id);
  if (!subject) return res.status(404).json({ message: 'Subject tidak ditemukan' });

  await subject.destroy();
  res.json({ message: 'Subject deleted successfully' });
};
