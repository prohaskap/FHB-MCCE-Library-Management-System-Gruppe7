const express = require('express');
const { db } = require('../db');
const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateMember(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('name is required');
  if (!body.email || !EMAIL_RE.test(body.email)) errors.push('email must be a valid email address');
  return errors;
}

function nextMemberNumber() {
  const row = db.prepare('SELECT COUNT(*) as n FROM members').get();
  return `M${String(row.n + 1).padStart(4, '0')}`;
}

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Library member management
 */

/**
 * @swagger
 * /api/members:
 *   get:
 *     summary: List all members
 *     tags: [Members]
 *     responses:
 *       200:
 *         description: Array of members
 */
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM members ORDER BY name').all());
});

/**
 * @swagger
 * /api/members/{id}:
 *   get:
 *     summary: Get a member by ID
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member found
 *       404:
 *         description: Member not found
 */
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(member);
});

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Register a new member
 *     tags: [Members]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:  { type: string, example: "Alice Müller" }
 *               email: { type: string, example: "alice@example.com" }
 *     responses:
 *       201:
 *         description: Member registered
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 */
router.post('/', (req, res) => {
  const errors = validateMember(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const { name, email } = req.body;
  try {
    const memberNumber = nextMemberNumber();
    const result = db.prepare(
      'INSERT INTO members (name, email, memberNumber) VALUES (?, ?, ?)'
    ).run(name.trim(), email.toLowerCase().trim(), memberNumber);
    res.status(201).json(db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already registered' });
    throw e;
  }
});

/**
 * @swagger
 * /api/members/{id}:
 *   put:
 *     summary: Update a member
 *     tags: [Members]
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
 *               name:  { type: string }
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Member updated
 *       404:
 *         description: Member not found
 *       409:
 *         description: Email already taken
 */
router.put('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const merged = { name: member.name, email: member.email, ...req.body };
  const errors = validateMember(merged);
  if (errors.length) return res.status(400).json({ errors });

  try {
    db.prepare('UPDATE members SET name=?, email=? WHERE id=?')
      .run(merged.name.trim(), merged.email.toLowerCase().trim(), member.id);
    res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(member.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already taken by another member' });
    throw e;
  }
});

/**
 * @swagger
 * /api/members/{id}/deactivate:
 *   post:
 *     summary: Deactivate a member
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member deactivated
 *       404:
 *         description: Member not found
 */
router.post('/:id/deactivate', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  db.prepare("UPDATE members SET status='inactive' WHERE id=?").run(member.id);
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(member.id));
});

/**
 * @swagger
 * /api/members/{id}/activate:
 *   post:
 *     summary: Reactivate a member
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member activated
 *       404:
 *         description: Member not found
 */
router.post('/:id/activate', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  db.prepare("UPDATE members SET status='active' WHERE id=?").run(member.id);
  res.json(db.prepare('SELECT * FROM members WHERE id = ?').get(member.id));
});

/**
 * @swagger
 * /api/members/{id}:
 *   delete:
 *     summary: Delete a member
 *     tags: [Members]
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
 *         description: Member not found
 *       409:
 *         description: Member has active loans
 */
router.delete('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const activeLoans = db.prepare("SELECT COUNT(*) as n FROM loans WHERE memberId = ? AND status = 'active'").get(req.params.id);
  if (activeLoans.n > 0) return res.status(409).json({ error: 'Member has active loans and cannot be deleted' });

  db.prepare('DELETE FROM reservations WHERE memberId = ?').run(req.params.id);
  db.prepare('DELETE FROM loans WHERE memberId = ?').run(req.params.id);
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

module.exports = router;
