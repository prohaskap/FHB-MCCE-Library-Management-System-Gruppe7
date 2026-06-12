// helpers/api-helpers.js
/**
 * Reusable API helpers for the Library Management System tests.
 * All helpers expect a Playwright `request` fixture and return parsed JSON.
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

function uniqueSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

let _isbnSeq = 0;
function randomIsbn13() {
  // Build a 13-digit ISBN-like number (978 + 10 digits). We do not validate the
  // check digit because the SUT only validates length. The per-call counter keeps
  // parallel createBook calls (e.g. Promise.all) from colliding on the unique ISBN.
  _isbnSeq = (_isbnSeq + 1) % 1000;
  const t = (Date.now() % 10_000_000).toString().padStart(7, "0");
  const c = _isbnSeq.toString().padStart(3, "0");
  return `978${t}${c}`;
}

async function createBook(request, overrides = {}) {
  const suffix = uniqueSuffix();
  const payload = {
    isbn: randomIsbn13(),
    title: `TestBook_${suffix}`,
    author: `TestAuthor_${suffix}`,
    genre: "Fiction",
    year: 2020,
    totalCopies: 1,
    ...overrides,
  };
  const res = await request.post("/api/books", { data: payload });
  if (!res.ok()) throw new Error(`createBook failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function createMember(request, overrides = {}) {
  const suffix = uniqueSuffix();
  const payload = {
    name: `TestMember_${suffix}`,
    email: `tm_${suffix}@test.local`,
    ...overrides,
  };
  const res = await request.post("/api/members", { data: payload });
  if (!res.ok()) throw new Error(`createMember failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function createLoan(request, bookId, memberId) {
  const res = await request.post("/api/loans", {
    data: { bookId, memberId },
  });
  if (!res.ok()) throw new Error(`createLoan failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function returnLoan(request, loanId) {
  const res = await request.post(`/api/loans/${loanId}/return`);
  if (!res.ok()) throw new Error(`returnLoan failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function createReservation(request, bookId, memberId) {
  const res = await request.post("/api/reservations", {
    data: { bookId, memberId },
  });
  if (!res.ok()) throw new Error(`createReservation failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function cancelReservation(request, reservationId) {
  const res = await request.post(`/api/reservations/${reservationId}/cancel`);
  if (!res.ok()) throw new Error(`cancelReservation failed: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function getBook(request, bookId) {
  const res = await request.get(`/api/books/${bookId}`);
  if (!res.ok()) throw new Error(`getBook failed: ${res.status()}`);
  return await res.json();
}

async function getReservation(request, reservationId) {
  const res = await request.get(`/api/reservations/${reservationId}`);
  if (!res.ok()) throw new Error(`getReservation failed: ${res.status()}`);
  return await res.json();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits until the wall clock has entered the next full second (plus a small
 * safety margin). The SUT stores reservation createdAt via SQLite
 * datetime('now'), which has SECOND precision: two reservations created
 * within the same second get identical createdAt values, and the FIFO
 * promotion order would silently fall back to row insertion order instead
 * of the timestamp. Crossing a real second boundary guarantees a strictly
 * later createdAt for the next created reservation (tests and SUT share
 * the same host clock).
 */
async function waitForNextSecond() {
  await sleep(1000 - (Date.now() % 1000) + 50);
}

module.exports = {
  BASE,
  uniqueSuffix,
  randomIsbn13,
  createBook,
  createMember,
  createLoan,
  returnLoan,
  createReservation,
  cancelReservation,
  getBook,
  getReservation,
  sleep,
  waitForNextSecond,
};