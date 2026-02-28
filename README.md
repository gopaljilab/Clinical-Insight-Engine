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
- Interpretable risk scoring
- Dynamic advice generation based on risk level
- Confidence-aware outputs to support clinical judgment

---

## 🗂️ Project Structure
```
Clinical-Insight-Engine/
├── client/                    # Frontend (Vite + React + Tailwind)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and helpers
│   │   └── types/            # TypeScript definitions
│   └── public/                # Static assets
│
├── server/                    # Backend services
│   ├── routes/               # API route handlers
│   ├── middleware/           # Express middleware
│   ├── services/             # Business logic
│   └── db/                   # Database configuration
│
├── shared/                    # Shared types and schemas
│   └── schema.ts             # Zod validation schemas
│
├── scripts/                   # Utility scripts
│   └── setup-db.ts           # Database setup script
│
├── attached_assets/           # Static assets and references
│
├── analyze.py                 # Core ML analysis logic
├── main.py                    # Backend entry point
├── diabetes_dataset.csv       # Sample clinical dataset
│
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── tsconfig.json              # TypeScript configuration
├── drizzle.config.ts          # Drizzle ORM configuration
│
├── pyproject.toml             # Python dependencies
├── uv.lock                    # Python dependency lock file
│
├── package.json               # Node dependencies
├── package-lock.json
│
├── ANALYSIS_README.md         # Detailed ML & analysis documentation
├── README.md                   # Project overview
└── .gitignore
```

---

## 🧪 Data Model

Each assessment record includes:

### Patient Demographics
- Age
- Gender

### Medical History
- Hypertension
- Heart disease
- Smoking history

### Clinical Measurements
- BMI
- HbA1c level
- Blood glucose level

### Model Outputs
- Risk score (0–100%)
- Risk category
- Contributing risk factors

### Metadata
- Timestamp for tracking and auditing

---

## 🔌 API Endpoints

- `POST /api/assessments`  
  Submit patient data for diabetes risk assessment

- `GET /api/assessments`  
  Retrieve historical assessment records

---

## 📊 Risk Categorization

| Risk Level | Probability | Recommended Action |
|-----------|-------------|--------------------|
| **LOW** | < 20% | Annual monitoring |
| **MODERATE** | 20–50% | Lifestyle counseling, repeat HbA1c in 6 months |
| **HIGH** | > 50% | Diagnostic testing and clinical intervention |

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/gopaljilab/Clinical-Insight-Engine.git
cd Clinical-Insight-Engine
```

2️⃣ Frontend Setup
```
npm install
npm run dev
```
Frontend runs at:

http://localhost:5173
3️⃣ Backend Setup
python -m venv venv
source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt

Run backend:

python main.py
🧠 Clinical Decision Support Workflow

Clinician enters patient data via the assessment form

Backend invokes the Python ML pipeline

Logistic regression computes risk probability and contributors

Results are persisted in the database

Outputs are displayed in clinician and patient-friendly formats

System suggests appropriate follow-up actions

⚖️ Safety & Ethics

Not a Diagnostic Tool
Explicitly framed as decision support

Interpretability First
Logistic regression chosen for transparency

Uncertainty Communication
Confidence indicators encourage clinical judgment

Bias Awareness
Balanced data and demographic sensitivity considered

🔮 Future Enhancements

Longitudinal patient risk tracking

Counterfactual reasoning (“What change reduces risk most?”)

Cohort discovery and population-level insights

Integration with Electronic Health Records (EHR)

Advanced bias detection and fairness metrics

Cloud deployment (Vercel / Render / Replit)

👤 Author

Gopal Gupta
Computer Science Engineer
Full-Stack Developer | Data Science & ML Enthusiast