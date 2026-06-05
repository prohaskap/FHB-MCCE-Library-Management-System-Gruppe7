const express = require('express');
const { db } = require('../db');
const { calculateFee, dueDate } = require('../fees');
const router = express.Router();

const MAX_ACTIVE_LOANS = 5;

function promoteReservation(bookId) {
  const next = db.prepare(
    "SELECT * FROM reservations WHERE bookId = ? AND status = 'pending' ORDER BY createdAt ASC LIMIT 1"
  ).get(bookId);
  if (next) {
    db.prepare("UPDATE reservations SET status='ready' WHERE id=?").run(next.id);
  }
}

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: Borrowing and returning books
 */

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: List all loans
 *     tags: [Loans]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, returned]
 *         description: Filter by loan status
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: integer
 *         description: Filter by member
 *       - in: query
 *         name: overdue
 *         schema:
 *           type: boolean
 *         description: Return only overdue active loans
 *     responses:
 *       200:
 *         description: Array of loans
 */
router.get('/', (req, res) => {
  let sql = 'SELECT * FROM loans WHERE 1=1';
  const params = [];

  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
  if (req.query.memberId) { sql += ' AND memberId = ?'; params.push(req.query.memberId); }
  if (req.query.overdue === 'true') {
    sql += " AND status = 'active' AND dueDate < date('now')";
  }

  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

/**
 * @swagger
 * /api/loans/{id}:
 *   get:
 *     summary: Get a loan by ID
 *     tags: [Loans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Loan found
 *       404:
 *         description: Loan not found
 */
router.get('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json(loan);
});

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Borrow a book
 *     tags: [Loans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId, memberId]
 *             properties:
 *               bookId:   { type: integer, example: 1 }
 *               memberId: { type: integer, example: 1 }
 *     responses:
 *       201:
 *         description: Loan created
 *       400:
 *         description: Business rule violation
 *       404:
 *         description: Book or member not found
 *       409:
 *         description: No copies available or other conflict
 */
router.post('/', (req, res) => {
  const { bookId, memberId } = req.body;

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (member.status !== 'active')
    return res.status(400).json({ error: 'Inactive members cannot borrow books' });

  if (book.availableCopies < 1)
    return res.status(409).json({ error: 'No copies available' });

  const alreadyBorrowed = db.prepare(
    "SELECT id FROM loans WHERE bookId=? AND memberId=? AND status='active'"
  ).get(bookId, memberId);
  if (alreadyBorrowed)
    return res.status(409).json({ error: 'Member already has this book on loan' });

  const activeCount = db.prepare(
    "SELECT COUNT(*) as n FROM loans WHERE memberId=? AND status='active'"
  ).get(memberId);
  if (activeCount.n >= MAX_ACTIVE_LOANS)
    return res.status(409).json({ error: `Members may not have more than ${MAX_ACTIVE_LOANS} active loans` });

  const today = new Date().toISOString().slice(0, 10);
  const due = dueDate(today);

  const result = db.prepare(
    'INSERT INTO loans (bookId, memberId, borrowDate, dueDate) VALUES (?, ?, ?, ?)'
  ).run(bookId, memberId, today, due);

  db.prepare('UPDATE books SET availableCopies = availableCopies - 1 WHERE id = ?').run(bookId);

  res.status(201).json(db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid));
});

/**
 * @swagger
 * /api/loans/{id}/return:
 *   post:
 *     summary: Return a borrowed book
 *     tags: [Loans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Loan closed, fee calculated
 *       404:
 *         description: Loan not found
 *       409:
 *         description: Loan already returned
 */
router.post('/:id/return', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (loan.status === 'returned') return res.status(409).json({ error: 'Loan already returned' });

  const today = new Date().toISOString().slice(0, 10);
  const fee = calculateFee(loan.borrowDate, loan.dueDate, today);

  db.prepare(
    "UPDATE loans SET status='returned', returnDate=?, fee=? WHERE id=?"
  ).run(today, fee, loan.id);

  // Only restore the copy if no reservation is waiting — if one is, the copy is held for them
  const pendingResv = db.prepare(
    "SELECT id FROM reservations WHERE bookId = ? AND status = 'pending' ORDER BY createdAt ASC LIMIT 1"
  ).get(loan.bookId);

  if (!pendingResv) {
    db.prepare('UPDATE books SET availableCopies = availableCopies + 1 WHERE id = ?').run(loan.bookId);
  }

  promoteReservation(loan.bookId);

  res.json(db.prepare('SELECT * FROM loans WHERE id = ?').get(loan.id));
});

/**
 * @swagger
 * /api/loans/{id}/fee:
 *   get:
 *     summary: Calculate current fee for a loan
 *     tags: [Loans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Fee details
 *       404:
 *         description: Loan not found
 */
router.get('/:id/fee', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const fee = calculateFee(loan.borrowDate, loan.dueDate, loan.returnDate);
  res.json({ loanId: loan.id, fee, dueDate: loan.dueDate, status: loan.status });
});

module.exports = router;
