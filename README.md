![License](https://img.shields.io/github/license/gopaljilab/Clinical-Insight-Engine)
![Stars](https://img.shields.io/github/stars/gopaljilab/Clinical-Insight-Engine)
![Issues](https://img.shields.io/github/issues/gopaljilab/Clinical-Insight-Engine)
![Last Commit](https://img.shields.io/github/last-commit/gopaljilab/Clinical-Insight-Engine)
# 🩺 Clinical Insight Engine  
## Clinical Decision Support for Preventive Diabetes Risk Assessment

**Clinical Insight Engine** is a full-stack clinical decision support system designed to surface early diabetes risk signals from routine patient data.  
It combines a **Python-based interpretable machine learning model** with a **modern React frontend**, presenting results differently for **clinicians** and **patients**.

🎯 The project emphasizes **interpretability, confidence-aware predictions, and ethical ML**, rather than black-box diagnosis.

⚠️ **Disclaimer**  
This system is intended for **educational and research purposes only** and does **not** provide medical diagnoses.

---

## ✨ Key Features

### 🔹 Core Functionality

#### 🧾 Risk Assessment Form
Inputs include:
- Age, gender
- Hypertension and heart disease status
- Smoking history
- BMI
- HbA1c level
- Blood glucose level

#### 👥 Dual-View Results

**Clinician View**
- Exact risk percentage (0–100%)
- Top contributing factors with impact analysis
- Model confidence indicators
- Suggested follow-up actions

**Patient View**
- Simplified risk category (**LOW / MODERATE / HIGH**)
- Plain-language explanation of risk factors
- Preventive lifestyle recommendations

#### 🕒 Assessment History
- Stores previous assessments with timestamps
- Enables longitudinal tracking of patient risk

#### 📊 Data Visualization
- Interactive bar charts showing factor contributions
- Available in clinician view for transparency

---

## 🏗️ System Architecture

### Frontend (`client/`)
- React + TypeScript
- Vite for fast development
- Tailwind CSS with dark mode support
- TanStack Query for server state management
- React Hook Form + Zod validation
- Recharts for data visualization
- Framer Motion for animations

### Backend (`server/`)
- Express.js REST API
- PostgreSQL database via Drizzle ORM
- Python integration for ML inference
- Zod-based route and schema validation

### Machine Learning (`analyze.py`)
- Logistic Regression (scikit-learn)
- Feature engineering and preprocessing
- StandardScaler for normalization

---

## ✅ Prerequisites

- Node.js 18+ (LTS) + npm
- Python 3.10+
- PostgreSQL 14+ (local)
- Git

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/gopaljilab/Clinical-Insight-Engine.git
cd Clinical-Insight-Engine
```

### 2️⃣ Install Node Dependencies
```bash
npm install
```

### 3️⃣ Create Environment File
Create a `.env` file in the project root:

```bash
# Linux/macOS
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

If `.env.example` doesn't exist, create `.env` manually:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clinical_insight_engine
```

### 4️⃣ PostgreSQL Database Setup

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE clinical_insight_engine;"
```

#### macOS (Homebrew)
```bash
# Install PostgreSQL
brew install postgresql

# Start service
brew services start postgresql

# Create database
psql postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
psql postgres -c "CREATE DATABASE clinical_insight_engine;"
```

#### Windows
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Install with default settings (remember the password for `postgres` user)
3. Open **SQL Shell (psql)** or **pgAdmin** and run:

```sql
-- If password is different, update .env accordingly
CREATE DATABASE clinical_insight_engine;
```

Or via PowerShell (if `psql` is in PATH):
```powershell
psql -U postgres -d postgres -c "CREATE DATABASE clinical_insight_engine;"
```

### 5️⃣ Database Migration
Create the required tables:

```bash
npm run db:push
```

If the above doesn't work, try:
```bash
npm run migrate
# or
npm run db:migrate
```

### 6️⃣ Python Environment Setup

#### Linux/macOS
```bash
# Create virtual environment
python3 -m venv .venv

# Activate environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# If requirements.txt doesn't exist, install manually:
# pip install numpy pandas scikit-learn
```

#### Windows (PowerShell)
```powershell
# Create virtual environment
py -m venv .venv

# Activate environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# If requirements.txt doesn't exist, install manually:
# pip install numpy pandas scikit-learn
```

### 7️⃣ Dataset Preparation

If dataset exists in project:
```bash
# Linux/macOS
cp attached_assets/diabetes_dataset.csv ./diabetes_dataset.csv

# Windows (PowerShell)
Copy-Item attached_assets/diabetes_dataset.csv ./diabetes_dataset.csv
```

If dataset is missing, generate synthetic data:
```bash
# Linux/macOS
python3 -c "from analyze import create_synthetic_data; create_synthetic_data()"

# Windows
py -c "from analyze import create_synthetic_data; create_synthetic_data()"
```

### 8️⃣ Start the Application

#### Frontend (React + Vite)
```bash
npm run dev
```
Frontend runs at: `http://localhost:5173`

#### ML Pipeline (Training)
```bash
# Linux/macOS
python3 analyze.py

# Windows
py analyze.py
```

#### Backend API (if separate)
```bash
# Linux/macOS
python3 main.py

# Windows
py main.py
```

---

## 🧪 Single-Patient Prediction (Optional)

Create a patient JSON file:

#### Linux/macOS
```bash
cat > patient.json << 'EOF'
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
EOF
```

#### Windows (PowerShell)
```powershell
@'
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
'@ | Out-File -FilePath patient.json -Encoding utf8
```

Run prediction:
```bash
# Linux/macOS
python3 analyze.py predict_file patient.json

# Windows
py analyze.py predict_file patient.json
```

---

## 🛑 Shutdown

### 1️⃣ Stop Development Server
Press `Ctrl + C` in the terminal running `npm run dev`

### 2️⃣ Deactivate Python Environment
```bash
# Linux/macOS
deactivate

# Windows
deactivate
```

---

## 🔮 Future Enhancements

- Longitudinal patient risk tracking
- Counterfactual reasoning ("What change reduces risk most?")
- Cohort discovery and population-level insights
- Integration with Electronic Health Records (EHR)
- Advanced bias detection and fairness metrics
- Cloud deployment (Vercel / Render)

---

## 👤 Author

**Gopal Gupta**  
Computer Science Engineer  
Full-Stack Developer | Data Science & ML Enthusiast
