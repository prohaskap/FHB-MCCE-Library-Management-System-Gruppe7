const express = require('express');
const { db } = require('../db');
const router = express.Router();

const MAX_RESERVATIONS = 3;

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Book reservations and waitlist
 */

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: List reservations
 *     tags: [Reservations]
 *     parameters:
 *       - in: query
 *         name: bookId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, ready, cancelled]
 *     responses:
 *       200:
 *         description: Array of reservations
 */
router.get('/', (req, res) => {
  let sql = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];
  if (req.query.bookId)   { sql += ' AND bookId = ?';   params.push(req.query.bookId); }
  if (req.query.memberId) { sql += ' AND memberId = ?'; params.push(req.query.memberId); }
  if (req.query.status)   { sql += ' AND status = ?';   params.push(req.query.status); }
  sql += ' ORDER BY createdAt ASC';
  res.json(db.prepare(sql).all(...params));
});

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Get a reservation by ID
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reservation found
 *       404:
 *         description: Reservation not found
 */
router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Reservation not found' });
  res.json(r);
});

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Reserve a book
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId, memberId]
 *             properties:
 *               bookId:   { type: integer, example: 1 }
 *               memberId: { type: integer, example: 2 }
 *     responses:
 *       201:
 *         description: Reservation created
 *       400:
 *         description: Business rule violation
 *       404:
 *         description: Book or member not found
 *       409:
 *         description: Conflict — already reserved or loan exists
 */
router.post('/', (req, res) => {
  const { bookId, memberId } = req.body;

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (member.status !== 'active')
    return res.status(400).json({ error: 'Inactive members cannot make reservations' });

  if (book.availableCopies > 0)
    return res.status(400).json({ error: 'Book is available — please borrow it instead of reserving' });

  const alreadyBorrowed = db.prepare(
    "SELECT id FROM loans WHERE bookId=? AND memberId=? AND status='active'"
  ).get(bookId, memberId);
  if (alreadyBorrowed)
    return res.status(409).json({ error: 'You already have this book on loan' });

  const alreadyReserved = db.prepare(
    "SELECT id FROM reservations WHERE bookId=? AND memberId=? AND status IN ('pending','ready')"
  ).get(bookId, memberId);
  if (alreadyReserved)
    return res.status(409).json({ error: 'You already have an active reservation for this book' });

  const activeCount = db.prepare(
    "SELECT COUNT(*) as n FROM reservations WHERE memberId=? AND status IN ('pending','ready')"
  ).get(memberId);
  if (activeCount.n >= MAX_RESERVATIONS)
    return res.status(409).json({ error: `Members may not have more than ${MAX_RESERVATIONS} active reservations` });

  const result = db.prepare(
    'INSERT INTO reservations (bookId, memberId) VALUES (?, ?)'
  ).run(bookId, memberId);

  res.status(201).json(db.prepare('SELECT * FROM reservations WHERE id = ?').get(result.lastInsertRowid));
});

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   post:
 *     summary: Cancel a reservation
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reservation cancelled
 *       404:
 *         description: Reservation not found
 *       409:
 *         description: Reservation already cancelled
 */
router.post('/:id/cancel', (req, res) => {
  const r = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Reservation not found' });
  if (r.status === 'cancelled') return res.status(409).json({ error: 'Reservation already cancelled' });

  db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(r.id);
  res.json(db.prepare('SELECT * FROM reservations WHERE id = ?').get(r.id));
});

module.exports = router;
