const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.post('/upload', auth, upload.single('file'), async (req, res) => {
  const { title } = req.body;
  const doc = new Document({
    title,
    fileUrl: `/uploads/${req.file.filename}`,
    fileType: req.file.mimetype,
    uploadedBy: req.user.id,
    sharedWith: [req.user.id]
  });
  await doc.save();
  res.json(doc);
});

router.get('/', auth, async (req, res) => {
  const docs = await Document.find({ sharedWith: req.user.id }).populate('uploadedBy', 'name');
  res.json(docs);
});

router.post('/:id/sign', auth, async (req, res) => {
  const { signatureUrl } = req.body;
  await Document.findByIdAndUpdate(req.params.id, { signature: signatureUrl, status: 'signed' });
  res.json({ message: 'Signed' });
});

module.exports = router;
