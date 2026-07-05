### Description
This PR resolves the memory leak (`OOMKilled`) during bulk background analysis tasks by migrating from synchronous batch processing to an asynchronous BullMQ queue, implementing chunked prediction, and enforcing explicit Python garbage collection.

**Note:** This PR replaces #1583 which had unresolvable merge conflicts. This branch has been cleanly created and updated against the latest `main`, resolving all conflicts with recent TypeScript type fixes and security updates (such as the `requireAssessmentAccess` IDOR checks).

### Changes Made
- **Asynchronous Queue:** Migrated the `/api/assessments/bulk` route from synchronous Python script spawning to asynchronous `predictBatch` BullMQ jobs in `server/queue.ts`.
- **Memory Management:** Added explicit `del` keywords and `gc.collect()` calls to `analyze.py` and `safe_csv_reader.py` to force cleanup of DataFrames and large unmanaged arrays immediately after usage.
- **Client Polling:** Implemented real-time interval polling in the React client (`ImportData.tsx`) to track background job completion and properly update the progress bar.
- **Conflict Resolution:** Retained all recent type-safety and security improvements from `main` while safely injecting the background queue logic.

### Related Issues
- Fixes #1458 
- Replaces #1583
