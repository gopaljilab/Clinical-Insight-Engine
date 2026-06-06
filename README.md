<p align="center">
  <img src="./clinical_insight_banner.png" alt="Clinical Insight Engine Banner" width="100%" />
</p>

<div align="center">

# 🩺 Clinical Insight Engine

### Clinical Decision Support for Preventive Diabetes Risk Assessment

> *Interpretable ML + Modern React — built for clinicians and patients alike*

<p align="center">
  
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Express.js-4+-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/scikit--learn-1.8+-F7931E?style=flat-square&logo=scikitlearn&logoColor=white" alt="scikit-learn" />
  <img src="https://img.shields.io/badge/GSSoC-2026-orange?style=flat-square" alt="GSSoC" />
</p>

<p align="center">
  
  ![Stars](https://img.shields.io/github/stars/gopaljilab/Clinical-Insight-Engine?style=social)
  ![Forks](https://img.shields.io/github/forks/gopaljilab/Clinical-Insight-Engine?style=social)
  ![Issues](https://img.shields.io/github/issues/gopaljilab/Clinical-Insight-Engine?style=social)
  ![Contributors](https://img.shields.io/github/contributors/gopaljilab/Clinical-Insight-Engine?style=social)

</p>

</div>

<p align="center">
  A full-stack clinical decision support system that surfaces <strong>early diabetes risk signals</strong> from routine patient data.<br />
  Combines an <strong>interpretable ML model</strong> with a <strong>modern React frontend</strong>, presenting results tailored for both <strong>clinicians</strong> and <strong>patients</strong>.
</p>

> [!WARNING]
> **Medical Disclaimer** — This system is intended for **educational and research purposes only**. It does **not** provide medical diagnoses and should not be used as a substitute for professional medical advice.

---

## 📑 Table of Contents

- [Why Clinical Insight Engine?](#-why-clinical-insight-engine)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#1--clone--install)
  - [Database Setup](#3--database-setup)
  - [Python Environment](#4--python-environment)
  - [Prepare Dataset](#5--dataset-preparation)
  - [Run the App](#6--launch)
  - [Shutdown](#7--shutting-down)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [ML Pipeline](#-ml-pipeline)
- [Single-Patient Prediction](#-single-patient-prediction-cli)
- [Environment Variables](#-environment-variables)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Contributors](#-contributors)

---

## 💡 Why Clinical Insight Engine?

Diabetes affects over **500 million** adults worldwide, yet early risk signals are often buried in routine clinical data. Clinical Insight Engine bridges that gap:

| Problem | Our Approach |
|---|---|
| Risk models are opaque black boxes | **Interpretable** Logistic Regression with per-feature impact scores |
| Results are one-size-fits-all | **Dual-view** output — detailed for clinicians, simplified for patients |
| Predictions lack context | **Confidence-aware** assessments with actionable follow-up recommendations |
| Patient data sits in silos | **Longitudinal tracking** with full assessment history |

---

## ✨ Key Features

### 🧾 Risk Assessment Form
Collects clinically relevant inputs:

```
Age · Gender · Hypertension · Heart Disease · Smoking History · BMI · HbA1c · Blood Glucose
```

### 👥 Dual-View Results

<table>
<tr>
<td width="50%">

**🩻 Clinician View**
- Exact risk percentage (0–100%)
- Top contributing factors with impact scores
- Model confidence indicators
- Suggested clinical follow-up actions
- Interactive factor contribution charts

</td>
<td width="50%">

**🧑‍⚕️ Patient View**
- Simplified category: `LOW` / `MODERATE` / `HIGH`
- Plain-language explanation of risk drivers
- Personalized preventive lifestyle guidance

</td>
</tr>
</table>

### 🕒 Assessment History
- Stores assessments with full timestamps
- Enables longitudinal patient risk tracking over time

### 📊 Data Visualization
- Interactive bar charts for factor contributions
- Diabetes correlation heatmap for data exploration

---

## 🏗 Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Client — React + TypeScript"]
        UI["Risk Assessment Form"]
        CV["Clinician View"]
        PV["Patient View"]
        VIZ["Data Visualizations"]
        HIST["Assessment History"]
    end

    subgraph Server["⚙️ Server — Express.js"]
        API["REST API Routes"]
        VAL["Zod Validation"]
        ORM["Drizzle ORM"]
        PY["Python Bridge"]
    end

    subgraph ML["🧠 ML Pipeline — Python"]
        PROC["Data Preprocessing"]
        MODEL["Logistic Regression"]
        INTERP["Feature Interpretation"]
        CACHE["Model Cache (pickle)"]
    end

    subgraph DB["🗄️ PostgreSQL"]
        ASSESS["Assessments Table"]
    end

    Client -->|"HTTP Requests"| API
    API --> VAL --> ORM
    API --> PY -->|"spawn process"| ML
    ORM --> DB
    ML -->|"risk scores + factors"| PY
    CACHE -.->|"load cached model"| MODEL
```

---

## 🛠 Tech Stack

<table>
  <thead>
    <tr>
      <th>Layer</th>
      <th>Technology</th>
      <th>Purpose</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="7"><strong>Frontend</strong></td>
      <td>React 18 + TypeScript</td>
      <td>UI framework with type safety</td>
    </tr>
    <tr>
      <td>Vite</td>
      <td>Lightning-fast dev server & bundler</td>
    </tr>
    <tr>
      <td>Tailwind CSS</td>
      <td>Utility-first styling with dark mode</td>
    </tr>
    <tr>
      <td>TanStack Query</td>
      <td>Server state & cache management</td>
    </tr>
    <tr>
      <td>React Hook Form + Zod</td>
      <td>Form handling with schema validation</td>
    </tr>
    <tr>
      <td>Recharts</td>
      <td>Interactive data visualizations</td>
    </tr>
    <tr>
      <td>Framer Motion</td>
      <td>Smooth UI animations</td>
    </tr>
    <tr>
      <td rowspan="4"><strong>Backend</strong></td>
      <td>Express.js</td>
      <td>REST API server</td>
    </tr>
    <tr>
      <td>Drizzle ORM</td>
      <td>Type-safe database queries</td>
    </tr>
    <tr>
      <td>PostgreSQL 14+</td>
      <td>Relational data storage</td>
    </tr>
    <tr>
      <td>Zod</td>
      <td>Runtime schema validation</td>
    </tr>
    <tr>
      <td rowspan="4"><strong>ML Pipeline</strong></td>
      <td>Python 3.10+</td>
      <td>ML runtime environment</td>
    </tr>
    <tr>
      <td>scikit-learn</td>
      <td>Logistic Regression model</td>
    </tr>
    <tr>
      <td>pandas / NumPy</td>
      <td>Data manipulation & preprocessing</td>
    </tr>
    <tr>
      <td>pickle</td>
      <td>Model & scaler caching</td>
    </tr>
  </tbody>
</table>

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Check | Download |
|---|---|---|---|
| Node.js | 18+ LTS | `node -v` | [nodejs.org](https://nodejs.org) |
| npm | 9+ | `npm -v` | bundled with Node |
| Python | 3.10+ | `python3 --version` | [python.org](https://python.org) |
| PostgreSQL | 14+ | `psql --version` | [postgresql.org](https://postgresql.org) |
| Git | Any | `git --version` | [git-scm.com](https://git-scm.com) |
| Docker | 20+ | `docker --version` | [docker.com](https://www.docker.com) |
| Docker Compose | 2+ | `docker compose version` | bundled with Docker |

---

## 🐳 Fast Setup with Docker (Recommended)

If you have Docker installed, you can skip the manual installation of Node.js, Python, and PostgreSQL entirely. Running the application requires just a single command.

### 1. Launching the App
Simply run the following command in the project root:

```bash
docker compose up
```

This command will:
* Spin up a PostgreSQL 16 database container with persistent storage.
* Build the app container including Node.js 20 and a Python 3 virtual environment with all scikit-learn/pandas dependencies.
* Wait for the database to be healthy, then run migrations (`npm run db:push`).
* Automatically seed the database with sample clinical assessments (in development mode).
* Launch the full-stack server with live-reloading (HMR) enabled.

Once started, open your browser and navigate to:
* **Web App & REST API:** [http://localhost:3000](http://localhost:3000)

### 2. Stop the App
To stop the services while preserving your data:
```bash
docker compose down
```

To stop the services and completely reset the database (deleting persistent volumes):
```bash
docker compose down -v
```

### 3. Rebuilding after Updates
If you update `package.json` or `requirements.txt` dependencies, trigger a clean rebuild:
```bash
docker compose up --build
```

---

## ⚙️ Manual Installation & Setup

### 1. 📥 Clone & Install

```bash
git clone https://github.com/gopaljilab/Clinical-Insight-Engine.git
cd Clinical-Insight-Engine
npm install
```

### 2. 🔐 Environment Configuration

**Linux / macOS**
```bash
cp .env.example .env
```

**Windows (PowerShell)**
```powershell
Copy-Item .env.example .env
```

**Windows (Command Prompt)**
```cmd
copy .env.example .env
```

If `.env.example` doesn't exist, create `.env` manually and add:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clinical_insight_engine
```

<details>
<summary><strong>🧪 Developer Authentication Setup (optional)</strong></summary>

For local frontend authentication testing, create a `.env.local` file (git-ignored):

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

DEV_CLINICIAN_EMAIL=developer@cardioguard.local
DEV_CLINICIAN_PASSWORD=DevSecurePassword123!

NEXT_PUBLIC_LOCAL_ENCRYPTION_KEY=your_local_32_character_secret_key_here
```

> **Rules of thumb:**
> - `🔒 .env` → database & server secrets only
> - `🔒 .env.local` → local seeded credentials only (never commit)
> - Restart the dev server after editing `.env.local` so Vite reloads variables
> - Never paste demo credentials into UI, docs, screenshots, or PRs

#### 🖥️ Local Login Workflow

1. Start the app with `npm run dev`
2. Open `http://localhost:5173`
3. Click **Login** or **Go to App**
4. Enter your `.env.local` seeded credentials
5. Complete the simulated OTP step
6. You'll be redirected to `/dashboard`

> In development mode, the login form shows a small amber notice reminding you to use local seeded credentials. This banner and the `DEV_*` variables are **never exposed in production builds.**

</details>

### 3. 🗄 Database Setup

<details>
<summary><strong>🐧 Linux (Ubuntu / Debian)</strong></summary>

```bash
# Install PostgreSQL
sudo apt update && sudo apt install postgresql postgresql-contrib

# Start & enable the service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database & set password
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE clinical_insight_engine;"
```

</details>

<details>
<summary><strong>🍎 macOS (Homebrew)</strong></summary>

```bash
# Install PostgreSQL
brew install postgresql

# Start the service
brew services start postgresql

# Create database & set password
psql postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
psql postgres -c "CREATE DATABASE clinical_insight_engine;"
```

</details>

<details>
<summary><strong>🪟 Windows</strong></summary>

1. Download and install PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. During installation, use:
   - **Username:** `postgres`
   - **Password:** `postgres`
   - **Port:** `5432`
3. Create a database named `clinical_insight_engine` using **pgAdmin** or the PostgreSQL CLI.
4. Update your `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clinical_insight_engine
```

</details>

Push the database schema:

```bash
npm run db:push
```

> The server runs a **PostgreSQL preflight check** on startup. If you see `Database startup check failed`, verify that:
> - PostgreSQL service is running
> - `DATABASE_URL` in `.env` is correct
> - The migration above has been run
> - Port `5432` is not blocked

### 4. 🐍 Python Environment

<details>
<summary><strong>🐧 Linux / 🍎 macOS</strong></summary>

```bash
# Create virtual environment
python3 -m venv .venv

# Activate
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

</details>

<details>
<summary><strong>🪟 Windows (PowerShell)</strong></summary>

```powershell
# Create virtual environment
py -m venv .venv

# Activate
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

</details>

### 5. 📊 Dataset Preparation

**If the dataset already exists in the project:**

```bash
# Linux / macOS
cp attached_assets/diabetes_dataset.csv ./diabetes_dataset.csv

# Windows (PowerShell)
Copy-Item attached_assets/diabetes_dataset.csv ./diabetes_dataset.csv
```

**If the dataset is missing, generate synthetic data:**

```bash
# Linux / macOS
python3 -c "from analyze import create_synthetic_data; create_synthetic_data()"

# Windows
py -c "from analyze import create_synthetic_data; create_synthetic_data()"
```

### 6. 🚀 Launch

```bash
# Start the full-stack dev server
npm run dev
```

| Service | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3000 |

### 7. 🛑 Shutting Down

**Stop the dev server:**
```
Ctrl + C
```

**Deactivate the Python environment:**
```bash
deactivate
```

---

## 📁 Project Structure

```
Clinical-Insight-Engine/
│
├── client/                        # React frontend
│   └── src/
│       ├── components/            # Reusable UI components
│       ├── pages/                 # Route-level page components
│       ├── hooks/                 # Custom React hooks
│       │   ├── use-assessments.ts # TanStack Query hooks for API calls
│       │   └── use-toast.ts       # Toast notification state
│       ├── lib/                   # Utilities & API client
│       │   ├── queryClient.ts     # Global fetch config + React Query setup
│       │   └── utils.ts           # cn() Tailwind class merge utility
│       └── utils/
│           ├── search_filters.ts  # Patient search & filter logic
│           └── date_fix.ts        # Safe date parser helper
│
├── server/                        # Express.js backend
│   ├── index.ts                   # Server entry point & startup
│   ├── routes.ts                  # API route definitions
│   ├── storage.ts                 # Data access layer (DB queries)
│   ├── db.ts                      # Drizzle ORM + PostgreSQL pool
│   ├── static.ts                  # Serves built React frontend
│   ├── vite.ts                    # Vite dev server integration (HMR)
│   └── db_fix.ts                  # Clean process exit on DB errors
│
├── shared/                        # Shared between client & server
│   ├── schema.ts                  # Drizzle DB schema + Zod types
│   └── routes.ts                  # Shared API request/response schemas
│
├── script/
│   └── build.ts                   # esbuild + Vite production build script
│
├── attached_assets/               # Static assets (dataset, images)
│   └── diabetes_dataset.csv
│
├── analyze.py                     # ML pipeline — training & inference
├── main.py                        # Python entry point
├── diabetes_dataset.csv           # Training dataset (root copy)
├── correlation_heatmap.png        # Diabetes feature correlation heatmap
├── patient.json                   # Sample patient input for CLI prediction
│
├── drizzle.config.ts              # Drizzle ORM configuration
├── vite.config.ts                 # Vite bundler configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
├── postcss.config.js              # PostCSS configuration
├── components.json                # shadcn/ui component registry
├── pyproject.toml                 # Python project metadata
├── requirements.txt               # Python dependencies
├── package.json                   # Node.js dependencies & scripts
├── package-lock.json              # Locked dependency versions
├── uv.lock                        # uv Python lock file
│
├── README.md                      # Project documentation
├── ANALYSIS_README.md             # ML analysis documentation
├── CONTRIBUTING.md                # Contribution guidelines
└── CODE_OF_CONDUCT.md             # Community code of conduct
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Application health check endpoint for monitoring |
| `POST` | `/api/assessments` | Submit a new risk assessment |
| `GET` | `/api/assessments` | Retrieve assessment history |
| `GET` | `/api/assessments/:id` | Get a specific assessment by ID |

### Example Request

```bash
# Health Check
curl -X GET http://localhost:3000/health

# Submit Assessment
curl -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "Female",
    "age": 52,
    "hypertension": true,
    "heartDisease": false,
    "smokingHistory": "former",
    "bmi": 30.1,
    "hba1cLevel": 6.4,
    "bloodGlucoseLevel": 148
  }'
```

---

## 🧠 ML Pipeline

The machine learning pipeline (`analyze.py`) implements an **interpretable** risk assessment model:

```mermaid
graph LR
    A["📂 Raw Data"] --> B["🧹 Cleaning & Validation"]
    B --> C["⚙️ Feature Engineering"]
    C --> D["📏 StandardScaler"]
    D --> E["📊 Logistic Regression"]
    E --> F["🎯 Risk Score 0–100%"]
    E --> G["📋 Feature Importance"]
    F --> H["💾 Cached Model"]
    G --> H
```

| Step | Details |
|---|---|
| **Data Cleaning** | Filters unrealistic values (BMI < 10, glucose < 50, HbA1c < 3) and replaces with medians |
| **Encoding** | Gender → binary; Smoking history → one-hot encoding |
| **Scaling** | `StandardScaler` on age, BMI, HbA1c, blood glucose |
| **Model** | `LogisticRegression` with balanced class weights |
| **Caching** | Trained model + scaler serialized via `pickle` for fast inference |

### Train the Model (Optional)

```bash
# Linux/macOS
python3 analyze.py

# Windows
py analyze.py
```

---

## 🔬 Single-Patient Prediction (CLI)

Create a patient JSON file:

```json
{
  "gender": "Female",
  "age": 52,
  "hypertension": true,
  "heartDisease": false,
  "smokingHistory": "former",
  "bmi": 30.1,
  "hba1cLevel": 6.4,
  "bloodGlucoseLevel": 148
}
```

Run prediction:

```bash
# Linux/macOS
python3 analyze.py predict_file patient.json

# Windows
py analyze.py predict_file patient.json
```

---

## 🔑 Environment Variables

| Variable | File | Description |
|---|---|---|
| `DATABASE_URL` | `.env` | PostgreSQL connection string |
| `NODE_ENV` | `.env.local` | Set to `development` for local dev features |
| `SESSION_SECRET` | `.env` | Required in production for signed Express sessions |
| `DEV_CLINICIAN_EMAIL` | `.env.local` | Seeded clinician email (dev only) |
| `DEV_CLINICIAN_PASSWORD` | `.env.local` | Seeded clinician password (dev only) |
| `NEXT_PUBLIC_LOCAL_ENCRYPTION_KEY` | `.env.local` | Local encryption key (dev only) |

> **Security:** `.env.local` is git-ignored and should **never** be committed. Production builds do not expose dev credentials.

> **Request limits:** JSON and URL-encoded API payloads are limited to `256kb` by default. Add route-specific upload handling before increasing this global limit.
> **Production sessions:** When the app runs behind a TLS-terminating reverse proxy or load balancer, Express trusts one proxy hop in production so secure session cookies are issued from `X-Forwarded-Proto: https` requests.

---

## ❓ Troubleshooting

<details>
<summary><strong>"PostgreSQL is unreachable"</strong></summary>

- Verify PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or `brew services list` (macOS)
- Confirm `DATABASE_URL` in `.env` matches your local credentials
- Ensure port `5432` is not blocked by another process
- Check that the `clinical_insight_engine` database exists

</details>

<details>
<summary><strong>"Database startup check failed"</strong></summary>

- Run `npm run db:push` to create/update the required tables
- Verify your `.env` file is in the project root (not inside `server/` or `client/`)

</details>

<details>
<summary><strong>Python model errors</strong></summary>

- Ensure the virtual environment is activated: `source .venv/bin/activate`
- Verify dependencies: `pip install -r requirements.txt`
- If `diabetes_dataset.csv` is missing, copy it: `cp attached_assets/diabetes_dataset.csv ./`
- Or generate synthetic data: `python3 -c "from analyze import create_synthetic_data; create_synthetic_data()"`

</details>

<details>
<summary><strong>Port conflicts</strong></summary>

- The dev server defaults to port **5173** (Vite)
- If occupied, Vite will automatically pick the next available port
- Check for processes: `lsof -i :5173` (Linux/macOS) or `netstat -ano | findstr :5173` (Windows)

</details>

---

## 🗺 Roadmap

- [ ] 📈 Longitudinal patient risk tracking across visits
- [ ] 💡 Counterfactual reasoning — *"What single change reduces risk most?"*
- [ ] 🔬 Cohort discovery and population-level insights
- [ ] 🏥 Integration with Electronic Health Records (EHR)
- [ ] ⚖️ Advanced bias detection and ML fairness metrics
- [ ] ☁️ Cloud deployment (Vercel / Render)

---

## 🤝 Contributing

We love contributions! Whether it's a bug fix, a new feature, or improved docs — **every PR makes a difference**.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Please read our [**Contributing Guide**](CONTRIBUTING.md) and [**Code of Conduct**](CODE_OF_CONDUCT.md) before submitting.

---

## 👥 Contributors

<a href="https://github.com/gopaljilab/Clinical-Insight-Engine/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=gopaljilab/Clinical-Insight-Engine" alt="Contributors" />
</a>

---

## 👤 Author - [![GitHub](https://img.shields.io/badge/GitHub-gopaljilab-181717?style=flat-square&logo=github)](https://github.com/gopaljilab)


**Gopal Gupta**
*Computer Science Engineer · Full-Stack Developer · Data Science & ML Enthusiast*

<div align="center">

*Built with ❤️ for better preventive healthcare*

⭐ **Star this repo** if you find it useful — it helps others discover the project!

</div>


### GSSoC Drizzle Migrations Policy
- All schema changes must go through drizzle-kit generate.


## ✨ README Improvement Notes

### 📌 Formatting Enhancements Needed
- Improve heading hierarchy for better readability
- Ensure consistent spacing between sections
- Use proper Markdown formatting for code blocks and lists
- Align all installation and usage steps properly

### 🚀 Suggested Structure Upgrade
- Introduction
- Features
- Tech Stack
- Installation
- Usage
- Project Structure
- Contribution Guidelines
- License

### 🛠️ Documentation Improvements
- Add badges (optional): build, license, contributors
- Add screenshots for better UI understanding
- Standardize code blocks for commands

### 🎯 Goal
Improve onboarding experience for new contributors and users by making README more structured, readable, and professional.

