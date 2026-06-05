const express = require('express');
const { db } = require('../db');
const router = express.Router();

const ISBN_RE = /^(?:\d{9}[\dX]|\d{13})$/;

function validateBook(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('title is required');
  if (!body.author || !body.author.trim()) errors.push('author is required');
  if (!body.isbn || !ISBN_RE.test(body.isbn)) errors.push('isbn must be a valid 10 or 13 digit ISBN');
  const year = parseInt(body.year);
  if (!body.year || isNaN(year) || year < 1000 || year > new Date().getFullYear())
    errors.push('year must be a valid year not in the future');
  const copies = parseInt(body.totalCopies ?? 1);
  if (isNaN(copies) || copies < 1) errors.push('totalCopies must be at least 1');
  return errors;
}

/**
 * @swagger
 * tags:
 *   name: Books
 *   description: Book catalog management
 */

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: List all books
 *     tags: [Books]
 *     responses:
 *       200:
 *         description: Array of books
 */
router.get('/', (req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY title').all();
  res.json(books);
});

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get a book by ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Book found
 *       404:
 *         description: Book not found
 */
router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Add a new book
 *     tags: [Books]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isbn, title, author, year]
 *             properties:
 *               isbn:        { type: string, example: "9780140328721" }
 *               title:       { type: string, example: "Watership Down" }
 *               author:      { type: string, example: "Richard Adams" }
 *               genre:       { type: string, example: "Fiction" }
 *               year:        { type: integer, example: 1972 }
 *               totalCopies: { type: integer, example: 3, default: 1 }
 *     responses:
 *       201:
 *         description: Book created
 *       400:
 *         description: Validation error
 *       409:
 *         description: ISBN already exists
 */
router.post('/', (req, res) => {
  const errors = validateBook(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { isbn, title, author, genre = '', year, totalCopies = 1 } = req.body;
  const copies = parseInt(totalCopies);

  try {
    const result = db.prepare(
      'INSERT INTO books (isbn, title, author, genre, year, totalCopies, availableCopies) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(isbn, title.trim(), author.trim(), genre.trim(), parseInt(year), copies, copies);

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(book);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'ISBN already exists' });
    throw e;
  }
});

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:       { type: string }
 *               author:      { type: string }
 *               genre:       { type: string }
 *               year:        { type: integer }
 *               totalCopies: { type: integer }
 *     responses:
 *       200:
 *         description: Book updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Book not found
 */
router.put('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const merged = { ...book, ...req.body, isbn: book.isbn };
  const errors = validateBook(merged);
  if (errors.length) return res.status(400).json({ errors });

  const copies = parseInt(merged.totalCopies);
  const diff = copies - book.totalCopies;
  const newAvailable = Math.max(0, book.availableCopies + diff);

  db.prepare(
    'UPDATE books SET title=?, author=?, genre=?, year=?, totalCopies=?, availableCopies=? WHERE id=?'
  ).run(merged.title.trim(), merged.author.trim(), merged.genre.trim(), parseInt(merged.year), copies, newAvailable, book.id);

  res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(book.id));
});

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Delete a book
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Deleted
 *       404:
 *         description: Book not found
 *       409:
 *         description: Book has active loans
 */
router.delete('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const activeLoans = db.prepare("SELECT COUNT(*) as n FROM loans WHERE bookId = ? AND status = 'active'").get(req.params.id);
  if (activeLoans.n > 0) return res.status(409).json({ error: 'Book has active loans and cannot be deleted' });

  db.prepare('DELETE FROM reservations WHERE bookId = ?').run(req.params.id);
  db.prepare('DELETE FROM loans WHERE bookId = ?').run(req.params.id);
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
