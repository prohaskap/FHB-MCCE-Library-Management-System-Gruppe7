const path = require('path');
const fs   = require('fs');

// Wipe existing DB so seed is idempotent
const DB_PATH = path.join(__dirname, 'library.db');
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const { initDb, db, persist } = require('./src/db');
const { dueDate, calculateFee } = require('./src/fees');

// ── raw data ─────────────────────────────────────────────────────────────────

const BOOKS = [
  { isbn: '9780140328721', title: 'Watership Down',                  author: 'Richard Adams',          genre: 'Fiction',        year: 1972, copies: 4 },
  { isbn: '9780743273565', title: 'The Great Gatsby',                author: 'F. Scott Fitzgerald',    genre: 'Classic',        year: 1925, copies: 5 },
  { isbn: '9780061120084', title: 'To Kill a Mockingbird',           author: 'Harper Lee',             genre: 'Classic',        year: 1960, copies: 4 },
  { isbn: '9780451524935', title: '1984',                            author: 'George Orwell',          genre: 'Dystopia',       year: 1949, copies: 6 },
  { isbn: '9780316769174', title: 'The Catcher in the Rye',          author: 'J.D. Salinger',          genre: 'Classic',        year: 1951, copies: 3 },
  { isbn: '9780062316097', title: 'The Alchemist',                   author: 'Paulo Coelho',           genre: 'Fiction',        year: 1988, copies: 4 },
  { isbn: '9780385333481', title: 'The Handmaid\'s Tale',            author: 'Margaret Atwood',        genre: 'Dystopia',       year: 1985, copies: 3 },
  { isbn: '9780007458424', title: 'The Hobbit',                      author: 'J.R.R. Tolkien',         genre: 'Fantasy',        year: 1937, copies: 5 },
  { isbn: '9780618640157', title: 'The Lord of the Rings',           author: 'J.R.R. Tolkien',         genre: 'Fantasy',        year: 1954, copies: 4 },
  { isbn: '9780439708180', title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling',   genre: 'Fantasy',        year: 1997, copies: 6 },
  { isbn: '9780439064873', title: 'Harry Potter and the Chamber of Secrets', author: 'J.K. Rowling',  genre: 'Fantasy',        year: 1998, copies: 5 },
  { isbn: '9780439136365', title: 'Harry Potter and the Prisoner of Azkaban', author: 'J.K. Rowling', genre: 'Fantasy',        year: 1999, copies: 5 },
  { isbn: '9780743477109', title: 'Brave New World',                 author: 'Aldous Huxley',          genre: 'Dystopia',       year: 1932, copies: 3 },
  { isbn: '9780316346627', title: 'Fahrenheit 451',                  author: 'Ray Bradbury',           genre: 'Dystopia',       year: 1953, copies: 3 },
  { isbn: '9780140449136', title: 'Crime and Punishment',            author: 'Fyodor Dostoevsky',      genre: 'Classic',        year: 1866, copies: 2 },
  { isbn: '9780141439518', title: 'Pride and Prejudice',             author: 'Jane Austen',            genre: 'Classic',        year: 1813, copies: 4 },
  { isbn: '9780141441146', title: 'Sense and Sensibility',           author: 'Jane Austen',            genre: 'Classic',        year: 1811, copies: 2 },
  { isbn: '9780385737951', title: 'The Hunger Games',                author: 'Suzanne Collins',        genre: 'Dystopia',       year: 2008, copies: 5 },
  { isbn: '9780439023481', title: 'Catching Fire',                   author: 'Suzanne Collins',        genre: 'Dystopia',       year: 2009, copies: 4 },
  { isbn: '9780345803481', title: 'Mockingjay',                      author: 'Suzanne Collins',        genre: 'Dystopia',       year: 2010, copies: 4 },
  { isbn: '9780743477543', title: 'Animal Farm',                     author: 'George Orwell',          genre: 'Satire',         year: 1945, copies: 4 },
  { isbn: '9780060935467', title: 'To Kill a Mockingbird (Special)', author: 'Harper Lee',             genre: 'Classic',        year: 2002, copies: 2 },
  { isbn: '9780735224292', title: 'Little Fires Everywhere',         author: 'Celeste Ng',             genre: 'Fiction',        year: 2017, copies: 3 },
  { isbn: '9781501156700', title: 'It Ends with Us',                 author: 'Colleen Hoover',         genre: 'Romance',        year: 2016, copies: 4 },
  { isbn: '9780525559474', title: 'The Midnight Library',            author: 'Matt Haig',              genre: 'Fiction',        year: 2020, copies: 5 },
  { isbn: '9780385542370', title: 'Where the Crawdads Sing',         author: 'Delia Owens',            genre: 'Mystery',        year: 2018, copies: 5 },
  { isbn: '9780525536291', title: 'The Silent Patient',              author: 'Alex Michaelides',       genre: 'Thriller',       year: 2019, copies: 4 },
  { isbn: '9780525559498', title: 'The Guest List',                  author: 'Lucy Foley',             genre: 'Thriller',       year: 2020, copies: 3 },
  { isbn: '9780735219090', title: 'The Woman in the Window',         author: 'A.J. Finn',              genre: 'Thriller',       year: 2018, copies: 3 },
  { isbn: '9781250301697', title: 'The Institute',                   author: 'Stephen King',           genre: 'Horror',         year: 2019, copies: 3 },
  { isbn: '9780385543026', title: 'Billy Summers',                   author: 'Stephen King',           genre: 'Thriller',       year: 2021, copies: 3 },
  { isbn: '9780385542425', title: 'The Shining',                     author: 'Stephen King',           genre: 'Horror',         year: 1977, copies: 3 },
  { isbn: '9780062409850', title: 'Go Set a Watchman',               author: 'Harper Lee',             genre: 'Classic',        year: 2015, copies: 2 },
  { isbn: '9780062457714', title: 'Educated',                        author: 'Tara Westover',          genre: 'Biography',      year: 2018, copies: 4 },
  { isbn: '9780525559368', title: 'Becoming',                        author: 'Michelle Obama',         genre: 'Biography',      year: 2018, copies: 5 },
  { isbn: '9780735224933', title: 'The Tattooist of Auschwitz',      author: 'Heather Morris',         genre: 'Historical',     year: 2018, copies: 4 },
  { isbn: '9780316346628', title: 'All the Light We Cannot See',     author: 'Anthony Doerr',          genre: 'Historical',     year: 2014, copies: 4 },
  { isbn: '9780062409874', title: 'The Nightingale',                 author: 'Kristin Hannah',         genre: 'Historical',     year: 2015, copies: 4 },
  { isbn: '9780735224964', title: 'The Pillars of the Earth',        author: 'Ken Follett',            genre: 'Historical',     year: 1989, copies: 3 },
  { isbn: '9780385737968', title: 'Divergent',                       author: 'Veronica Roth',          genre: 'Dystopia',       year: 2011, copies: 4 },
  { isbn: '9780062024039', title: 'Insurgent',                       author: 'Veronica Roth',          genre: 'Dystopia',       year: 2012, copies: 3 },
  { isbn: '9780062024077', title: 'Allegiant',                       author: 'Veronica Roth',          genre: 'Dystopia',       year: 2013, copies: 3 },
  { isbn: '9780525478812', title: 'The Fault in Our Stars',          author: 'John Green',             genre: 'Romance',        year: 2012, copies: 5 },
  { isbn: '9780525559382', title: 'Turtles All the Way Down',        author: 'John Green',             genre: 'Fiction',        year: 2017, copies: 3 },
  { isbn: '9780307474278', title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson',          genre: 'Thriller',       year: 2005, copies: 4 },
  { isbn: '9780307474292', title: 'The Girl Who Played with Fire',   author: 'Stieg Larsson',          genre: 'Thriller',       year: 2006, copies: 3 },
  { isbn: '9780307474308', title: 'The Girl Who Kicked the Hornet\'s Nest', author: 'Stieg Larsson',  genre: 'Thriller',       year: 2007, copies: 3 },
  { isbn: '9780316346629', title: 'Gone Girl',                       author: 'Gillian Flynn',          genre: 'Thriller',       year: 2012, copies: 4 },
  { isbn: '9780385542388', title: 'Sharp Objects',                   author: 'Gillian Flynn',          genre: 'Thriller',       year: 2006, copies: 3 },
  { isbn: '9780385542394', title: 'Dark Places',                     author: 'Gillian Flynn',          genre: 'Thriller',       year: 2009, copies: 3 },
  { isbn: '9780525559361', title: 'A Little Life',                   author: 'Hanya Yanagihara',       genre: 'Fiction',        year: 2015, copies: 2 },
  { isbn: '9780062409867', title: 'The Kite Runner',                 author: 'Khaled Hosseini',        genre: 'Fiction',        year: 2003, copies: 4 },
  { isbn: '9781594489501', title: 'A Thousand Splendid Suns',        author: 'Khaled Hosseini',        genre: 'Fiction',        year: 2007, copies: 3 },
  { isbn: '9780385737943', title: 'The Maze Runner',                 author: 'James Dashner',          genre: 'Dystopia',       year: 2009, copies: 4 },
  { isbn: '9780385737950', title: 'The Scorch Trials',               author: 'James Dashner',          genre: 'Dystopia',       year: 2010, copies: 3 },
  { isbn: '9780385737967', title: 'The Death Cure',                  author: 'James Dashner',          genre: 'Dystopia',       year: 2011, copies: 3 },
  { isbn: '9780316346626', title: 'Normal People',                   author: 'Sally Rooney',           genre: 'Romance',        year: 2018, copies: 4 },
  { isbn: '9780525559377', title: 'Conversations with Friends',      author: 'Sally Rooney',           genre: 'Fiction',        year: 2017, copies: 3 },
  { isbn: '9780735224957', title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', genre: 'Fiction',        year: 2017, copies: 5 },
  { isbn: '9780525559490', title: 'Daisy Jones and the Six',         author: 'Taylor Jenkins Reid',    genre: 'Fiction',        year: 2019, copies: 4 },
  { isbn: '9780062409881', title: 'Malibu Rising',                   author: 'Taylor Jenkins Reid',    genre: 'Fiction',        year: 2021, copies: 3 },
];

const FIRST_NAMES = [
  'Alice','Bob','Clara','David','Elena','Frank','Grace','Hugo','Iris','Jonas',
  'Klara','Leon','Maria','Niklas','Olivia','Peter','Quinn','Rosa','Stefan','Tina',
  'Ulrich','Vera','Walter','Xena','Yusuf','Zara','Andreas','Birgit','Christian','Diana',
  'Erika','Felix','Gerda','Hans','Ingrid','Johann','Katharina','Ludwig','Monika','Norbert',
  'Oskar','Paula','Rainer','Sabine','Thomas','Ursula','Viktor','Wilhelmine','Xavier','Yvonne',
  'Zoe','Aaron','Bella','Carlos','Dina',
];

const LAST_NAMES = [
  'Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
  'Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann',
  'Braun','Krüger','Hofmann','Hartmann','Lange','Schmitt','Werner','Schmitz','Krause','Meier',
  'Lehmann','Schmid','Schulze','Maier','Köhler','Herrmann','König','Walter','Mayer','Huber',
  'Kaiser','Fuchs','Peters','Lang','Scholz','Möller','Weiß','Jung','Hahn','Schubert',
  'Vogel','Friedrich','Keller','Günther','Frank',
];

// ── helpers ───────────────────────────────────────────────────────────────────

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function run(sql) { db.prepare(sql).run(); }

function insert(table, obj) {
  const keys = Object.keys(obj);
  const vals = Object.values(obj);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(...vals).lastInsertRowid;
}

function query(sql, ...params) { return db.prepare(sql).all(...params); }
function get(sql, ...params)   { return db.prepare(sql).get(...params); }

// ── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  await initDb();
  console.log('Seeding database…');

  // ── Books ──
  const bookIds = [];
  for (const b of BOOKS) {
    const id = insert('books', {
      isbn: b.isbn, title: b.title, author: b.author, genre: b.genre,
      year: b.year, totalCopies: b.copies, availableCopies: b.copies
    });
    bookIds.push(id);
  }
  console.log(`  ${bookIds.length} books`);

  // ── Members ──
  const memberIds = [];
  for (let i = 0; i < FIRST_NAMES.length; i++) {
    const name  = `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`;
    const email = `${FIRST_NAMES[i].toLowerCase()}.${LAST_NAMES[i].toLowerCase().replace(/[äöü]/g, c => ({ä:'ae',ö:'oe',ü:'ue'}[c]||c))}@example.com`;
    const status = i >= 50 ? 'inactive' : 'active'; // last few are inactive
    const num = `M${String(i + 1).padStart(4, '0')}`;
    const id = insert('members', { name, email, memberNumber: num, status });
    memberIds.push(id);
  }
  console.log(`  ${memberIds.length} members`);

  // ── Loans — mix of: returned on time, returned late, still active, overdue active ──
  const loanIds = [];

  // 20 returned on time (various books, various members)
  for (let i = 0; i < 20; i++) {
    const bookId   = bookIds[i % bookIds.length];
    const memberId = memberIds[i];
    const borrow   = dateOffset(-(20 + i));
    const due      = dateOffset(-(6 + i));       // due 6–26 days ago, returned before due
    const ret      = dateOffset(-(7 + i));       // returned 1 day before due
    const fee      = 0;
    const id = insert('loans', { bookId, memberId, borrowDate: borrow, dueDate: due, returnDate: ret, status: 'returned', fee });
    loanIds.push(id);
  }

  // 15 returned late (fees apply)
  for (let i = 0; i < 15; i++) {
    const bookId   = bookIds[(i + 5) % bookIds.length];
    const memberId = memberIds[20 + i];
    const daysLate = i + 1;                      // 1–15 days late
    const borrow   = dateOffset(-(30 + i));
    const due      = dateOffset(-(16 + i));
    const ret      = dateOffset(-(16 + i - daysLate)); // returned daysLate after due
    const fee      = Math.min(parseFloat((daysLate * 0.50).toFixed(2)), 20);
    const id = insert('loans', { bookId, memberId, borrowDate: borrow, dueDate: due, returnDate: ret, status: 'returned', fee });
    loanIds.push(id);
    // Restore available copy (was borrowed and returned)
    run(`UPDATE books SET availableCopies = availableCopies + 1 WHERE id = ${bookId}`);
  }

  // 10 active loans not yet overdue
  const activeLoanBookIds = [];
  for (let i = 0; i < 10; i++) {
    const bookId   = bookIds[(i + 10) % bookIds.length];
    const memberId = memberIds[35 + i];
    const borrow   = dateOffset(-5);
    const due      = dateOffset(9);               // due in 9 days
    const id = insert('loans', { bookId, memberId, borrowDate: borrow, dueDate: due, status: 'active', fee: 0 });
    loanIds.push(id);
    activeLoanBookIds.push(bookId);
    run(`UPDATE books SET availableCopies = MAX(0, availableCopies - 1) WHERE id = ${bookId}`);
  }

  // 10 active loans that are overdue (good for overdue report testing)
  for (let i = 0; i < 10; i++) {
    const bookId   = bookIds[(i + 20) % bookIds.length];
    const memberId = memberIds[i];                // reuse early members (they already returned their first loan)
    const daysOverdue = i + 2;                   // 2–11 days overdue
    const borrow   = dateOffset(-(14 + daysOverdue));
    const due      = dateOffset(-daysOverdue);
    const id = insert('loans', { bookId, memberId, borrowDate: borrow, dueDate: due, status: 'active', fee: 0 });
    loanIds.push(id);
    activeLoanBookIds.push(bookId);
    run(`UPDATE books SET availableCopies = MAX(0, availableCopies - 1) WHERE id = ${bookId}`);
  }

  console.log(`  ${loanIds.length} loans (20 returned on time, 15 returned late, 10 active, 10 overdue)`);

  // ── Reservations ──
  // Reserve books that have 0 available copies, or are popular
  // First drive some books to 0 available by force-borrowing
  const reservationBookIds = bookIds.slice(30, 40); // books 31-40 will be fully borrowed out
  for (const bid of reservationBookIds) {
    const book = get(`SELECT * FROM books WHERE id = ${bid}`);
    // set available to 0
    run(`UPDATE books SET availableCopies = 0 WHERE id = ${bid}`);
  }

  let reservationCount = 0;
  for (let i = 0; i < 55; i++) {
    const bookId   = reservationBookIds[i % reservationBookIds.length];
    const memberId = memberIds[(i + 3) % memberIds.length];

    // check member doesn't already have active reservation for this book
    const existing = get(`SELECT id FROM reservations WHERE bookId=${bookId} AND memberId=${memberId} AND status IN ('pending','ready')`);
    if (existing) continue;

    // check member active reservation count < 3
    const cnt = get(`SELECT COUNT(*) as n FROM reservations WHERE memberId=${memberId} AND status IN ('pending','ready')`);
    if (cnt.n >= 3) continue;

    const status = (i % 8 === 0) ? 'ready'
                 : (i % 12 === 0) ? 'cancelled'
                 : 'pending';
    insert('reservations', { bookId, memberId, status });
    reservationCount++;
  }

  // Add a few more to top up to 50+
  for (let i = 0; reservationCount < 52; i++) {
    const bookId   = reservationBookIds[i % reservationBookIds.length];
    const memberId = memberIds[(i + 25) % memberIds.length];
    const existing = get(`SELECT id FROM reservations WHERE bookId=${bookId} AND memberId=${memberId} AND status IN ('pending','ready')`);
    if (existing) continue;
    const cnt = get(`SELECT COUNT(*) as n FROM reservations WHERE memberId=${memberId} AND status IN ('pending','ready')`);
    if (cnt.n >= 3) continue;
    insert('reservations', { bookId, memberId, status: 'pending' });
    reservationCount++;
  }

  console.log(`  ${reservationCount} reservations`);

  persist();

  // ── summary ──
  const counts = {
    books:        get('SELECT COUNT(*) as n FROM books').n,
    members:      get('SELECT COUNT(*) as n FROM members').n,
    loans:        get('SELECT COUNT(*) as n FROM loans').n,
    reservations: get('SELECT COUNT(*) as n FROM reservations').n,
  };
  console.log('\nDone. Final counts:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}

seed().catch(err => { console.error(err); process.exit(1); });
