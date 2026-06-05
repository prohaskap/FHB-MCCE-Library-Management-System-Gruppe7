const express = require('express');
const { db } = require('../db');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Search and filter the catalog and members
 */

/**
 * @swagger
 * /api/search/books:
 *   get:
 *     summary: Search books
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term matched against title, author, ISBN
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *         description: Only return books with at least one available copy
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated search results
 */
router.get('/books', (req, res) => {
  const { q = '', genre, available, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
  const term = `%${q}%`;

  let sql = 'SELECT * FROM books WHERE (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
  const params = [term, term, term];

  if (genre) { sql += ' AND genre LIKE ?'; params.push(`%${genre}%`); }
  if (available === 'true') { sql += ' AND availableCopies > 0'; }

  const total = db.prepare(`SELECT COUNT(*) as n FROM books WHERE (title LIKE ? OR author LIKE ? OR isbn LIKE ?)${genre ? ' AND genre LIKE ?' : ''}${available === 'true' ? ' AND availableCopies > 0' : ''}`).get(...params).n;

  sql += ' ORDER BY title LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), results: db.prepare(sql).all(...params) });
});

/**
 * @swagger
 * /api/search/members:
 *   get:
 *     summary: Search members
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term matched against name and email
 *     responses:
 *       200:
 *         description: Array of members
 */
router.get('/members', (req, res) => {
  const { q = '' } = req.query;
  const term = `%${q}%`;
  res.json(db.prepare('SELECT * FROM members WHERE name LIKE ? OR email LIKE ? ORDER BY name').all(term, term));
});

module.exports = router;
