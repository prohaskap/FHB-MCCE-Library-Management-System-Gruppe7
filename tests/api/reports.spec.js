// tests/api/reports.spec.js
const { test, expect } = require("@playwright/test");
const {
  createBook, createMember, createLoan, returnLoan,
} = require("../../helpers/api-helpers");

test.describe("Reports @api", () => {

  // TC-G7-015
  test("TC-G7-015 member loan history contains all loans of a member", async ({ request }) => {
    const member = await createMember(request);
    const book1 = await createBook(request, { totalCopies: 1 });
    const book2 = await createBook(request, { totalCopies: 1 });

    const loan1 = await createLoan(request, book1.id, member.id);
    const loan2 = await createLoan(request, book2.id, member.id);
    await returnLoan(request, loan2.id);

    const res = await request.get(`/api/reports/members/${member.id}/history`);
    expect(res.status()).toBe(200);
    const { loans: history } = await res.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(2);

    const ids = history.map((l) => l.id);
    expect(ids).toContain(loan1.id);
    expect(ids).toContain(loan2.id);
  });

  // TC-G7-016
  test("TC-G7-016 member loan history for non-existing id returns 404", async ({ request }) => {
    const res = await request.get("/api/reports/members/999999/history");
    expect(res.status()).toBe(404);
  });

  // TC-G7-017
  test("TC-G7-017 member statistics match the sum of individual loan records", async ({ request }) => {
    const member = await createMember(request);
    const books = await Promise.all([
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
      createBook(request, { totalCopies: 1 }),
    ]);

    const l1 = await createLoan(request, books[0].id, member.id);
    const l2 = await createLoan(request, books[1].id, member.id);
    const l3 = await createLoan(request, books[2].id, member.id);
    await returnLoan(request, l1.id);
    await returnLoan(request, l2.id);
    // l3 stays active

    const [statsRes, historyRes] = await Promise.all([
      request.get(`/api/reports/members/${member.id}/stats`),
      request.get(`/api/reports/members/${member.id}/history`),
    ]);
    expect(statsRes.status()).toBe(200);
    expect(historyRes.status()).toBe(200);

    const stats = await statsRes.json();
    const { loans: history } = await historyRes.json();

    expect(stats.totalLoans).toBe(history.length);
    const activeCount = history.filter((l) => l.status === "active").length;
    expect(stats.activeLoans).toBe(activeCount);
  });

  // TC-G7-018
  test("TC-G7-018 member statistics for a member without loans returns valid empty stats", async ({ request }) => {
    const member = await createMember(request);
    const res = await request.get(`/api/reports/members/${member.id}/stats`);
    expect(res.status()).toBe(200);
    const stats = await res.json();
    expect(stats.totalLoans).toBe(0);
    expect(stats.activeLoans ?? 0).toBe(0);
  });

  // TC-G7-019
  test("TC-G7-019 top-borrowed books are sorted in descending order", async ({ request }) => {
    const res = await request.get("/api/reports/books/top");
    expect(res.status()).toBe(200);
    const top = await res.json();
    expect(Array.isArray(top)).toBe(true);

    // Check descending by loan count (any field name candidate)
    for (let i = 1; i < top.length; i++) {
      const prev = top[i - 1].loanCount ?? top[i - 1].borrowCount ?? top[i - 1].count;
      const curr = top[i].loanCount ?? top[i].borrowCount ?? top[i].count;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  // TC-G7-020
  test("TC-G7-020 top-borrowed books respect the limit parameter", async ({ request }) => {
    const res = await request.get("/api/reports/books/top?limit=2");
    expect(res.status()).toBe(200);
    const top = await res.json();
    expect(top.length).toBeLessThanOrEqual(2);
  });

  // TC-G7-021
  test("TC-G7-021 overdue report contains only active loans with dueDate in the past", async ({ request }) => {
    const res = await request.get("/api/reports/loans/overdue");
    expect(res.status()).toBe(200);
    const overdue = await res.json();
    expect(Array.isArray(overdue)).toBe(true);

    const now = Date.now();
    for (const loan of overdue) {
      expect(loan.status).toBe("active");
      const due = new Date(loan.dueDate).getTime();
      expect(due).toBeLessThan(now);
    }
  });

  // TC-G7-022
  test("TC-G7-022 overdue report excludes returned loans", async ({ request }) => {
    const member = await createMember(request);
    const book = await createBook(request, { totalCopies: 1 });
    const loan = await createLoan(request, book.id, member.id);
    await returnLoan(request, loan.id);

    const res = await request.get("/api/reports/loans/overdue");
    expect(res.status()).toBe(200);
    const overdue = await res.json();
    const ids = overdue.map((l) => l.id);
    expect(ids).not.toContain(loan.id);
  });
});
