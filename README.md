# HR Database

A desktop HR employee management application built with Electron, React, TypeScript, and SQLite. Designed to replace spreadsheet-based employee tracking with a full-featured, offline-first desktop app.

## Download

Grab the latest installer from the [Releases](https://github.com/ccowan93/hr-database/releases) page:

- **Windows** &mdash; `HR-Database-Setup-x.x.x.exe`
- **Mac (Apple Silicon)** &mdash; `HR-Database-x.x.x-arm64.dmg` (signed and notarized)

> Windows may show a SmartScreen warning since the app isn't code-signed with an EV certificate. Click "More info" > "Run anyway" to proceed.

The app checks for updates automatically and can download and install them in-app.

## Features

### Employee Management
- Full CRUD for 22+ employee fields (personal info, employment, compensation, transfers)
- Archive/restore employees instead of permanent deletion
- Pay history tracking with automatic entries on compensation changes
- Employee notes system
- Photo/avatar upload per employee
- File attachments with automatic OCR text extraction for images

### Dashboard
- 21 customizable, drag-and-drop widgets
- Demographic breakdowns (sex, race, education, age distribution)
- Compensation analytics (pay by department, pay equity, pay growth)
- Operational metrics (turnover, retention, headcount growth, supervisor ratios)
- Interactive world map showing employee countries of origin
- Birthday and anniversary alerts
- Backup warning banner when auto-backup is not configured
- Export dashboard to PDF

### Time Tracking
- Import attendance data from CompuTime101 XLS exports
- Monthly calendar view with color-coded attendance (present, absent, missing punch, time-off)
- Click any day to view punch detail (in/out times, hours, work codes)
- Department and employee filters
- Undo imports by batch

### Time-Off Management
- Create, approve, and deny time-off requests (vacation, sick, personal, bereavement, jury duty, FMLA)
- Time-off balances with annual allocations per employee
- Department overlap detection warns when multiple employees in the same department request the same days off
- Time-off entries displayed on the attendance calendar

### Attendance Reports
- Overtime summary by employee/department
- Absenteeism rates and trends
- Tardiness tracking with configurable thresholds
- Time-off usage vs. allocation

### Search & Filters
- Global search with autocomplete (`Cmd+K` / `Ctrl+K`)
- Filter by department, supervisory role, country, hire date range, pay range, age range
- Sortable columns throughout

### Bulk Operations
- Select multiple employees with checkboxes
- Bulk edit department, position, supervisory role, education, pay rate, or raise date
- All bulk changes tracked in audit log

### Report Builder
- Pick any combination of 23 columns
- Filter by department and status
- Group by department, sex, race, education, country, etc.
- Aggregation: count, average, sum, min, max on numeric fields
- Save and load named report configurations (stored in database)
- Export results to Excel

### Org Chart
- Tree view with collapsible departments and supervisor hierarchy
- Grid view (default) with compact employee cards
- Click any employee to navigate to their detail page

### Audit Log
- Automatic change tracking for all employee edits
- Tracks field name, old value, new value, timestamp, and source
- Sources: `manual`, `excel_update`, `bulk_edit`
- Per-employee and global audit log views with pagination

### Import & Export
- Import employees from Excel (.xlsx)
- Update existing employees from Excel (matched by name)
- Import attendance from CompuTime101 XLS exports
- Export filtered employee lists to Excel
- Export individual employee profiles to PDF
- Export dashboard to PDF

### Sidebar Navigation
- Collapsible sidebar with icon-only rail mode (persists across sessions)
- Expandable dropdown groups for Employees and Time Tracking
- Smooth slide animations for dropdowns and collapse transitions

### Auto-Updates
- In-app update detection with download progress bar
- One-click "Restart & Install" to apply updates
- Post-update release notes modal shown on first launch after updating
- Fallback manual download link if auto-update fails

### Local Authentication
- App password required on every launch (prompts to set one on first run after updating)
- Passwords stored as PBKDF2-SHA512 hashes with per-install salt (never in plaintext)
- Touch ID unlock on macOS via `systemPreferences.promptTouchID` (opt-in during setup)

### Other
- Dark mode with system-aware toggle
- Local auto-backup with configurable interval and retention
- OneDrive cloud backup integration
- macOS code signing and notarization
- Auto-calculating fields (age from DOB, years of service from hire date)
- Dropdown selects for non-unique fields (race, ethnicity, country, languages, education) with ability to add new values
- Multi-select for languages spoken

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 41 |
| Frontend | React 19, React Router 7, TypeScript 6 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Maps | react-simple-maps |
| Database | better-sqlite3 12 (SQLite with WAL mode) |
| Bundler | Vite 8 |
| Spreadsheets | ExcelJS (.xlsx), SheetJS (.xls) |
| OCR | Tesseract.js |
| Updates | electron-updater |
| Icons | Lucide React |
| Packaging | electron-builder |

## Project Structure

```
src/
  main/                     # Electron main process
    main.ts                 # Window creation, app lifecycle
    database.ts             # SQLite schema, queries, migrations
    ipc-handlers.ts         # IPC channel registrations
    import-xlsx.ts          # Excel import - new employees (ExcelJS)
    import-update-xlsx.ts   # Excel import - update existing (ExcelJS)
    import-attendance.ts    # CompuTime101 XLS attendance import (SheetJS)
    export-xlsx.ts          # Excel export (ExcelJS)
    export-pdf.ts           # PDF export via hidden BrowserWindow
    update-checker.ts       # Auto-update via electron-updater
    ocr.ts                  # Tesseract.js text extraction from images
    app-config.ts           # App settings persistence
    local-backup.ts         # Scheduled local database backups
    onedrive-backup.ts      # OneDrive cloud backup integration
  preload/
    preload.ts              # Context bridge (renderer <-> main)
  renderer/
    App.tsx                 # Routes
    api.ts                  # Window.electronAPI type declarations
    types/employee.ts       # TypeScript interfaces
    types/attendance.ts     # Attendance/time-off types
    components/             # Reusable UI components
      Sidebar.tsx           # Collapsible navigation with dropdown groups
      GlobalSearch.tsx      # Cmd+K search with autocomplete
      FilterBar.tsx         # Advanced filter panel
      EmployeeForm.tsx      # Create/edit form with combo selects
      UpdateBanner.tsx      # Auto-update banner with progress + release notes modal
      CalendarGrid.tsx      # Reusable month grid for attendance
      ChartCard.tsx         # Chart wrapper
      MetricCard.tsx        # Stat card
      WorldMap.tsx          # Interactive country map
    views/                  # Page components
      Dashboard.tsx         # Customizable widget dashboard
      EmployeeList.tsx      # Table with bulk edit + avatars
      EmployeeDetail.tsx    # Profile with photo, pay history, audit log, notes, files
      AddEmployee.tsx       # New employee form
      AttendanceCalendar.tsx  # Monthly attendance calendar
      TimeOffManager.tsx    # Time-off request management
      AttendanceReports.tsx # Overtime, absenteeism, tardiness reports
      AuditLog.tsx          # Global change history
      OrgChart.tsx          # Tree/grid org visualization
      ReportBuilder.tsx     # Custom report generator
      Settings.tsx          # Theme, backups, database reset
```

## Development

### Prerequisites
- Node.js 22+
- npm

### Setup
```bash
npm install
```

### Run in development
```bash
npm run dev     # Concurrent Vite dev server + Electron
```

Or separately:
```bash
npm run build    # Compile TypeScript + bundle renderer
npm start        # Launch Electron
```

### Build installers
```bash
npm run dist:win    # Windows (.exe)
npm run dist:mac    # macOS (.dmg)
npm run dist:linux  # Linux (.AppImage)
```

Build output goes to the `release/` directory.

### Releasing

1. Bump version in `package.json`
2. Commit and push
3. Tag and push: `git tag v1.x.x && git push origin v1.x.x`
4. CI builds Windows and macOS installers and creates a draft GitHub release with all assets attached (including `latest.yml` and `latest-mac.yml` for auto-updates)
5. Edit the draft release on GitHub, add release notes, and publish

## Data Storage

All data is stored locally on the user's machine:

- **Database**: `{userData}/hr-database.sqlite` (SQLite with WAL mode)
- **Photos**: `{userData}/employee-photos/`
- **File Attachments**: `{userData}/files/{employee_id}/`
- **OCR Text**: Saved as `.txt` alongside uploaded images
- **Backups**: Configurable local folder, optional OneDrive sync

On macOS, `userData` is `~/Library/Application Support/hr-database/`.
On Windows, it's `%APPDATA%/hr-database/`.

## License

Private repository. All rights reserved.
