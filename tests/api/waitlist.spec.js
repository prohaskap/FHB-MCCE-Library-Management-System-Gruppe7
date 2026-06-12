// tests/api/waitlist.spec.js
const { test, expect } = require("@playwright/test");
const {
  createBook, createMember, createLoan, returnLoan,
  createReservation, getReservation, getBook, waitForNextSecond,
} = require("../../helpers/api-helpers");

test.describe("Waitlist Promotion @api", () => {

  // TC-G7-001
  test("TC-G7-001 single pending reservation promoted to ready on book return", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserver = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    const reservation = await createReservation(request, book.id, reserver.id);
    expect(reservation.status).toBe("pending");

    await returnLoan(request, loan.id);

    const promoted = await getReservation(request, reservation.id);
    expect(promoted.status).toBe("ready");
  });

  // TC-G7-002
  test("TC-G7-002 oldest pending reservation is promoted first (FIFO)", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserverA = await createMember(request);
    const reserverB = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    const rA = await createReservation(request, book.id, reserverA.id);
    await waitForNextSecond(); // createdAt has second precision — rB must land in a later second
    const rB = await createReservation(request, book.id, reserverB.id);

    await returnLoan(request, loan.id);

    const a = await getReservation(request, rA.id);
    const b = await getReservation(request, rB.id);
    expect(a.status).toBe("ready");
    expect(b.status).toBe("pending");
  });

  // TC-G7-003
  test("TC-G7-003 two returns promote two reservations in FIFO order", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 2 });
    const borrowerA = await createMember(request);
    const borrowerB = await createMember(request);
    const r1m = await createMember(request);
    const r2m = await createMember(request);
    const r3m = await createMember(request);

    const loanA = await createLoan(request, book.id, borrowerA.id);
    const loanB = await createLoan(request, book.id, borrowerB.id);

    const r1 = await createReservation(request, book.id, r1m.id);
    await waitForNextSecond();
    const r2 = await createReservation(request, book.id, r2m.id);
    await waitForNextSecond();
    const r3 = await createReservation(request, book.id, r3m.id);

    await returnLoan(request, loanA.id);
    await returnLoan(request, loanB.id);

    const s1 = await getReservation(request, r1.id);
    const s2 = await getReservation(request, r2.id);
    const s3 = await getReservation(request, r3.id);
    expect(s1.status).toBe("ready");
    expect(s2.status).toBe("ready");
    expect(s3.status).toBe("pending");
  });

  // TC-G7-004
  test("TC-G7-004 cancelled reservation is skipped, next pending is promoted", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserverA = await createMember(request);
    const reserverB = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    const rA = await createReservation(request, book.id, reserverA.id);
    await waitForNextSecond();
    const rB = await createReservation(request, book.id, reserverB.id);

    // cancel the oldest one
    const cancelRes = await request.post(`/api/reservations/${rA.id}/cancel`);
    expect(cancelRes.ok()).toBeTruthy();

    await returnLoan(request, loan.id);

    const a = await getReservation(request, rA.id);
    const b = await getReservation(request, rB.id);
    expect(a.status).toBe("cancelled");
    expect(b.status).toBe("ready");
  });

  // TC-G7-005
  test("TC-G7-005 availableCopies stays unchanged when promotion fires", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserver = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    let snapshot = await getBook(request, book.id);
    expect(snapshot.availableCopies).toBe(0);

    await createReservation(request, book.id, reserver.id);
    await returnLoan(request, loan.id);

    snapshot = await getBook(request, book.id);
    expect(snapshot.availableCopies).toBe(0); // held for the reserver
  });

  // TC-G7-006
  test("TC-G7-006 availableCopies increments by 1 when no reservation is pending", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    let snapshot = await getBook(request, book.id);
    expect(snapshot.availableCopies).toBe(0);

    await returnLoan(request, loan.id);

    snapshot = await getBook(request, book.id);
    expect(snapshot.availableCopies).toBe(1);
  });

  // TC-G7-033 — Negative
  test("TC-G7-033 returning a non-existent loan returns 404", async ({ request }) => {
    const res = await request.post("/api/loans/999999/return");
    expect(res.status()).toBe(404);
  });

  // TC-G7-034 — Negative
  test("TC-G7-034 returning an already-returned loan returns 409", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const member = await createMember(request);
    const loan = await createLoan(request, book.id, member.id);

    await returnLoan(request, loan.id);

    const res = await request.post(`/api/loans/${loan.id}/return`);
    expect(res.status()).toBe(409);
  });

  // TC-G7-035 — Negative
  test("TC-G7-035 cancelling a non-existent reservation returns 404", async ({ request }) => {
    const res = await request.post("/api/reservations/999999/cancel");
    expect(res.status()).toBe(404);
  });

  // TC-G7-036 — Negative
  test("TC-G7-036 cancelling an already-cancelled reservation returns 409", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserver = await createMember(request);

    await createLoan(request, book.id, borrower.id);
    const reservation = await createReservation(request, book.id, reserver.id);

    const first = await request.post(`/api/reservations/${reservation.id}/cancel`);
    expect(first.ok()).toBeTruthy();

    const second = await request.post(`/api/reservations/${reservation.id}/cancel`);
    expect(second.status()).toBe(409);
  });

  // TC-G7-038 — Negative
  test("TC-G7-038 retrieving a non-existent reservation returns 404", async ({ request }) => {
    const res = await request.get("/api/reservations/999999");
    expect(res.status()).toBe(404);
  });
});
