# HR Database

A desktop HR employee management application built with Electron, React, TypeScript, and SQLite. Designed to replace spreadsheet-based employee tracking with a full-featured, offline-first desktop app.

## Download

Grab the latest installer from the [Releases](https://github.com/Morbis190/hr-database/releases) page:

- **Windows** &mdash; `HR Database Setup 1.0.0.exe`
- **Mac (Apple Silicon)** &mdash; `HR Database-1.0.0-arm64.dmg`

> Windows may show a SmartScreen warning since the app isn't code-signed with an EV certificate. Click "More info" > "Run anyway" to proceed.

## Features

### Employee Management
- Full CRUD for 22+ employee fields (personal info, employment, compensation, transfers)
- Archive/restore employees instead of permanent deletion
- Pay history tracking with automatic entries on compensation changes
- Employee notes system
- Photo/avatar upload per employee

### Dashboard
- 21 customizable, drag-and-drop widgets
- Demographic breakdowns (sex, race, education, age distribution)
- Compensation analytics (pay by department, pay equity, pay growth)
- Operational metrics (turnover, retention, headcount growth, supervisor ratios)
- Interactive world map showing employee countries of origin
- Birthday and anniversary alerts
- Export dashboard to PDF

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
- Save and load named report configurations
- Export results to Excel

### Org Chart
- Tree view with collapsible departments and supervisor hierarchy
- Grid view with compact employee cards
- Click any employee to navigate to their detail page

### Audit Log
- Automatic change tracking for all employee edits
- Tracks field name, old value, new value, timestamp, and source
- Sources: `manual`, `excel_update`, `bulk_edit`
- Per-employee and global audit log views with pagination

### Import & Export
- Import employees from Excel (.xlsx/.xls)
- Update existing employees from Excel (matched by name)
- Export filtered employee lists to Excel
- Export individual employee profiles to PDF
- Export dashboard to PDF

### Other
- Dark mode with system-aware toggle
- Database backup and restore
- Auto-calculating fields (age from DOB, years of service from hire date)
- Dropdown selects for non-unique fields (race, ethnicity, country, languages, education) with ability to add new values
- Multi-select for languages spoken

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 33 |
| Frontend | React 18, React Router 7, TypeScript |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Maps | react-simple-maps |
| Database | better-sqlite3 (SQLite with WAL mode) |
| Bundler | Vite 6 |
| Spreadsheets | SheetJS (xlsx) |
| Packaging | electron-builder |

## Project Structure

```
src/
  main/               # Electron main process
    main.ts            # Window creation, app lifecycle
    database.ts        # SQLite schema, queries, migrations
    ipc-handlers.ts    # IPC channel registrations
    import-xlsx.ts     # Excel import (new employees)
    import-update-xlsx.ts  # Excel import (update existing)
    export-xlsx.ts     # Excel export
    export-pdf.ts      # PDF export via hidden BrowserWindow
  preload/
    preload.ts         # Context bridge (renderer <-> main)
  renderer/
    App.tsx            # Routes
    api.ts             # Window.electronAPI type declarations
    types/employee.ts  # TypeScript interfaces
    components/        # Reusable UI components
      Sidebar.tsx      # Navigation + import buttons
      GlobalSearch.tsx  # Cmd+K search with autocomplete
      FilterBar.tsx    # Advanced filter panel
      EmployeeForm.tsx # Create/edit form with combo selects
      ChartCard.tsx    # Chart wrapper
      MetricCard.tsx   # Stat card
      WorldMap.tsx     # Interactive country map
    views/             # Page components
      Dashboard.tsx    # Customizable widget dashboard
      EmployeeList.tsx # Table with bulk edit + avatars
      EmployeeDetail.tsx # Profile with photo, pay history, audit log, notes
      AddEmployee.tsx  # New employee form
      AuditLog.tsx     # Global change history
      OrgChart.tsx     # Tree/grid org visualization
      ReportBuilder.tsx # Custom report generator
      Settings.tsx     # Theme toggle, reset, backup/restore
```

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
npm install
```

### Run in development
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

## Data Storage

All data is stored locally on the user's machine:

- **Database**: `{userData}/hr-database.sqlite` (SQLite with WAL mode)
- **Photos**: `{userData}/employee-photos/`

On macOS, `userData` is `~/Library/Application Support/hr-database/`.
On Windows, it's `%APPDATA%/hr-database/`.

## License

Private repository. All rights reserved.
