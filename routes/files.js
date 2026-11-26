const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const File = require('../models/File');
const Cart = require('../models/Cart');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MAX_SIZE = 25 * 1024 * 1024;
const MAX_PAGES = 300;
const STAFF = ['PrintStaff', 'SuperAdmin'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 }
});

// call the phone storage server
const storage = (path, options = {}) =>
  fetch(process.env.STORAGE_URL + path, {
    ...options,
    headers: { 'x-api-key': process.env.STORAGE_KEY },
    signal: AbortSignal.timeout(15000)
  });

// find file + check owner or staff
async function loadFile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid id' });
    return null;
  }
  const doc = await File.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const isOwner = String(doc.userId) === req.user.id;
  if (!isOwner && !STAFF.includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return doc;
}

// UPLOAD
router.post('/', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No file' });
    if (f.buffer.subarray(0, 5).toString() !== '%PDF-') {
      return res.status(400).json({ error: 'PDF only' });
    }

    let pageCount;
    try {
      const pdf = await PDFDocument.load(f.buffer, { ignoreEncryption: true });
      pageCount = pdf.getPageCount();
    } catch {
      return res.status(400).json({ error: 'Cannot read this PDF' });
    }
    if (pageCount > MAX_PAGES) {
      return res.status(400).json({ error: `Max ${MAX_PAGES} pages` });
    }

    const form = new FormData();
    form.append('file', new Blob([f.buffer], { type: 'application/pdf' }), f.originalname);

    let r;
    try {
      r = await storage('/upload', { method: 'POST', body: form });
    } catch {
      return res.status(502).json({ error: 'Storage unreachable' });
    }
    if (!r.ok) return res.status(502).json({ error: 'Storage rejected file' });
    const stored = await r.json();

    const doc = await File.create({
      userId: req.user.id,
      fileName: f.originalname,
      storageId: stored.id,
      fileSize: f.size,
      pageCount
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LIST my files
router.get('/', requireAuth, async (req, res) => {
  const files = await File.find({ userId: req.user.id }).sort({ uploadedAt: -1 });
  res.json(files);
});

// DOWNLOAD (owner or print staff)
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const doc = await loadFile(req, res);
    if (!doc) return;
    let r;
    try {
      r = await storage('/files/' + doc.storageId);
    } catch {
      return res.status(502).json({ error: 'Storage unreachable' });
    }
    if (!r.ok) return res.status(502).json({ error: 'File missing in storage' });
    res.type('application/pdf').send(Buffer.from(await r.arrayBuffer()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const doc = await loadFile(req, res);
    if (!doc) return;
    try {
      await storage('/files/' + doc.storageId, { method: 'DELETE' });
    } catch {
      return res.status(502).json({ error: 'Storage unreachable' });
    }
    await Cart.updateMany({ 'items.fileId': doc._id }, { $pull: { items: { fileId: doc._id } } });  
    await doc.deleteOne();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;