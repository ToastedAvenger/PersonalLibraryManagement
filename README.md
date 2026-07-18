# My Library — a self-hosted book catalog for Islamic & religious sciences libraries

A small web app you run on your own PC to catalog a personal or institutional
library. It's purpose-built around **libraries of Islamic books / religious
sciences**: the default Genre list (Tafsīr, Ḥadīth, Fiqh, Uṣūl al-Fiqh,
ʿAqīdah, Sīrah, Tārīkh, Tāsawwuf, etc.), the default Publisher list (mostly
Arabic/Urdu publishing houses), the Language list (Arabic, Persian, Urdu),
and the Hijri date shown alongside the Gregorian date all reflect that. Every
one of those lists is fully editable (see [section 8](#8-customizing-the-dropdown-lists-genre-publisher-language-etc)),
so it can just as easily be repurposed for a general-purpose library.

It stores everything in a local database and folder on that PC — **no
internet connection is required to use it, and the app never fetches book
info or cover images from the internet**; you enter every detail and upload
cover photos yourself. Anyone on your home WiFi (or a private network you
set up, e.g. a VPN like Tailscale) can open it from their own phone or
laptop's browser.

- Shows both the **Gregorian and Hijri (Islamic) date** at the top of the page.
- **Cover images are uploaded by you and saved locally** (never fetched from
  the internet), so they still show up even with no internet connection.
- Cover photos are automatically **compressed with mozJPEG** on save — a
  multi-MB photo straight off a phone camera typically shrinks to well
  under 200 KB with no visible quality loss (covers are only ever shown as
  small thumbnails in the app).
- Only the **book title** is required — every other field is optional.
- You can scan a folder of PDFs and it will automatically attach the right
  PDF to the right catalog entry.
- **Export/import your whole catalog as CSV or Excel** (the Excel version
  embeds the actual cover images) — handy for backups or bulk edits in a
  spreadsheet.
- **Every filter supports selecting multiple values at once** (e.g. Tafsīr
  *and* Ḥadīth together), plus one-click **Select mode** for bulk-deleting
  or bulk-moving a group of books to a new shelf.

## Table of contents

1. [First-time setup](#1-first-time-setup)
2. [Using it from other devices (phone, laptop) over WiFi](#2-using-it-from-other-devices-phone-laptop-over-wifi)
3. [Adding books](#3-adding-books)
4. [Finding books: search, filters, and bulk actions](#4-finding-books-search-filters-and-bulk-actions)
5. [Attaching PDFs automatically](#5-attaching-pdfs-automatically)
6. [Backing up / bulk-editing via CSV or Excel export-import](#6-backing-up--bulk-editing-via-csv-or-excel-export-import)
7. [Where everything is stored](#7-where-everything-is-stored)
8. [Customizing the dropdown lists (Genre, Publisher, Language, etc.)](#8-customizing-the-dropdown-lists-genre-publisher-language-etc)
9. [Starting automatically on boot (running in the background)](#9-starting-automatically-on-boot-running-in-the-background)

## 1. First-time setup

### On Linux Mint / Ubuntu
1. Copy the whole `library_app` folder onto your PC.
2. Open a terminal inside that folder.
3. Run:
   ```bash
   chmod +x run.sh
   ./run.sh
   ```
   The first run will create a virtual environment, install the needed
   packages, and **compile mozJPEG from source** (the tool used to compress
   cover photos) — this last step can take a minute or two and may ask for
   your password to install build tools (`cmake`, `nasm`, `build-essential`)
   if they aren't already on your system. It only happens once.

### On Windows
1. Copy the whole `library_app` folder onto your PC.
2. Double-click `run.bat`.
   The first run will set things up automatically (make sure Python was
   installed with the "Add Python to PATH" option checked) and download
   **mozJPEG** (the tool used to compress cover photos) — a one-time ~3 MB
   download.

Either way, once it says `Starting My Library at http://localhost:5000`,
open that address in your browser on the same PC.

## 2. Using it from other devices (phone, laptop) over WiFi

1. Make sure the other device is on the **same WiFi network** as the PC
   running the app.
2. Find the PC's local IP address:
   - Linux: the run script prints it for you, or run `hostname -I`
   - Windows: open Command Prompt and run `ipconfig`, look for "IPv4 Address"
     (something like `192.168.1.42`)
3. On the other device, open a browser and go to:
   `http://192.168.1.42:5000` (using the actual address you found)

If it doesn't connect, your PC's firewall may be blocking the port. On
Windows, allow "Python" or port 5000 through Windows Defender Firewall
when prompted the first time. On Linux (ufw), you can run:
```bash
sudo ufw allow 5000
```

**Keep the terminal window / command prompt open** while others are using
it — closing it stops the app. Leave the PC on and the app running
whenever you want it reachable. (See [section 9](#9-starting-automatically-on-boot-running-in-the-background)
if you'd rather it start automatically and run in the background instead.)

## 3. Adding books

Tap **+ Add Book**. Only the title is required.

- **Upload image**: pick a photo from your device instead (e.g. a photo
  you took of the actual cover).
- Adding a second edition of a book you already own: just add a new entry
  with the same title — it'll automatically group under the same card as
  "N editions".
- **A multi-volume set split across publishers or shelves** (e.g. you have
  volumes 1–7 of a 16-volume set from one publisher and the rest from
  another): don't put the full volume count (16) on both entries — that
  double-counts it in your stats. Instead, add the second entry, check
  **"Part of an existing set already in the library"**, and pick the first
  entry from the search box that appears. Enter each entry's own volume
  count (e.g. 7, then 9) rather than the set's total; the app adds them up
  for you and shows one merged card with a combined total and an
  expandable breakdown of each source's publisher/shelf. Unchecking that
  box later splits the entry back out on its own.

## 4. Finding books: search, filters, and bulk actions

### Search and filters

- The **search box** matches title or author, and tolerates typos and
  missing diacritics (e.g. searching `bukhari` finds `al-Bukhārī`).
- The basic **Genre** and **Shelf** filters, plus **Advanced Filters**
  (Language, Publisher, Shelf Position, Shelf Side, and **Original or
  Translation**), are all checkbox dropdowns — click one to open it, then
  check as many values as you like. A book matches a field once *any*
  checked value in that field matches it; checking values in more than one
  field narrows the results to books matching all of those fields at once.
  Leaving a filter with nothing checked means "don't filter on this field"
  (same as the old "All" option).
- **Reset Filters** clears the search box, every filter, and the sort order
  back to their defaults in one click.

### Selecting multiple books for bulk actions

Click **Select** in the toolbar to enter select mode — a checkbox appears
on every book, and on each individual source inside an expanded "N sources"
breakdown (see [multi-volume sets](#3-adding-books) above), so you can move
or delete just one source of a set without touching the others.

- A bar at the bottom shows how many books are selected, with buttons for
  **Select all visible** (adds every book matching your current
  search/filters to the selection) and **Clear selection**.
- Your selection is remembered even if you change the search or filters
  afterward — so you can select a few books, change filters to find more,
  and keep adding to the same selection before acting on all of them.
- **Delete** removes every selected book after one confirmation (PDF files
  on disk are never touched, same as deleting one book at a time).
- **Change shelf location…** opens a small form with Shelf Location, Shelf
  Position, and Shelf Side fields — fill in only the ones you want to
  change, leave the rest blank/"— don't change —", and only those fields
  are applied to every selected book.

Click **Done Selecting** to leave select mode.

## 5. Attaching PDFs automatically

If you have PDF copies of some books:

1. Name each PDF file exactly like this:
   ```
   book name - author - publisher - year.pdf
   ```
   Only the book name part is required — you can leave off author,
   publisher, or year if you don't want to type them, e.g. just
   `Sahih al-Bukhari.pdf` also works.
2. Put your PDFs anywhere inside one folder (subfolders are fine too —
   the scan looks through all of them).
3. Click **📁 Scan PDFs**, enter that folder's path once (it's remembered
   afterward), and click **Scan Now**.

What happens during a scan:
- A PDF whose name matches an existing catalog entry gets linked to it —
  you'll then see a **📄 View PDF** button on that book's card.
- If a catalog entry **already has** a PDF linked, it's left alone (skipped)
  so a scan never overwrites an existing link. If the same PDF filename
  could match more than one edition (e.g. two editions of the same title),
  the author/publisher/year in the filename are used to pick the right one.
- A PDF that doesn't match any entry is simply skipped and left alone —
  add the matching catalog entry first, then scan again.

You can re-run the scan any time you add new PDFs — it only processes new,
unlinked files.

## 6. Backing up / bulk-editing via CSV or Excel export-import

The toolbar has four buttons for moving your whole catalog in and out of a
spreadsheet:

- **Export CSV** — downloads every book as a plain-text CSV file. Fast, but
  it does **not** include cover images.
- **Export Excel (with covers)** — downloads an `.xlsx` workbook with the
  same data, plus each book's actual cover picture embedded in the row.
  This is the more complete option if you want a real backup or want to
  browse the catalog visually in Excel/LibreOffice/Google Sheets.
- **Import CSV** / **Import Excel** — reads a previously exported (and
  possibly edited) file back in.

How import decides "update an existing book" vs. "add a new one": every
exported row has an `id` column.
- **Leave `id` as-is** on a row you exported and want to edit (e.g. fix a
  typo, change the shelf) → re-importing it **updates** that same book,
  including its cover if you're importing an Excel file with a new picture
  in that row.
- **Clear the `id` cell (or leave it blank)** on a new row you add yourself
  → it's created as a **brand-new book** on import.
- A row with no title is skipped.

This makes the export/import round-trip useful both as a backup mechanism
and as a way to bulk-edit many books at once in spreadsheet software instead
of one at a time in the app.

## 7. Where everything is stored

Inside the `library_app` folder:
- `data/library.db` — the book catalog (SQLite database)
- `data/covers/` — uploaded cover images (already compressed)
- `data/config.json` — remembers your PDF folder path
- `tools/mozjpeg/` — the mozJPEG compressor, downloaded/built on first run;
  safe to delete (it'll just be fetched again next run), but until it's
  back, new cover photos are saved uncompressed instead of failing outright

Your actual PDF files are **not moved or copied** — the app only remembers
their path, so keep them wherever you already have them.

**Back up the `data` folder** occasionally (e.g. copy it to a USB drive, or
use the Export Excel button from [section 6](#6-backing-up--bulk-editing-via-csv-or-excel-export-import))
to protect your catalog. If you ever move the PDFs to a different folder
path, update the path in the Scan PDFs panel and scan again.

## 8. Customizing the dropdown lists (Genre, Publisher, Language, etc.)

The Add/Edit Book form has five dropdown fields: **Genre**, **Publisher**,
**Language**, **Original or Translation**, and **Condition**. All five are
defined in a single file: `options.py`, in the same folder as `app.py`.
That's the *only* file you need to edit to add, rename, or remove an option
— nothing else in the app needs to change.

Open `options.py` in any text editor. Each field looks like this:

```python
"language": {
    "allowOther": True,
    "options": [
        {"value": "Arabic", "label": "Arabic"},
        {"value": "Persian", "label": "Persian"},
        {"value": "Urdu", "label": "Urdu"},
    ],
},
```

- **`value`** is what actually gets saved in the database once a book uses
  it. Once you've used a value for some books, it's best to leave it alone
  — you can still reword its `label`, but changing `value` itself won't
  update books that already used the old one.
- **`label`** is just the text shown in the dropdown. Safe to reword
  anytime.
- **`allowOther`**: if `True`, the dropdown also gets an "Other…" choice
  with a free-text box, for values you didn't bother adding to the list.
  Genre, Publisher, and Language have this; Translation status and
  Condition don't (and shouldn't, unless you want to add it).

**Example — adding a new language, "Turkish":**

```python
"options": [
    {"value": "Arabic", "label": "Arabic"},
    {"value": "Persian", "label": "Persian"},
    {"value": "Urdu", "label": "Urdu"},
    {"value": "Turkish", "label": "Turkish"},   # ← new line
],
```

Save the file, then restart the app (stop it with Ctrl+C and run
`run.bat`/`run.sh` again) — the new option will appear in the dropdown.

**If you remove a value that's already used by some books:** their saved
text is not touched or lost. For Genre/Publisher/Language, that book will
just show up under "Other…" with its original text still there. For
Translation status/Condition (no "Other…" fallback), that book's dropdown
will show blank until you open it and pick a value again.

## 9. Starting automatically on boot (running in the background)

By default you have to open a terminal/command prompt and run
`run.sh`/`run.bat` every time, and keep that window open. If you'd rather
have the app just start on its own whenever the PC turns on, and keep
running in the background with no window to babysit, set up one of the two
options below for your OS.

Both approaches run `app.py` directly with the venv's Python (skipping the
`run.sh`/`run.bat` first-time setup logic), so **run `run.sh`/`run.bat` by
hand at least once first** to create the `venv` folder and install Flask.

### Windows — using Task Scheduler

1. Press `Win`, type **Task Scheduler**, open it.
2. Click **Create Task…** (not "Create Basic Task") in the right-hand panel.
3. **General** tab:
   - Name: `My Library`
   - Select **Run whether user is logged on or not**
   - Check **Run with highest privileges** is not required — leave unchecked
4. **Triggers** tab → **New…** → Begin the task: **At startup** → OK.
5. **Actions** tab → **New…**:
   - Action: **Start a program**
   - Program/script: the full path to `pythonw.exe` inside the venv, e.g.
     ```
     C:\path\to\library_app\venv\Scripts\pythonw.exe
     ```
     (`pythonw.exe`, not `python.exe`, so no console window pops up)
   - Add arguments: `app.py`
   - Start in: the full path to the `library_app` folder, e.g.
     ```
     C:\path\to\library_app
     ```
   - Click OK.
6. **Conditions** tab: uncheck **Start the task only if the computer is on
   AC power** (important for laptops, so it still starts on battery).
7. Click OK, enter your Windows password if prompted.

The app will now start silently in the background every time the PC boots
(no need to log in first, if you chose "Run whether user is logged on or
not"). To test it immediately without rebooting, find "My Library" in the
Task Scheduler Library list, right-click → **Run**, then open
`http://localhost:5000` in your browser.

**To stop it:** open Task Manager → Details tab → find `pythonw.exe` → End
task. **To stop it from auto-starting:** open Task Scheduler, find "My
Library", right-click → Disable (or Delete).

### Linux Mint / Ubuntu — using systemd

1. Open a terminal and create a service file:
   ```bash
   sudo nano /etc/systemd/system/my-library.service
   ```
2. Paste this in, replacing `YOUR_USERNAME` and the paths with your actual
   username and the actual full path to the `library_app` folder (find it
   with `pwd` while inside that folder):
   ```ini
   [Unit]
   Description=My Library book catalog app
   After=network.target

   [Service]
   Type=simple
   User=YOUR_USERNAME
   WorkingDirectory=/home/YOUR_USERNAME/path/to/library_app
   ExecStart=/home/YOUR_USERNAME/path/to/library_app/venv/bin/python app.py
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
3. Save and exit (in nano: `Ctrl+O`, Enter, `Ctrl+X`).
4. Enable and start it:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable my-library.service
   sudo systemctl start my-library.service
   ```
5. Check it's running:
   ```bash
   sudo systemctl status my-library.service
   ```
   You should see `active (running)`. Open `http://localhost:5000` to
   confirm.

It will now start automatically on every boot, even before anyone logs in,
and `Restart=on-failure` means systemd restarts it if it ever crashes.

Useful commands:
- Stop it: `sudo systemctl stop my-library.service`
- Disable auto-start: `sudo systemctl disable my-library.service`
- View logs: `journalctl -u my-library.service -f`
