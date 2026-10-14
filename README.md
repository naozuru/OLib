# School Library Website (v2)

A library website for a school, in English, with two sides:

- **Student side:** search the catalog, see which books are available, reserve a book that is on loan, and check your own loans, due dates and reservations with your Student ID (NIS).
- **Admin side:** manage books and students, record loans and returns, handle reservations, run the year-end class promotion, and see reports and statistics.

The frontend is plain HTML, CSS and JavaScript (no build step) hosted on **GitHub Pages**. The backend is **Google Apps Script** and the database is a **Google Spreadsheet**.

```
Browser (GitHub Pages)  ->  Apps Script Web App (JSON API)  ->  Google Spreadsheet
```

## What is new in v2

| Feature | Where |
|---|---|
| Whole website in English | everywhere |
| **Import books from CSV** (skip or merge duplicates) | Admin > Books > Import CSV |
| **Year-end class promotion** and **graduated archive** | Admin > Year-end promotion, Students > Graduated archive |
| **Reports and statistics** (charts, CSV export, print/PDF) | Admin > Reports |
| **History per student and per book** | History button in Books, Students and Loans |
| **Book reservations** (queue, hold for pickup, expiry) | Book page (students), Admin > Reservations |

## Folder structure

```
school-library/
├── index.html              Student catalog
├── book.html               Book details + reserve
├── status.html             My loans and reservations (by Student ID)
├── admin/
│   ├── login.html          Admin sign in
│   ├── index.html          Dashboard
│   ├── books.html          Manage books, CSV import, book history
│   ├── members.html        Manage students, CSV import, archive, student history
│   ├── promotion.html      Year-end promotion
│   ├── loans.html          Loans, returns, extensions, overdue list
│   ├── reservations.html   Reservation queue
│   ├── reports.html        Reports and statistics
│   └── settings.html       Rules and password
├── assets/
│   ├── css/  style.css, admin.css
│   └── js/   config.js, api.js, ui.js, admin.js
├── apps-script/Code.gs     Backend (copy into Apps Script)
├── templates/              CSV templates for books and students
└── README.md
```

## Step 1: Set up the backend (Spreadsheet + Apps Script)

1. Create a new **Google Spreadsheet** (any name, e.g. "Library Database").
2. Open **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste the whole of `apps-script/Code.gs`. Save.
4. Open **Project Settings** (gear icon) and set the **Time zone** to `(GMT+07:00) Asia/Jakarta`.
5. Choose the **`setup`** function in the top dropdown, click **Run**, and authorize access when asked.
   It creates the sheets `Books`, `Members`, `Loans`, `Reservations`, `Settings` and `Admins`, fills in the default rules and creates the admin account.
6. (Optional) Run **`seedSampleData`** for 5 demo books and 3 demo students. Delete them from the sheets when you no longer need them.
7. (Optional) Run **`installDailyTrigger`** once. It sweeps expired reservations every night, so held copies return to the shelf even on quiet days.

### Deploy as a Web App

1. Click **Deploy > New deployment**.
2. Click the gear icon and choose **Web app**.
3. Set **Execute as:** `Me` and **Who has access:** `Anyone`.
4. Click **Deploy** and copy the **Web app URL** (it looks like `https://script.google.com/macros/s/.../exec`).

> Every time you change `Code.gs`, publish it with **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. The URL stays the same.

### Upgrading from v1

Your data is kept. Paste the new `Code.gs` over the old one, run **`setup`** again (it only adds the new `status` and `lulus_tahun` columns on `Members`, the new `Reservations` sheet and two new settings), then publish a **new version** of your existing deployment. Existing students count as active. Replace the frontend files with the new ones.

## Step 2: Connect the frontend

Edit `assets/js/config.js`:

```js
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  SCHOOL_NAME: 'Your School Name',
  LIB_NAME: 'Library'
};
```

To try it on your computer, open `index.html` in a browser or use the Live Server extension in VS Code.

## Step 3: Publish on GitHub Pages

1. Create a new GitHub repository (for example `school-library`).
2. Upload everything in this folder to it.
3. Go to **Settings > Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After a minute or two the site is live at `https://USERNAME.github.io/school-library/`. The admin sign-in is at `.../admin/login.html`.

## First sign in

- Username: `admin`
- Password: `admin123`

**Change the password right away** in **Settings > Change password**.

## How to use the new features

### Import books from CSV
**Books > Import CSV.** Download the template (also in `templates/`), fill it in, and upload it.
- Columns: `title, author, category, publisher, year, isbn, copies, cover_url, description`. Only `title` is required; `copies` defaults to 1.
- Comma or semicolon separated. Dutch/Indonesian column names (`judul`, `penulis`, ...) also work.
- A book "already exists" when the ISBN matches, or the title and author match. Choose **Skip** (keep the current record) or **Add the copies** to the existing book.
- Up to 2000 rows per file. A report lists any rows that could not be imported and why.

### Year-end promotion and graduate archive
**Year-end promotion** shows every class with a suggested action:
- Classes such as `X-A`, `IX-B`, `7C` move up one grade (`XI-A`, `X-B`, `8C`). Grade 12 is suggested to **graduate**.
- The level (JHS/SHS) is suggested by grade: 7 to 9 is JHS, 10 to 12 is SHS. **Review every row**, you can change the action, the new class name and the level.
- Press **Review and apply**. Everyone is moved once, from their original class, so chains like `X-A -> XI-A` and `XI-A -> XII-A` work correctly in one go.
- Graduated students move to **Students > Graduated archive**. Their history is kept, their reservations are cancelled, and they cannot borrow or reserve. You can **Restore** a student at any time.
- Students who still have borrowed books are **not** archived. They are listed so you can record the returns and run the promotion again.
- Tip: make a copy of the spreadsheet (File > Make a copy) before the promotion if you want a backup.
- You can also archive a single student from the Students page.

### Reservations
- When **every copy** of a book is on loan, the book page shows a **Reserve this book** form. Students enter their Student ID.
- When a copy is returned, the first student in the queue gets it automatically: the copy is **held** (it is not shown as available to others) for a number of days.
- **Admin > Reservations** has three tabs: *Ready for pickup* (use **Lend now** when the student comes), *Waiting in queue*, and *History*.
- If a student does not pick it up in time, the reservation **expires** and the copy goes to the next student, or back to the shelf.
- A loan cannot be extended while other students have reserved the same book.
- Settings: maximum active reservations per student (0 switches reservations off) and the number of hold days.
- Students can see and cancel their reservations on **My loans**.

### History per student and per book
Click the **History** icon in the Books and Students tables, or click a student name or book title in the Loans table. You get totals, late returns, the average number of days a book is kept, every loan, and every reservation.

### Reports and statistics
**Reports** has period presets (last 30 days, this month, last 3 months, this year, custom range):
- loans, returns, on-time return rate, average days kept, students who borrowed, titles borrowed, titles never borrowed, overdue right now, reservations made and picked up
- loans per month (last 12 months), most borrowed books, most active readers, loans by category, by class and by level
- **Export loans (CSV)** for the selected period, and **Print / Save as PDF** (the sidebar and buttons are hidden when printing)

## Default rules

All can be changed in **Settings**:

| Rule | Default |
|---|---|
| Loan length | 7 days |
| Maximum books per student | 3 |
| Maximum extensions | 1 |
| Days added per extension | 7 |
| "Due soon" marker | 2 days before |
| Fine per late day | Rp 0 (off) |
| Maximum active reservations per student | 2 |
| Days a reserved copy is held | 3 |

## Daily workflow

1. **Once at the start:** import students and books (CSV), or add them one by one.
2. **When a student borrows:** **Loans > Record a loan**, type the Student ID or name and the title.
3. **When a book comes back:** **Loans > Borrowed > Return.**
4. **Reserved book is back:** the student shows up under **Reservations > Ready for pickup**, use **Lend now**.
5. **Overdue:** **Loans > Overdue.** **Copy list** copies the list as text to paste into a chat.
6. **End of the school year:** **Year-end promotion.**

### Student CSV format

```csv
nis,name,class,level
2024001,Aisyah Putri,X-A,SHS
2024002,Budi Santoso,IX-B,JHS
```

Format the Student ID column as **Text** in Excel so leading zeros are kept. Students whose ID already exists are skipped.

## Security

- Passwords are stored as salted hashes. A session token lasts 6 hours. Sign in is locked for 5 minutes after 5 failed attempts.
- Every action that changes admin data needs the admin token.
- The catalog is public. **My loans** shows only a student's name, class, borrowed books and reservations for a given Student ID. Students can reserve and cancel their own reservations with their Student ID; they cannot see anyone else's data.
- Do not share edit access to the Spreadsheet with students.
- This is suitable for a school, but it is not an enterprise-grade security model.

## Notes when editing the Spreadsheet by hand

- Do not rename, move or delete the **header row** or reorder columns.
- Dates in the `Loans` and `Reservations` sheets are text in the form `yyyy-MM-dd` (for example `2026-10-21`).
- Never change the `id` columns, they link books, students, loans and reservations.
- `stok_tersedia` is the number of copies free to borrow **right now**. It already excludes copies held for reservations, so do not edit it by hand. Change the number of copies from the admin page instead.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| "The Web App URL is not set" | `API_URL` in `config.js` still has the placeholder text. |
| "The server did not respond correctly" | The deployment is not set to **Anyone**, or the URL is wrong. Deploy again with access **Anyone**; the URL ends with `/exec`. |
| Changes to `Code.gs` have no effect | Publish a **New version** in Manage deployments (see the note above). |
| Sign in always fails | Make sure `setup()` was run. To reset the admin: clear the data rows of the `Admins` sheet (keep the header), run `setup()` again, then sign in with `admin` / `admin123`. |
| "Too many failed attempts" | Wait 5 minutes and try again. |
| Days left or overdue is off by one | The time zone of the Spreadsheet and the Apps Script project must both be Asia/Jakarta. |
| Icons are missing | Icons load from Iconify over the internet. Check the connection and that `code.iconify.design` is not blocked. |
| The first page load is slow | Apps Script sometimes needs 1 to 3 seconds to wake up. That is normal. |
| "Session expired" | The token is older than 6 hours or the script was redeployed. Sign in again. |

## Limits

- Google Apps Script has daily quotas. A single school stays far below them.
- Two admins saving at the same moment are handled one after the other (locking), so data does not collide.
- One spreadsheet is comfortable for a few thousand books and students. Much larger collections will be slower.

## Technical note

Sheet column names and some API field names (`judul`, `penulis`, `nis`, `kelas`, ...) are kept from v1 so existing spreadsheets keep working. All text the user sees is English.

---

Copyright by NaoZuru (Mr. Rayhan)
