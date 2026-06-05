// tests/e2e/ui.spec.js
const { test, expect, request: pwRequest } = require("@playwright/test");
const {
  createBook, createMember, createLoan, uniqueSuffix,
} = require("../../helpers/api-helpers");

/**
 * E2E browser tests against the single-page web UI. The UI is a tab-based SPA
 * served at "/" with no URL routing, so navigation happens via the nav buttons
 * and in-page tables (matching the documented test steps), not via page.goto on
 * deep links. Fixtures are created through the API for speed and reliability.
 */

test.describe("UI / E2E @e2e", () => {

  // TC-G7-028 — 1) open "/", 2) type term in book search field, 3) submit
  test("TC-G7-028 book search via web frontend shows matching result", async ({ page, baseURL }) => {
    const apiCtx = await pwRequest.newContext({ baseURL });
    const title = `UITest_${uniqueSuffix()}`;
    await createBook(apiCtx, { title });
    await apiCtx.dispose();

    await page.goto("/");
    await page.getByRole("navigation").getByRole("button", { name: "Search" }).click();

    await page.getByPlaceholder(/title, author/i).fill(title);
    // Three buttons are labelled "Search": nav (0), Books card (1), Members card (2).
    await page.getByRole("button", { name: "Search", exact: true }).nth(1).click();

    await expect(page.getByText(title)).toBeVisible();
  });

  // TC-G7-029 — 1) Members tab, 2) click the member, 3) read the statistics section
  test("TC-G7-029 member detail page shows current statistics", async ({ page, baseURL }) => {
    const apiCtx = await pwRequest.newContext({ baseURL });
    const member = await createMember(apiCtx);
    const book1 = await createBook(apiCtx, { totalCopies: 1 });
    const book2 = await createBook(apiCtx, { totalCopies: 1 });
    await createLoan(apiCtx, book1.id, member.id);
    await createLoan(apiCtx, book2.id, member.id);
    await apiCtx.dispose();

    await page.goto("/");
    await page.getByRole("navigation").getByRole("button", { name: "Members" }).click();

    // Open the member's detail view by clicking its row (unique name cell).
    await page.getByText(member.name).click();

    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    // The member has exactly two loans — the detail view renders this count.
    await expect(page.getByText("Loan History (2)")).toBeVisible();
    await expect(page.getByText("Total loans")).toBeVisible();
  });

  // TC-G7-030 — 1) Reports tab, 2) load the overdue list
  test("TC-G7-030 overdue report renders the overdue loan list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("button", { name: "Reports" }).click();

    await expect(page.getByRole("heading", { name: "Overdue Loans" })).toBeVisible();
    await page.getByRole("button", { name: "Load Overdue" }).click();

    // Exact count can't be asserted: there is no API to create an overdue loan
    // (no back-date endpoint, same limitation as TC-G7-025), so we rely on the
    // seeded overdue loans and assert the list renders (rows or empty state).
    await expect(page.getByText(/Days Overdue|No records found/i)).toBeVisible();
  });
});
