# Albaqros 🦅

> **A sleek, minimalist desktop companion for day-to-day task execution, habit recurrence, and reflective journaling.**

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

### 2. 🎯 Major Projects & Milestones
- **Macro-to-Micro Alignment**: Create high-level projects (e.g., *“Launch v1 MVP”*, *“Half-Marathon Training”*, *“Apartment Renovation”*) and link individual daily tasks directly to them.
- **Dynamic Real-Time Progress**:
  $$\text{Progress \%} = \text{round}\left(\frac{\text{Completed Associated Tasks}}{\text{Total Associated Tasks}} \times 100\right)$$
  Progress bars and percentage counters update instantly upon checking off daily tasks.
- **Milestone Cards**: Expand any major goal to inspect all linked tasks across past and upcoming dates, with 1-click inline task addition.
- **Linked Task Badges**: Connected tasks display an interactive `🎯 [Goal Name] (XX%)` badge across both compact and studio views.

---

### 3. ⚡ Smart Execution & Stale Task Rescue
- **North Star (#1 Priority)**: Pin your most critical task of the day with a prominent golden accent bar.
- **Energy Intensity Tagging**:
  - `⚡ High Focus`: Cognitively demanding tasks or intense work.
  - `☕ Light Chore`: Quick wins, routine admin, and low-friction chores.
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

### 5. ✍️ Reflective Journaling & Smart Lists
- **Intelligent Auto-Bullets**: Pressing `Enter` on a bullet line automatically starts the next bullet point (`• `). Pressing `Enter` on an empty bullet cleanly exits the list.
- **One-Click List Converter**: Convert raw notes into structured bullet points with the `Format as List` toolbar action.
- **Daily Energy Rating**: Log your daily energy on a 1–5 scale to correlate mood and capacity with task completion over time.

---

### 6. 📊 Visual Analytics & Consistency Matrix
- **Trend Velocity**: Recharts area graph tracking completion rates over 7, 14, or 30 days.
- **Streak Tracker**: Tracks your continuous consistency streak.
- **Life Facet Consistency**: Track progress across custom themes (`#work`, `#health`, `#chores`, `#personal`, or your own custom tags).
- **Energy Distribution**: Visual donut chart balancing high-focus deep work vs light maintenance chores.

---

### 7. ☁️ Local-First & Cloud Folder Sync
- **Atomic JSON Storage**: All entries, tasks, and settings are saved locally in `productivity-data.json`.
- **Zero Lock-In & Cloud Compatible**: Point your storage directory to **Google Drive**, **OneDrive**, **Dropbox**, or any local folder via the Settings modal.
- **Live File Watcher**: Automatically detects changes if the file is updated on another machine, hot-reloading state without loss of focus.
- **Windows Auto-Launch**: Toggle launch on system startup with a single click.

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
