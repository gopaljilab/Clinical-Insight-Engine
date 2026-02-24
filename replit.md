# Clinical Decision Support: Preventive Diabetes Risk Assessment

A full-stack web application for preventive diabetes risk assessment that combines a Python-based logistic regression model with a React frontend. The system surfaces early risk signals from routine patient data and communicates findings differently for clinicians and patients.

## Features

### Core Functionality
- **Risk Assessment Form**: Input patient data including age, gender, hypertension, heart disease, smoking history, BMI, HbA1c level, and blood glucose level
- **Dual-View Results**:
  - **Clinician View**: Displays precise risk percentage, top contributing factors with impact analysis, model confidence, and recommended follow-up actions
  - **Patient View**: Shows simplified risk category (LOW/MODERATE/HIGH), factors in plain language, and preventive lifestyle advice
- **Assessment History**: View all past risk assessments with timestamps and risk categories
- **Data Visualization**: Interactive bar charts showing risk factor contributions (clinician view)

### Technical Architecture

#### Frontend (`client/`)
- React with TypeScript
- TanStack Query for server state management
- React Hook Form with Zod validation
- Recharts for data visualization
- Tailwind CSS with dark mode support
- Framer Motion for animations

#### Backend (`server/`)
- Express.js REST API
- PostgreSQL database (via Drizzle ORM)
- Python integration for ML predictions
- Route validation with Zod schemas

#### Machine Learning (`analyze.py`)
- Logistic Regression model using scikit-learn
- Feature engineering and preprocessing
- StandardScaler for feature normalization
- Interpretable risk scoring and factor analysis
- Dynamic advice generation based on risk level

## Data Model

### Assessment Table
- Patient demographics: gender, age
- Medical history: hypertension, heart disease, smoking history
- Clinical measurements: BMI, HbA1c level, blood glucose level
- Model outputs: risk score (0-100%), risk category, contributing factors
- Timestamp for tracking

## API Endpoints

- `POST /api/assessments` - Submit patient data for risk assessment
- `GET /api/assessments` - Retrieve assessment history

## Risk Categorization

- **LOW (<20%)**: Monitor annually, no immediate intervention
- **MODERATE (20-50%)**: Lifestyle counseling, repeat HbA1c in 6 months
- **HIGH (>50%)**: Refer for diagnostic testing, consider intervention

## Development

### Dependencies
- **Node.js**: Express, TypeScript, Drizzle ORM
- **Python**: pandas, numpy, scikit-learn
- **React**: React 18, React Query, React Hook Form

### Database
PostgreSQL with Drizzle ORM. Schema managed via `npm run db:push`.

### Running the Application
The workflow "Start application" runs `npm run dev` which starts both the Express backend and Vite frontend on port 5000.

## Clinical Decision Support Workflow

1. **Data Input**: Clinician enters patient data via the assessment form
2. **Processing**: Backend invokes Python script with patient data
3. **Model Inference**: Logistic regression model calculates risk probability and identifies key factors
4. **Result Storage**: Assessment saved to database with predictions
5. **Dual Display**: Results shown in both clinician and patient-friendly formats
6. **Follow-up**: System suggests appropriate next steps based on risk level

## Safety & Ethics

- **Not a Diagnostic Tool**: Frames everything as decision support, not medical diagnosis
- **Interpretability**: Uses logistic regression for transparent, explainable predictions
- **Uncertainty Communication**: Includes confidence measures and suggests clinical judgment
- **Bias Awareness**: Model trained on balanced data with attention to demographic factors

## Future Enhancements

- Longitudinal patient tracking
- Counterfactual reasoning ("what would reduce risk most?")
- Cohort discovery and population-level insights
- Integration with electronic health records (EHR)
- Advanced bias detection and fairness metrics
