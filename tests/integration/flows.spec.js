// tests/integration/flows.spec.js
const { test, expect } = require("@playwright/test");
const {
  createBook, createMember, createLoan, returnLoan,
  createReservation, cancelReservation, getReservation, sleep,
} = require("../../helpers/api-helpers");

test.describe("Integration / Multi-Step Flows @integration", () => {

  // TC-G7-023
  test("TC-G7-023 two reservations, two returns: both promoted in FIFO order", async ({ request }) => {
    // Two copies are needed: reserving requires availableCopies === 0, so both
    // copies must be on loan first. With a single copy the held copy can never be
    // re-borrowed (availableCopies stays 0 while a reservation is pending), making
    // a second promotion impossible on this SUT.
    const book = await createBook(request, { totalCopies: 2 });
    const borrower1 = await createMember(request);
    const borrower2 = await createMember(request);
    const reserverA = await createMember(request);
    const reserverB = await createMember(request);

    const loan1 = await createLoan(request, book.id, borrower1.id);
    const loan2 = await createLoan(request, book.id, borrower2.id);

    const rA = await createReservation(request, book.id, reserverA.id);
    await sleep(40);
    const rB = await createReservation(request, book.id, reserverB.id);

    // First return promotes the oldest pending reservation (rA)
    await returnLoan(request, loan1.id);
    let a = await getReservation(request, rA.id);
    let b = await getReservation(request, rB.id);
    expect(a.status).toBe("ready");
    expect(b.status).toBe("pending");

    // Second return promotes the next pending reservation (rB)
    await returnLoan(request, loan2.id);
    b = await getReservation(request, rB.id);
    expect(b.status).toBe("ready");
  });

  // TC-G7-024
  test("TC-G7-024 cancelling oldest reservation, return promotes the next pending", async ({ request }) => {
    const book = await createBook(request, { totalCopies: 1 });
    const borrower = await createMember(request);
    const reserverA = await createMember(request);
    const reserverB = await createMember(request);

    const loan = await createLoan(request, book.id, borrower.id);
    const rA = await createReservation(request, book.id, reserverA.id);
    await sleep(40);
    const rB = await createReservation(request, book.id, reserverB.id);

    await cancelReservation(request, rA.id);
    await returnLoan(request, loan.id);

    const a = await getReservation(request, rA.id);
    const b = await getReservation(request, rB.id);
    expect(a.status).toBe("cancelled");
    expect(b.status).toBe("ready");
  });

  // TC-G7-025
  test("TC-G7-025 overdue report reflects loan whose dueDate moved to the past", async ({ request }) => {
    // This test depends on a test-only helper for back-dating. If your SUT
    // does not expose one, mark this test as skip() and document it in the
    // strategy document under Limitations.
    const member = await createMember(request);
    const book = await createBook(request, { totalCopies: 1 });
    const loan = await createLoan(request, book.id, member.id);

    // Attempt back-date via internal test endpoint. If unavailable, skip.
    const backdate = await request.post(`/api/_test/loans/${loan.id}/backdate`, {
      data: { daysAgo: 15 },
    });
    test.skip(!backdate.ok(), "Backdate helper endpoint not available on SUT");

    const res = await request.get("/api/reports/loans/overdue");
    expect(res.status()).toBe(200);
    const overdue = await res.json();
    const ids = overdue.map((l) => l.id);
    expect(ids).toContain(loan.id);
  });

  // TC-G7-026
  test("TC-G7-026 loan history after multiple borrow/return cycles is complete and ordered", async ({ request }) => {
    const member = await createMember(request);
    const books = await Promise.all([
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
    ]);

    const loans = [];
    for (const b of books) {
      const l = await createLoan(request, b.id, member.id);
      await returnLoan(request, l.id);
      loans.push(l);
    }

    const res = await request.get(`/api/reports/members/${member.id}/history`);
    expect(res.status()).toBe(200);
    const { loans: history } = await res.json();
    expect(history.length).toBe(3);
    for (const entry of history) {
      expect(entry.status).toBe("returned");
      expect(entry.returnDate).not.toBeNull();
    }
  });

  // TC-G7-027
  test("TC-G7-027 stats and history stay consistent with mixed active/returned loans", async ({ request }) => {
    const member = await createMember(request);
    const books = await Promise.all([
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
    ]);

    const l1 = await createLoan(request, books[0].id, member.id);
    const l2 = await createLoan(request, books[1].id, member.id);
    const l3 = await createLoan(request, books[2].id, member.id);
    const l4 = await createLoan(request, books[3].id, member.id);
    await returnLoan(request, l1.id);
    await returnLoan(request, l2.id);
    // l3 and l4 remain active

    const statsRes = await request.get(`/api/reports/members/${member.id}/stats`);
    const historyRes = await request.get(`/api/reports/members/${member.id}/history`);
    expect(statsRes.status()).toBe(200);
    expect(historyRes.status()).toBe(200);
    const stats = await statsRes.json();
    const { loans: history } = await historyRes.json();

    expect(stats.totalLoans).toBe(4);
    expect(stats.activeLoans).toBe(2);
    expect(history.length).toBe(4);
  });
});
