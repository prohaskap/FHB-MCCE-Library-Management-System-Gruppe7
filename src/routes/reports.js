const express = require('express');
const { db } = require('../db');
const { calculateFee } = require('../fees');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Loan history and reporting
 */

/**
 * @swagger
 * /api/reports/members/{id}/history:
 *   get:
 *     summary: Full loan history for a member
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Loan history
 *       404:
 *         description: Member not found
 */
router.get('/members/:id/history', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const loans = db.prepare('SELECT * FROM loans WHERE memberId = ? ORDER BY borrowDate DESC').all(req.params.id);
  res.json({ member, loans });
});

/**
 * @swagger
 * /api/reports/members/{id}/stats:
 *   get:
 *     summary: Statistics for a member
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member statistics
 *       404:
 *         description: Member not found
 */
router.get('/members/:id/stats', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const loans = db.prepare('SELECT * FROM loans WHERE memberId = ?').all(req.params.id);
  const activeLoans = loans.filter(l => l.status === 'active').length;
  const totalFeesPaid = loans
    .filter(l => l.status === 'returned')
    .reduce((sum, l) => sum + l.fee, 0);

  res.json({
    memberId: member.id,
    totalLoans: loans.length,
    activeLoans,
    returnedLoans: loans.filter(l => l.status === 'returned').length,
    totalFeesPaid: parseFloat(totalFeesPaid.toFixed(2))
  });
});

/**
 * @swagger
 * /api/reports/books/top:
 *   get:
 *     summary: Most borrowed books
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Top borrowed books
 */
router.get('/books/top', (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit ?? 10));
  const rows = db.prepare(`
    SELECT b.*, COUNT(l.id) as loanCount
    FROM books b
    LEFT JOIN loans l ON l.bookId = b.id
    GROUP BY b.id
    ORDER BY loanCount DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

/**
 * @swagger
 * /api/reports/loans/overdue:
 *   get:
 *     summary: All currently overdue loans
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Overdue loans with accrued fee
 */
router.get('/loans/overdue', (req, res) => {
  const loans = db.prepare(
    "SELECT * FROM loans WHERE status='active' AND dueDate < date('now') ORDER BY dueDate ASC"
  ).all();

  const today = new Date().toISOString().slice(0, 10);
  const enriched = loans.map(l => ({
    ...l,
    accruedFee: calculateFee(l.borrowDate, l.dueDate, today)
  }));

  res.json(enriched);
});

module.exports = router;
