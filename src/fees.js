const DAILY_RATE = 0.50;
const MAX_FEE = 20.00;
const LOAN_DAYS = 14;

function daysBetween(from, to) {
  const msPerDay = 86400000;
  return Math.floor((new Date(to) - new Date(from)) / msPerDay);
}

function calculateFee(borrowDate, dueDate, returnDate) {
  const effectiveReturn = returnDate || new Date().toISOString().slice(0, 10);
  const daysLate = daysBetween(dueDate, effectiveReturn);
  if (daysLate <= 0) return 0;
  return Math.min(parseFloat((daysLate * DAILY_RATE).toFixed(2)), MAX_FEE);
}

function dueDate(borrowDate) {
  const d = new Date(borrowDate);
  d.setDate(d.getDate() + LOAN_DAYS);
  return d.toISOString().slice(0, 10);
}

module.exports = { calculateFee, dueDate, DAILY_RATE, MAX_FEE, LOAN_DAYS };
