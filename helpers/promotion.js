// helpers/promotion.js
/**
 * Pure helper functions modeling the Waitlist Promotion logic of Domain 7.
 * These functions are unit-tested in isolation (tests/unit/helpers.test.js).
 *
 * They mirror the business rules so the test suite has a verifiable
 * reference implementation, independent of the SUT internals.
 */

/**
 * Sort reservations by createdAt ascending (oldest first, FIFO).
 * @param {Array<{id: any, createdAt: string|number, status: string}>} reservations
 */
function sortReservationsByCreatedAt(reservations) {
  return [...reservations].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

/**
 * Return the first promotable reservation in FIFO order.
 * Skips cancelled and already-ready reservations.
 * @returns the matched reservation or null if none is promotable.
 */
function firstPromotable(reservations) {
  const sorted = sortReservationsByCreatedAt(reservations);
  for (const r of sorted) {
    if (r.status === "pending") return r;
  }
  return null;
}

module.exports = { sortReservationsByCreatedAt, firstPromotable };
