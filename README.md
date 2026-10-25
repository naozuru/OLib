# School Library Website (v2)

A library website for a school, in English, with two sides:

- **Student and teacher side:** search the catalog, see which books are available, reserve a book that is on loan, and check your own loans, due dates and reservations with your ID number (NIS for students, NIP for teachers).
- **Admin side:** manage books and members (students and teachers), record loans and returns, handle reservations, run the year-end class promotion, and see reports and statistics.

The frontend is plain HTML, CSS and JavaScript (no build step) hosted on **GitHub Pages**. The backend is **Google Apps Script** and the database is a **Google Spreadsheet**.

```
Browser (GitHub Pages)  ->  Apps Script Web App (JSON API)  ->  Google Spreadsheet
```

## What is new in v2

| Feature | Where |
|---|---|
| Whole website in English | everywhere |
| **Teachers as members** (own loan limit and loan length, no fines) | Admin > Members |
| **Import books from CSV** (skip or merge duplicates) | Admin > Books > Import CSV |
| **Year-end class promotion** and **graduated archive** | Admin > Year-end promotion, Students > Graduated archive |
| **Reports and statistics** (charts, CSV export, print/PDF) | Admin > Reports |
| **History per student and per book** | History button in Books, Students and Loans |
| **Book reservations** (queue, hold for pickup, expiry) | Book page (students), Admin > Reservations |
| **Fill in book details from the ISBN** (also while importing CSV) | Admin > Books |
| **New arrivals** and **Most borrowed** shelves | Home page |
| **Reading stars**: reader of the month, class reading challenge, reading levels | `leaderboard.html`, Admin > Reading stars |
| **English / Indonesian switch** for students, and **dark mode** | Header buttons |
| **Logo slot** ready to use | `assets/img/`, `config.js` |

## Folder structure

```
school-library/
├── index.html              Student catalog
├── book.html               Book details + reserve
├── status.html             My loans, reading level and reservations (by ID number)
├── leaderboard.html       Reading stars (reader of the month, class challenge)
├── admin/
│   ├── login.html          Admin sign in
│   ├── index.html          Dashboard
│   ├── books.html          Manage books, CSV import, book history
│   ├── members.html        Manage students and teachers, CSV import, archive, history
│   ├── promotion.html      Year-end promotion
│   ├── loans.html          Loans, returns, extensions, overdue list
│   ├── reservations.html   Reservation queue
│   ├── reports.html        Reports and statistics
│   └── settings.html       Rules and password
├── assets/
│   ├── css/  style.css, admin.css
│   ├── js/   config.js, api.js, ui.js, admin.js, isbn.js, i18n.js, theme.js
│   └── img/  put your logo here (see README.md in that folder)
├── apps-script/Code.gs     Backend (copy into Apps Script)
├── templates/              CSV templates for books and members
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

Your data is kept. Paste the new `Code.gs` over the old one, run **`setup`** again (it only adds the new `status`, `lulus_tahun` and `tipe` columns on `Members`, the new `Reservations` sheet and the new settings), then publish a **new version** of your existing deployment. Existing members count as active students. The new `tgl_ditambahkan` column on `Books` stays empty for old books (so they are not tagged "New"). Replace the frontend files with the new ones.

## Step 2: Connect the frontend

Edit `assets/js/config.js`:

```js
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  SCHOOL_NAME: 'SMA S Tunas Mekar Indonesia',
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

The sign-in page belongs to SMA S Tunas Mekar Indonesia and greets librarians with an invitation to keep reading (a different one each visit). To change the school name or the invitations, edit `SCHOOL_NAME` in `assets/js/config.js` and the `MESSAGES` list at the bottom of `admin/login.html`.

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

### Teachers
Teachers are members too, so they can borrow, reserve and have a history just like students.
- Add them in **Members > Add member** and choose the type **Teacher**, or import them from CSV with `type` = `teacher`. A teacher has an **NIP** instead of an NIS and a **subject / position** instead of a class and level.
- Teachers have their own rules in **Settings**: maximum books per teacher (default 5) and default loan length (default 14 days). When you pick a teacher in **Loans > Record a loan**, the loan length switches automatically.
- Teachers are **never fined**, they are skipped by the year-end promotion, and they can be archived (for example when they leave the school) and restored.
- Teachers check their own loans on **My loans** with their NIP.
- Reports split loans by borrower type, and class and level charts only count students.

### Fill in book details from the ISBN
- In **Books > Add book**, type or scan the ISBN and press **Enter** (or **Fill from ISBN**). The title, author, publisher, year, category, description and cover are filled in from Google Books, with Open Library as a back-up. A USB barcode scanner works as it simply types the number and presses Enter.
- Only **empty** fields are filled, so nothing you typed is overwritten. Always check the result, because the databases are not perfect.
- **Import CSV** has the option **Fill missing details from the ISBN** (on by default). A file with just `isbn` and `copies` columns is enough; about one second per book.
- This needs an internet connection. If a book is not in either database you fill in the details by hand.

### New arrivals and most borrowed
- Books show a **New** tag for 30 days after they were added (change it in Settings). Books added before this version have no date, so they are not tagged.
- The home page has two shelves above the catalog: **New arrivals** and **Most borrowed lately** (the last 90 days, or all time while there is little data). They hide while someone is searching or filtering.

### Reading stars
A friendly leaderboard to encourage reading. A book counts as read when it is **returned**.
- **Reader of the month** (this month, last month or the school year), a top-10 list of students, a list of reading teachers, and the **class reading challenge**. Classes are ranked by books **per student**, so small classes have a fair chance, and a progress bar shows the monthly goal (default 2 books per student).
- **Reading levels** are earned by the total number of books ever returned: Page Turner (5), Bookworm (15), Reading Star (30), Library Legend (60). Students see their level and progress on **My loans**.
- **Privacy:** the public page is **off by default**. Switch it on in **Settings > Reading stars visible to students**. With **Shorten student names** on (default), the public page shows "Aisyah P." and never shows IDs. Admins can always open **Admin > Reading stars** to preview it with full names.

### Language and dark mode
- Students switch between **EN** and **ID** with the button in the header; the choice is remembered on that device. The student pages are fully translated (the admin area stays in English). Names, titles and other data you enter are shown as typed.
- The **moon/sun** button switches dark mode on every page, including the admin area. The first visit follows the device setting.
- To translate a new sentence, add it to `assets/js/i18n.js`.

### Your school logo
Put the file in `assets/img/` and set `LOGO_URL` in `assets/js/config.js` (details in `assets/img/README.md`). The logo then replaces the book icon in all headers and is used as the browser tab icon. Until then the book icon is shown.

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
| Maximum books per teacher | 5 |
| Default loan length for teachers | 14 days |
| Maximum extensions | 1 |
| Days added per extension | 7 |
| "Due soon" marker | 2 days before |
| Fine per late day (students only) | Rp 0 (off) |
| Maximum active reservations per member | 2 |
| "New" tag stays for | 30 days |
| Reading stars visible to students | No (off) |
| Shorten student names on Reading stars | Yes |
| Class challenge goal | 2 books per student per month |
| School year starts in | July |
| Days a reserved copy is held | 3 |

## Daily workflow

1. **Once at the start:** import students and books (CSV), or add them one by one.
2. **When someone borrows:** **Loans > Record a loan**, type the ID number or name and the title.
3. **When a book comes back:** **Loans > Borrowed > Return.**
4. **Reserved book is back:** the student shows up under **Reservations > Ready for pickup**, use **Lend now**.
5. **Overdue:** **Loans > Overdue.** **Copy list** copies the list as text to paste into a chat.
6. **End of the school year:** **Year-end promotion.**

### Member CSV format

```csv
nis,name,class,level,type
2024001,Aisyah Putri,X-A,SHS,student
2024002,Budi Santoso,IX-B,JHS,student
198001012005011001,Andi Pratama,Mathematics,,teacher
```

The `type` column is optional (default `student`). For teachers, put the NIP in `nis` and the subject in `class`. Format the ID column as **Text** in Excel so leading zeros are kept. People whose ID already exists are skipped.

## Security

- Passwords are stored as salted hashes. A session token lasts 6 hours. Sign in is locked for 5 minutes after 5 failed attempts.
- Every action that changes admin data needs the admin token.
- The **Reading stars** page is public only after you switch it on, shows shortened names by default, and never exposes IDs. Think about whether you want student names visible on a public website before switching it on.
- Book lookups by ISBN go from the admin's browser straight to Google Books and Open Library; no student data is sent.
- The catalog is public. **My loans** shows only a member's name, class or subject, borrowed books and reservations for a given ID number. Members can reserve and cancel their own reservations with their ID number; they cannot see anyone else's data.
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
| "No book was found for this ISBN" | The book is not in Google Books or Open Library. Fill in the details by hand. Check the ISBN digits as well. |
| ISBN lookup says it could not reach the databases | Check the internet connection. Some school networks block these sites. |
| The language button does nothing | Make sure `assets/js/i18n.js` is uploaded to GitHub together with the other files. |
| Icons are missing | Icons load from Iconify over the internet. Check the connection and that `code.iconify.design` is not blocked. |
| The first page load is slow | Apps Script sometimes needs 1 to 3 seconds to wake up. That is normal. |
| "Session expired" | The token is older than 6 hours or the script was redeployed. Sign in again. |

## Limits

- Google Apps Script has daily quotas. A single school stays far below them.
- Two admins saving at the same moment are handled one after the other (locking), so data does not collide.
- One spreadsheet is comfortable for a few thousand books and students. Much larger collections will be slower.

## Technical note

Sheet column names and some API field names (`judul`, `penulis`, `nis`, `kelas`, ...) are kept from v1 so existing spreadsheets keep working. All text the user sees is English (students can switch the student pages to Indonesian). In the `Members` sheet, the `tipe` column holds `Student` (or blank) or `Teacher`; for teachers the `kelas` column holds the subject or position.

---

Copyright by NaoZuru (Mr. Rayhan)
