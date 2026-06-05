// tests/api/search.spec.js
const { test, expect } = require("@playwright/test");
const {
  createBook, createMember, createLoan, uniqueSuffix,
} = require("../../helpers/api-helpers");

test.describe("Search Books @api", () => {

  // TC-G7-007
  test("TC-G7-007 search books by title (partial match)", async ({ request }) => {
    const suffix = uniqueSuffix();
    const title = `TestNovel_${suffix}`;
    await createBook(request, { title });

    const res = await request.get(`/api/search/books?q=${encodeURIComponent(title)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.some((b) => b.title === title)).toBe(true);
  });

  // TC-G7-008
  test("TC-G7-008 search books by author", async ({ request }) => {
    const suffix = uniqueSuffix();
    const author = `Author_${suffix}`;
    await createBook(request, { author });

    const res = await request.get(`/api/search/books?q=${encodeURIComponent(author)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.some((b) => b.author === author)).toBe(true);
  });

  // TC-G7-009
  test("TC-G7-009 search books by ISBN", async ({ request }) => {
    const book = await createBook(request);
    const isbn = book.isbn;

    const res = await request.get(`/api/search/books?q=${encodeURIComponent(isbn)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.some((b) => b.isbn === isbn)).toBe(true);
  });

  // TC-G7-010
  test("TC-G7-010 search books by genre", async ({ request }) => {
    const suffix = uniqueSuffix();
    const genre = `SciFi_${suffix}`;
    await createBook(request, { genre });

    const res = await request.get(`/api/search/books?genre=${encodeURIComponent(genre)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.some((b) => b.genre === genre)).toBe(true);
  });

  // TC-G7-011
  test("TC-G7-011 search books with available=true filters out fully borrowed books", async ({ request }) => {
    const suffix = uniqueSuffix();
    const title = `AvailFilter_${suffix}`;
    const lent = await createBook(request, { title: `${title}_lent`, totalCopies: 1 });
    const free = await createBook(request, { title: `${title}_free`, totalCopies: 1 });
    const member = await createMember(request);
    await createLoan(request, lent.id, member.id); // makes lent.availableCopies = 0

    const res = await request.get(`/api/search/books?q=${encodeURIComponent(title)}&available=true`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const titles = body.results.map((b) => b.title);
    expect(titles).toContain(`${title}_free`);
    expect(titles).not.toContain(`${title}_lent`);
  });

  // TC-G7-012
  test("TC-G7-012 search with no matches returns HTTP 200 and empty array (not 404)", async ({ request }) => {
    const res = await request.get("/api/search/books?q=ZZZZZ_no_match_expected_xyz");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(0);
  });
});

test.describe("Search Members @api", () => {

  // TC-G7-013
  test("TC-G7-013 search members by name", async ({ request }) => {
    const suffix = uniqueSuffix();
    const name = `TestName_${suffix}`;
    await createMember(request, { name });

    const res = await request.get(`/api/search/members?q=${encodeURIComponent(name)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((m) => m.name === name)).toBe(true);
  });

  // TC-G7-014
  test("TC-G7-014 search members by email", async ({ request }) => {
    const member = await createMember(request);
    const res = await request.get(`/api/search/members?q=${encodeURIComponent(member.email)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((m) => m.email === member.email)).toBe(true);
  });
});
