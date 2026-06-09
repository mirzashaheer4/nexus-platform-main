const express = require('express');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const verifyToken = require('../middleware/auth');
const verifyOwnership = require('../middleware/verifyOwnership');
const Document = require('../models/Document');
const User = require('../models/User');

const router = express.Router();

// Helper validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    return res.status(422).json({ errors: errors.array() });
  };
};

// ─── AWS S3 config & Fallback Detection ──────────────────────────────────────
const useS3 = !!(
  process.env.AWS_ACCESS_KEY &&
  process.env.AWS_SECRET_KEY &&
  process.env.AWS_BUCKET_NAME
);

let s3;
if (useS3) {
  aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
  });
  s3 = new aws.S3();
}

// ─── Multer Configuration ───────────────────────────────────────────────────
const allowedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg'
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const limits = { fileSize: 10 * 1024 * 1024 }; // 10MB limit

let upload;
if (useS3) {
  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `documents/${uuidv4()}${ext}`);
      }
    }),
    fileFilter,
    limits
  });
} else {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      }
    }),
    fileFilter,
    limits
  });
}

// Wrapper to handle Multer errors gracefully
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.message === 'File type not allowed') {
        return res.status(400).json({ message: 'File type not allowed' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Max limit is 10MB.' });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// ─── API Routes (All protected by verifyToken) ───────────────────────────────

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a new document file (PDF, DOCX, PNG, JPG <= 10MB)
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - title
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: Comma separated tags
 *     responses:
 *       201:
 *         description: Document uploaded and metadata created
 */
router.post(
  '/upload',
  verifyToken,
  uploadMiddleware,
  validate([
    body('title').isString().trim().escape().notEmpty().withMessage('Title is required.'),
    body('description').optional().isString().trim().escape(),
    body('tags').optional().isString().trim().escape()
  ]),
  async (req, res) => {
    const { title, description, tags } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'File is required.' });
    }

    const fileUrl = useS3 ? req.file.key : `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean))
      : [];

    const document = new Document({
      title,
      description: description || '',
      uploadedBy: req.user.id,
      sharedWith: [],
      fileUrl,
      fileName,
      fileSize,
      fileType,
      version: 1,
      status: 'draft',
      tags: parsedTags
    });

    await document.save();
    res.status(201).json(document);
  }
);

/**
 * @swagger
 * /api/documents/my:
 *   get:
 *     summary: Retrieve documents owned by or shared with the logged-in user
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/my', verifyToken, async (req, res) => {
  const documents = await Document.find({
    $or: [
      { uploadedBy: req.user.id },
      { sharedWith: req.user.id }
    ]
  })
  .populate('uploadedBy sharedWith', 'name email')
  .sort({ createdAt: -1 });

  res.json(documents);
});

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get metadata of a single document
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document details
 *       403:
 *         description: Access denied
 *       404:
 *         description: Document not found
 */
router.get(
  '/:id',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.')
  ]),
  async (req, res) => {
    const document = await Document.findById(req.params.id).populate('uploadedBy sharedWith', 'name email');
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const isOwner = document.uploadedBy._id.toString() === req.user.id;
    const isShared = document.sharedWith.some(user => user._id.toString() === req.user.id);

    if (!isOwner && !isShared) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json(document);
  }
);

/**
 * @swagger
 * /api/documents/{id}/share:
 *   put:
 *     summary: Share a document with another user by user ID
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shared successfully
 */
router.put(
  '/:id/share',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.'),
    body('userId').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Valid user ID to share with required.')
  ]),
  verifyOwnership(Document, 'uploadedBy'),
  async (req, res) => {
    const { userId } = req.body;
    const document = req.resource;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User to share with not found.' });
    }

    if (document.sharedWith.includes(userId)) {
      return res.status(400).json({ message: 'Document already shared with this user.' });
    }

    document.sharedWith.push(userId);
    await document.save();

    res.json(document);
  }
);

/**
 * @swagger
 * /api/documents/{id}/status:
 *   put:
 *     summary: Update status of a document
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, under_review, signed, archived]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put(
  '/:id/status',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.'),
    body('status').isIn(['draft', 'under_review', 'signed', 'archived']).withMessage('Invalid status.')
  ]),
  async (req, res) => {
    const { status } = req.body;
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const isOwner = document.uploadedBy.toString() === req.user.id;
    const isShared = document.sharedWith.includes(req.user.id);

    if (!isOwner && !isShared) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    document.status = status;
    await document.save();

    res.json(document);
  }
);

/**
 * @swagger
 * /api/documents/{id}/sign:
 *   post:
 *     summary: Attach a base64 signature and change status to signed
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatureImage
 *             properties:
 *               signatureImage:
 *                 type: string
 *                 description: Base64 representation of signature canvas drawing
 *     responses:
 *       200:
 *         description: Document signed successfully
 */
router.post(
  '/:id/sign',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.'),
    body('signatureImage').notEmpty().withMessage('signatureImage is required.')
  ]),
  async (req, res) => {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const isOwner = document.uploadedBy.toString() === req.user.id;
    const isShared = document.sharedWith.includes(req.user.id);

    if (!isOwner && !isShared) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const base64Data = req.body.signatureImage;
    const base64String = base64Data.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');

    let signatureImageUrl;

    if (!useS3) {
      const sigFileName = `sig_${uuidv4()}.png`;
      const sigPath = path.join(__dirname, '../uploads', sigFileName);
      fs.writeFileSync(sigPath, buffer);
      signatureImageUrl = `/uploads/${sigFileName}`;
    } else {
      const sigFileName = `signatures/${uuidv4()}.png`;
      const uploadResult = await s3.upload({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: sigFileName,
        Body: buffer,
        ContentType: 'image/png'
      }).promise();
      signatureImageUrl = uploadResult.Location;
    }

    document.signature = {
      signedBy: req.user.id,
      signatureImageUrl,
      signedAt: new Date()
    };
    document.status = 'signed';

    await document.save();
    res.json(document);
  }
);

/**
 * @swagger
 * /api/documents/{id}:
 *   delete:
 *     summary: Soft delete (archive) a document
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document archived successfully
 */
router.delete(
  '/:id',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.')
  ]),
  verifyOwnership(Document, 'uploadedBy'),
  async (req, res) => {
    const document = req.resource;
    document.status = 'archived';
    await document.save();

    res.json({ message: 'Document archived successfully.', document });
  }
);

/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     summary: Download the document file (or redirects to pre-signed S3 URL)
 *     tags: [Documents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document file binary download
 */
router.get(
  '/:id/download',
  verifyToken,
  validate([
    param('id').custom(id => mongoose.Types.ObjectId.isValid(id)).withMessage('Invalid Document ID.')
  ]),
  async (req, res) => {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const isOwner = document.uploadedBy.toString() === req.user.id;
    const isShared = document.sharedWith.includes(req.user.id);

    if (!isOwner && !isShared) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!useS3) {
      const filePath = path.join(__dirname, '../', document.fileUrl);
      return res.download(filePath, document.fileName);
    } else {
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: document.fileUrl,
        Expires: 60
      };
      const url = await s3.getSignedUrlPromise('getObject', params);
      return res.redirect(url);
    }
  }
);

const mongoose = require('mongoose');

module.exports = router;
