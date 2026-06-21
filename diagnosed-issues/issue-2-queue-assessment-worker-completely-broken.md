# Issue: Queue Assessment Worker Completely Broken — All Async Assessment Processing Fails Silently

**Severity:** Critical  
**Area:** `server/queue.ts`  
**Type:** Bug / Incomplete Refactoring

## Description

The `startAssessmentWorker()` function that processes BullMQ queue jobs for async assessment creation is structurally corrupted. It attempts to mix the new Python daemon ML inference API with remnants of the old subprocess-based approach, resulting in duplicate variable declarations, references to un-imported symbols, and broken control flow. All assessments submitted via `POST /api/assessments` silently fail to process.

## Root Cause Analysis

The worker function at `server/queue.ts:72-178` was partially refactored during the Python daemon migration (commit `7a30ec5`) but the old subprocess code was never fully removed. The result is an unparseable mix of both approaches:

### 1. Duplicate Variable Declaration (lines 84–85)

```typescript
const { prediction } = await MLService.runAssessmentInference(input);
let prediction: any;
```

Line 84 destructures `prediction` from the result of `MLService.runAssessmentInference()`. Line 85 immediately declares `let prediction: any;` in the **same block scope**.

In JavaScript strict mode (which TypeScript enforces), `let` cannot redeclare a name already bound by `const` in the same scope. This is a `SyntaxError` at runtime. The code after line 85 is **dead code** — it never executes.

### 2. References to Un-Imported Symbols (lines 86–87)

```typescript
if (!isPythonAvailable) {
   prediction = calculateClinicalFallback(input);
```

`isPythonAvailable` and `calculateClinicalFallback` are **not imported** in `server/queue.ts`. The existing imports (lines 1–6) are:

```typescript
import { Queue, Worker, Job } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { sendCriticalRiskAlert } from "./email";
import { logger } from "./logger";
import { MLService } from "./services/mlService";
```

Even if the duplicate declaration were fixed, these symbols would throw `ReferenceError`.

### 3. Old Subprocess ML Code Left In Place (lines 89–117)

The `else` branch (lines 89–117) contains the old subprocess-based prediction code that writes input JSON to a temp file and calls `execFile` with `analyze.py predict_file`. This code was **supposed to be removed** when the Python daemon was introduced. It references:
- `writeFile`, `tempFile` — `tempFile` is not defined (the variable declared on line 278 is `tempFilePath`, and it's in a different file entirely — `mlService.ts`)
- `child` — used but declared inside a promise callback on line 91, making it inaccessible to the `fallbackTimer` on line 107
- `analyzePyPath`, `getPythonExecutable` — not available in this scope

### 4. Broken Promise Structure (lines 90–123)

The promise-construction at lines 90–117 has mismatched braces and incorrect nesting:
- Line 90: `const stdout = await new Promise<string>((resolve, reject) => {` — opens promise
- Line 106: `});` — may intend to close the promise executor but the structure is ambiguous
- Lines 107–117: code after the promise that references `child` (scoped inside the promise) and `setTimeout`, `clearTimeout`
- Line 118: `});` — another spurious close
- Line 119–122: `prediction = JSON.parse(stdout.trim())` — accesses `stdout` outside the promise scope

### 5. Job Failure Not Properly Handled (lines 162–167)

The `catch` block at line 162 only logs and re-throws certain errors, but because the `SyntaxError` from line 84/85 occurs at function definition time (not execution time), the worker never even starts.

## Impact

- **All async assessment requests (POST /api/assessments) silently fail** — the job is added to the queue but the worker cannot process it.
- **Critical risk alerts are never sent** — the code that sends HIGH risk emails to clinicians is unreachable.
- **Users see "Assessment request accepted" (202)** but the assessment is never created in the database.
- **The `GET /api/assessments/jobs/:id` endpoint always returns "failed"** with no useful error.
- **Complete denial of service** for the primary value-creation flow of the application.

## Required Changes

1. **Rewrite the worker function body** (lines 80–167) to cleanly use the daemon-based `MLService.runAssessmentInference()`:

   ```typescript
   async (job: Job) => {
     const { input, userId, userEmail } = job.data;
     try {
       const { prediction, isFallback } = await MLService.runAssessmentInference(input);
       
       prediction.disclaimer = "DISCLAIMER: ...";
       
       const assessment = await storage.createAssessment({
         ...input,
         riskScore: Number(prediction.riskScore),
         riskCategory: prediction.riskCategory,
         factors: prediction.factors,
         confidenceInterval: prediction.confidenceInterval ?? null,
         modelConfidence: prediction.modelConfidence == null ? undefined : Number(prediction.modelConfidence),
         createdBy: userEmail || userId,
         userId: userId
       });

       if (prediction.riskCategory === "HIGH" && userEmail) {
         await sendCriticalRiskAlert(userEmail, input.patientName, Number(prediction.riskScore), assessment.id);
       }

       return { ...assessment, prediction };
     } catch (err: any) {
       logger.error({ err, jobId: job.id }, "Assessment queue job failed");
       throw err;
     }
   }
   ```

2. **Add necessary imports**: `MLService` is already imported on line 6. No additional imports needed if the daemon API is used.

3. **Remove all old subprocess code** — lines 89–117 and any vestigial subprocess references.

4. **Fix the duplicate `prediction` declaration** on lines 84–85.

5. **Verify worker failure handling** — the `"failed"` event handler on lines 175–177 should include the job ID and error details for observability.

6. **Add integration tests** that verify the queue → worker → assessment creation → email notification pipeline.

## Files Modified

- `server/queue.ts` — worker function rewrite

## Verification

- Submit a POST /api/assessments with valid assessment data
- Check the returned jobId via GET /api/assessments/jobs/:id
- Verify state transitions to "completed"
- Verify the assessment appears in GET /api/assessments
- Verify critical risk emails are sent for HIGH risk assessments
