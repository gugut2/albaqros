# Albaqros 🦅

> **A sleek, minimalist desktop companion for day-to-day task execution, habit recurrence, and reflective journaling.**

[![Release](https://img.shields.io/github/v/release/gugut2/albaqros?color=6366f1&label=Download%20Installer)](https://github.com/gugut2/albaqros/releases/latest)
[![Windows](https://img.shields.io/badge/Platform-Windows%20x64-0078D6?logo=windows&logoColor=white)](https://github.com/gugut2/albaqros/releases/latest)

📥 **[Download Latest Installer (Albaqros Setup v1.1.0)](https://github.com/gugut2/albaqros/releases/download/v1.1.0/Albaqros.Setup.1.1.0.exe)**

Albaqros is a local-first desktop productivity application built with **Electron**, **React**, **Vite**, and **TypeScript**. It balances deep-focus daily execution with high-level milestone progress, historical reflection, and visual analytics in a tailored dark-mode interface.

---

## ✨ Key Features

### 1. 🪟 Dual-Mode Desktop Architecture
- **Compact Companion Widget (`420 × 680px`)**:
  - Frameless, unobtrusive floating widget designed to live beside your code editor, browser, or terminal.
  - Features an **Always-on-Top (Pin)** toggle and custom window dragging.
  - Fast daily checklist, instant energy filters, today's top focus, and embedded freeform journaling.
- **Maximized Studio Workspace (`1200 × 800px`)**:
  - Deep-focus productivity center with dedicated tabs:
    - **Today's Agenda**: Side-by-side view with checklist on the left and full-length journal on the right.
    - **Major Projects & Goals**: Macro-milestone tracker with live progress bars.
    - **Analytics & Graphs**: Consistency matrices and velocity charts.
    - **Past Days Archive**: Historical calendar browser with retroactive editing and deletion.
    - **Recurring Chores**: Cadence rules manager.

---

### 2. 🎯 Major Projects, Creative Evolution & Project Files Hub
- **Macro-to-Micro Alignment**: Create high-level projects (e.g., *“Learn Concept Art”*, *“3D Character Modeling”*, *“Produce EP Album”*, *“Apartment Renovation”*) and link individual daily study/practice tasks directly to them.
- **Dynamic Real-Time Progress**:
  $$\text{Progress \%} = \text{round}\left(\frac{\text{Completed Associated Tasks}}{\text{Total Associated Tasks}} \times 100\right)$$
  Progress bars and percentage counters update instantly upon checking off daily tasks.
- **Creative Deliverable Cadence**:
  - Configure a milestone frequency: e.g. *“Create a milestone project every 7 days”*.
  - Live cadence tracker displays days since last submission, countdowns (`Next piece due in 3 days`), and overdue alerts.
- **Multi-Media Deliverables & File Tracking**:
  - **Concept Art & Images**: Chronological thumbnail gallery, hover zoom, and full-screen high-res Lightbox.
  - **3D Projects** (`.blend`, `.obj`, `.fbx`, `.gltf`): Poly-cube badges, render covers, and 1-click **"Open in Blender / 3D App"** and **"Show in Explorer"** buttons.
  - **Music & Audio / SFX** (`.wav`, `.mp3`, `.ogg`, `.flac`): Built-in custom dark-mode audio player with play/pause, timestamps, scrubber, and DAW launcher.
  - **Creative Project Files** (`.psd`, `.clip`, `.als`, `.flp`, `.zip`): Local file path linking and 1-click launch.
  - **Self-Critique & Reflections**: Capture techniques learned, challenges faced, and self-critiques on every piece.
- **Side-by-Side Evolution Comparison**:
  - Select any two milestone pieces (e.g. *Piece #1 Day 1 Study* vs *Piece #6 Day 35 Finished Art*) to inspect before-and-after visual progression and celebrate your tangible creative growth over time.

---

### 3. ⚡ Smart Execution & Stale Task Rescue
- **North Star (#1 Priority)**: Pin your most critical task of the day with a prominent golden accent bar.
- **Energy Intensity Tagging**:
  - `⚡ High Focus`: Cognitively demanding tasks or intense work.
  - `☕ Light Chore`: Quick wins, routine admin, and low-friction chores.
- **Subtasks & Interactive Checklists**:
  - Add subtask steps during task creation or directly on any active task card on the fly.
  - Expandable nested checklist with mini checkboxes, strikethrough text, and quick `+ Add subtask` input.
  - Visual completion badge (e.g. `2/3 subtasks (67%)`) and micro progress bar.
  - Seamless auto-completion: completing all subtasks automatically completes the parent task with confetti! Toggling the parent checkbox synchronously completes or reopens all nested subtasks.
- **"X Days Missed" Rollover & Stale Task Rescue**:
  - Uncompleted tasks carry forward with a subtle `Missed Xd` warning badge.
  - 1-click rescue modal provides healthy escape routes:
    1. **Break it down**: Automatically splits an intimidating task into 2–3 bite-sized micro-steps.
    2. **Defer to Weekend**: Reschedules to Saturday to clear today's cognitive load.
    3. **Archive Guilt-Free**: Drop stalled chores cleanly without cluttering future days.

---

### 4. 🔄 Flexible Recurrence Engine
- **On/Off Cyclical Patterns**: Configure routines like *"Active for 3 days, skip 1 day"* (ideal for workout splits, shift rotations, or intermittent fasting) with live cycle phase indicators (`Active: Day 2 of 3`).
- **Flexible Cadence Options**:
  - Every Day (Daily)
  - Weekdays Only (Monday – Friday)
  - Weekends Only (Saturday & Sunday)
  - Custom Days of the Week (e.g., Mon / Wed / Fri)
  - Interval-based (Every $N$ days)
  - Monthly (e.g., 1st or 15th of each month)
- Tasks surface automatically only when due, keeping daily lists clean.

---

### 5. ⚖️ Daily Tracked Properties & Recurring Meds / Reminders Hub
- **Daily Tracked Properties (Metrics)**:
  - Track quantitative and qualitative metrics per day such as **Weight** (`kg`), **Investments** (`$`), or create custom properties on demand (e.g., Water, Sleep, Mood).
  - Automatic real-time trend delta indicators comparing against the most recently logged date (e.g., `-0.3 kg`, `+$250`, `neutral`).
  - Seamless auto-save directly tied to each day's record in `DayEntry.properties`.
- **Recurring Medication & Routine Reminders Engine**:
  - **No Rollover Penalty**: Designed specifically for routine check-ins, medication adherence, and habits that shouldn't skew task completion rates or generate "missed task" rollover baggage.
  - **Flexible Recurrence Engine**: Configure medications and reminders to surface **Daily**, on **Specific Days of the Week** (e.g. *Every Saturday*), at **Intervals** (every $N$ days), or in **On/Off Cycles**.
  - **One-Click Adherence**: Fast toggle between `[ Pending ]` and `[ ✓ Taken ]` with celebratory feedback, saved per date in `DayEntry.remindersCompleted`.
  - **Unified Dual-Mode Access**: Available in the Compact Companion's expandable *"Daily Routine, Meds & Metrics"* drawer, directly on Today's Agenda in Maximized Studio, and retroactively reviewable in the Past Days Archive.

---

### 6. ✍️ Reflective Journaling & Smart Lists
- **Intelligent Auto-Bullets**: Pressing `Enter` on a bullet line automatically starts the next bullet point (`• `). Pressing `Enter` on an empty bullet cleanly exits the list.
- **One-Click List Converter**: Convert raw notes into structured bullet points with the `Format as List` toolbar action.
- **Daily Energy Rating**: Log your daily energy on a 1–5 scale to correlate mood and capacity with task completion over time.

---

### 7. 📊 Visual Analytics & Consistency Matrix
- **Trend Velocity**: Recharts area graph tracking completion rates over 7, 14, or 30 days.
- **Streak Tracker**: Tracks your continuous consistency streak.
- **Life Facet Consistency**: Track progress across custom themes (`#work`, `#health`, `#chores`, `#personal`, or your own custom tags).
- **Energy Distribution**: Visual donut chart balancing high-focus deep work vs light maintenance chores.

---

### 8. 📁 Albaqros Vault & Cloud Drive Auto-Sync (Google Drive / OneDrive)
- **User-Defined Vault Folder**:
  - Name your vault whatever you wish (e.g. `MyVault`, `LifeOS`, `AlbaqrosVault`) and place it anywhere on your filesystem, including inside **Google Drive**, **OneDrive**, **Dropbox**, or local disk.
  - Select an existing vault folder or create a new vault directly from Albaqros with 1 click.
  - When creating or choosing a vault, Albaqros automatically saves your data into `albaqros-data.json`, writes `vault.json` metadata, and creates an `artifacts/` folder for creative milestone files.
- **Permanent Vault Persistence**:
  - Remembers your active vault permanently in desktop configuration (`albaqros-config.json`), instantly mounting your chosen vault whenever the app boots.
- **Automatic Cloud Drive Sync & Hot-Reloading**:
  - Built-in file watcher monitors your active vault. When Google Drive, OneDrive, or Dropbox syncs changes from another computer, Albaqros automatically hot-reloads data in the background without losing focus.
  - Local save debounce prevents feedback loops from your own writes.
- **Unified TitleBar & Vault Manager**:
  - Quick-glance clickable vault pill directly in the TitleBar (`📁 MyVault • 🟢 Synced`).
  - Dedicated Vault Management Modal with cloud provider auto-detection (`☁️ OneDrive`, `☁️ Google Drive`, `☁️ Dropbox`, `💻 Local`), "Open in Explorer", "Sync Now", and a recent vaults switcher.

---

## 🛠️ Technology Stack

- **Desktop Framework**: Electron (frameless window geometry, IPC bridge, system tray, window management)
- **Frontend Engine**: React 19, TypeScript
- **Bundler & Tooling**: Vite 5
- **Visuals & Charts**: Recharts, Canvas Confetti, Lucide React icons
- **Aesthetic**: Custom dark-mode design system with glassmorphic cards and tailored HSL color palettes

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn`

### Installation
```bash
# Clone the repository
git clone https://github.com/gugut95/albaqros.git

# Navigate into project directory
cd albaqros

# Install dependencies
npm install
```

### Running Locally

```bash
# Run in Electron desktop mode (Vite dev server + Electron window)
npm run dev

# Run Vite dev server only (Browser preview)
npm run dev:vite

# Run production build validation
npm run build
```

---

## ⌨️ Shortcuts & Controls

| Action | Control |
| :--- | :--- |
| **Toggle Compact / Studio** | Maximize / Minimize button on title bar |
| **Keep Window Always on Top** | Pin icon on title bar |
| **Drag Window** | Custom draggable top title bar |
| **New Bullet Point** | Press `Enter` on any bulleted line |
| **Exit Bullet List** | Press `Enter` on an empty bullet line |
| **Stale Task Rescue** | Click any dashed `Missed Xd` badge |
| **Mark Task Complete** | Click checkbox (subtle confetti celebration) |

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
