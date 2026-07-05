import { Project, SyntaxKind } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = [
  ...project.getSourceFiles("server/services/**/*.ts"),
  ...project.getSourceFiles("server/utils/**/*.ts"),
  ...project.getSourceFiles("client/src/hooks/**/*.ts"),
  ...project.getSourceFiles("client/src/hooks/**/*.tsx"),
  ...project.getSourceFiles("client/src/utils/**/*.ts"),
  ...project.getSourceFiles("client/src/lib/apiClient.ts"),
];

console.log(`Loaded ${sourceFiles.length} source files to process.`);

// Predefined detailed description map for critical elements
const customDescriptions: Record<string, string> = {
  // mlService.ts
  "SimpleSemaphore": "A concurrency-limiting semaphore designed to throttle intensive Machine Learning inference tasks and manage server resource boundaries.",
  "generateRequestFingerprint": "Computes a deterministic SHA-256 fingerprint for a request payload combined with a user ID. Used to identify duplicate concurrent requests and key caches.",
  "getPythonExecutable": "Resolves the absolute path to the local Python virtual environment executable depending on the host platform.",
  "checkPythonAvailability": "Asynchronously polls Python execution response, disabling the ML pipeline fallback flag if unresponsive.",
  "calculateClinicalFallback": "Rule-based clinical fallback calculator implementing ADA-like heuristics for diabetes risk score computation when the ML daemon fails.",
  "PythonDaemonManager": "Manages lifecycle, IPC socket communication, error bounds, and queue-bound timeouts for the background Python ML process.",
  "runAssessmentInference": "Runs a single clinical assessment inference through the Python daemon with semaphore limits, falling back to rule-based analysis on failure.",
  "runAssessmentInferenceBatch": "Performs batch clinical assessment inference through the Python daemon with parallel resolution and fallback failover.",
  "MLService": "Namespace exporting ML inference operations and utilities.",

  // assessment-quality-checker.ts
  "generateQualityAlerts": "Evaluates clinical telemetry data against medical ranges to detect measurement anomalies, unit mix-ups, and pathophysiological mismatches.",
  "isLikelyUnitError": "Audits laboratory telemetry (HbA1c/glucose) to identify potential unit mismatch (e.g. mmol/mol vs. percentage).",
  "bmiHbA1cMismatch": "Detects physiological contradictions like low BMI combined with dangerously elevated HbA1c/glucose.",
  "youngAgeWithHeartDisease": "Highlights young age onset for cardiac complications for medical history confirmation.",
  "extremeCombinationChecks": "Evaluates high-risk diagnostic clusters (e.g. glycemic emergency limits) for immediate clinical review flags.",

  // biomarker-trend-analyzer.ts
  "analyzeBiomarkerTrends": "Analyzes longitudinal clinical records (lookback window) to determine trajectory directions (increasing/decreasing/stable) for blood glucose, HbA1c, and BMI.",
  "extractSeries": "Normalizes chronologically sorted clinical values for target biomarkers from standard assessment objects.",
  "detectConsecutive": "Tallies direction shifts across chronological telemetry observations to verify consecutive trending limits.",

  // clinical-attention-navigator.ts
  "generateAttentionNavigator": "Prioritizes clinical risk factors based on urgency (high/moderate/monitor) to navigate clinician attention to critical areas.",
  "normalizeSmoking": "Maps diverse raw smoking history input strings to a standardized set of clinical categories.",
  "buildPriority": "Constructs an AttentionPriority object with normalized metadata.",
  "admissionPriority": "Calculates clinical triage priority category for a telemetry reading based on relative threshold deviation.",

  // fhirParser.ts
  "parseFHIRBundle": "Parses an incoming FHIR R4 Bundle to extract patient demographics and clinical observation telemetry.",
  "extractPatientDemographics": "Extracts patient demographic data (age, gender, identifiers) from a FHIR Patient resource.",
  "extractObservations": "Extracts and parses laboratory and physiological observation telemetry from FHIR Observation resources.",

  // data-retention-policy.ts
  "runDataRetentionCleanup": "Periodically purges expired patient assessment data according to configuration rules and compliance standards.",

  // recommendation-engine.ts
  "generateClinicalRecommendations": "Synthesizes patient telemetry, risk scores, and anomalies to generate tailored clinician and patient recommendation lists.",

  // prediction-explainer.ts
  "explainPrediction": "Generates natural language explanations of model factors to help clinicians interpret ML risk score predictions.",

  // use-assessments.ts
  "useAssessments": "A React hook to query the assessments list, supporting pagination, sorting, search term, and range filters.",
  "usePatientAssessments": "A React hook to load patient assessments in an infinite scroll style, isolated by patient name to prevent cross-patient data leakage.",
  "useCreateAssessment": "A React hook to submit a new patient assessment and automatically refresh the assessments list cache.",
  "useUpdateAssessment": "A React hook to modify an existing assessment's details and refresh relevant cache queries.",
  "useDeleteAssessment": "A React hook to remove a specific patient assessment and invalidate associated queries.",
  "useSimulateAssessment": "A React hook to simulate a diabetes risk score based on what-if updates to patient parameters.",
  "useWhatIfAnalysis": "A React hook to run a what-if risk scenario analysis for a specific patient assessment.",
  "useWhatIfBatchAnalysis": "A React hook to run what-if batch analyses across a set of clinical assessments.",

  // use-bulk-import.ts
  "useBulkImport": "A React hook to manage file parsing, CSV validation, batch upload, and progress tracking for patient telemetry imports.",

  // AppError.ts
  "AppError": "Base operational error class representing expected clinical/business rules failures with an HTTP status code.",
  "ValidationError": "Error class for input and request payload validation failures (HTTP 400).",
  "NotFoundError": "Error class for missing resource lookups (HTTP 404).",
  "UnauthorizedError": "Error class for unauthenticated requests (HTTP 401).",
  "ForbiddenError": "Error class for insufficient client roles or permissions (HTTP 403)."
};

function camelCaseToTitle(str: string): string {
  const result = str.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1).trim();
}

function generateDefaultDescription(name: string): string {
  if (name.startsWith("use")) {
    return `React hook for ${camelCaseToTitle(name.slice(3)).toLowerCase()}.`;
  }
  if (name.startsWith("is") && name.length > 2 && name[2] === name[2].toUpperCase()) {
    return `Checks if ${camelCaseToTitle(name.slice(2)).toLowerCase()}.`;
  }
  if (name.startsWith("has") && name.length > 3 && name[3] === name[3].toUpperCase()) {
    return `Checks whether ${camelCaseToTitle(name.slice(3)).toLowerCase()}.`;
  }
  if (name.startsWith("should") && name.length > 6 && name[6] === name[6].toUpperCase()) {
    return `Determines if the system should ${camelCaseToTitle(name.slice(6)).toLowerCase()}.`;
  }
  return `${camelCaseToTitle(name)}.`;
}

let changedCount = 0;

for (const sourceFile of sourceFiles) {
  let fileChanged = false;
  const filePath = sourceFile.getFilePath();

  // Process Class Declarations
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    if (!cls.isExported()) continue;
    if (cls.getJsDocs().length === 0) {
      const name = cls.getName() || "AnonymousClass";
      const desc = customDescriptions[name] || generateDefaultDescription(name);
      cls.addJsDoc({ description: desc });
      fileChanged = true;
      console.log(`[JSDoc] Added class JSDoc to ${name} in ${filePath}`);
    }

    // Process Methods in Class
    const methods = cls.getMethods();
    for (const method of methods) {
      if (method.getJsDocs().length === 0) {
        const methodName = method.getName();
        const desc = customDescriptions[methodName] || generateDefaultDescription(methodName);
        const params = method.getParameters();
        const tags = params.map(p => ({
          tagName: "param",
          text: `${p.getName()} - The ${p.getName()} parameter.`
        }));
        tags.push({
          tagName: "returns",
          text: "The result of the operation."
        });

        method.addJsDoc({
          description: desc,
          tags
        });
        fileChanged = true;
      }
    }
  }

  // Process Functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    if (!func.isExported()) continue;
    if (func.getJsDocs().length === 0) {
      const funcName = func.getName() || "anonymousFunction";
      const desc = customDescriptions[funcName] || generateDefaultDescription(funcName);
      const params = func.getParameters();
      const tags = params.map(p => ({
        tagName: "param",
        text: `${p.getName()} - The ${p.getName()} parameter.`
      }));
      tags.push({
        tagName: "returns",
        text: "The result of the operation."
      });

      func.addJsDoc({
        description: desc,
        tags
      });
      fileChanged = true;
      console.log(`[JSDoc] Added function JSDoc to ${funcName} in ${filePath}`);
    }
  }

  // Process Variable Statements
  const varStatements = sourceFile.getVariableStatements();
  for (const varStmt of varStatements) {
    if (!varStmt.isExported()) continue;
    if (varStmt.getJsDocs().length === 0) {
      const declarations = varStmt.getDeclarations();
      if (declarations.length > 0) {
        const decl = declarations[0];
        const name = decl.getName();
        const init = decl.getInitializer();
        if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
          const func = init.asKind(SyntaxKind.ArrowFunction) || init.asKind(SyntaxKind.FunctionExpression);
          if (func) {
            const desc = customDescriptions[name] || generateDefaultDescription(name);
            const params = func.getParameters();
            const tags = params.map(p => ({
              tagName: "param",
              text: `${p.getName()} - The ${p.getName()} parameter.`
            }));
            tags.push({
              tagName: "returns",
              text: "The result of the operation."
            });

            varStmt.addJsDoc({
              description: desc,
              tags
            });
            fileChanged = true;
            console.log(`[JSDoc] Added variable function JSDoc to ${name} in ${filePath}`);
          }
        } else if (customDescriptions[name]) {
          varStmt.addJsDoc({
            description: customDescriptions[name]
          });
          fileChanged = true;
          console.log(`[JSDoc] Added variable JSDoc to ${name} in ${filePath}`);
        }
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
    changedCount++;
  }
}

console.log(`Finished processing. Updated ${changedCount} files with JSDoc comments.`);
