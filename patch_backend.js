const fs = require('fs');

const routesFile = 'server/routes.ts';
let content = fs.readFileSync(routesFile, 'utf8');

// Add import
content = content.replace(
  'import { logger } from "./logger";',
  'import { logger } from "./logger";\nimport { assessmentQueue } from "./queue";'
);

// Replace create assessment endpoint
const createRegex = /app\.post\(\s*api\.assessments\.create\.path,[\s\S]*?(?=\s*app\.post\(\s*"\/api\/assessments\/bulk")/m;

const replacement = `app.post(
    api.assessments.create.path,
    requireAuth,
    requireVerified,
    assessmentLimiter,
    async (req, res) => {
      const userId = req.session.user?.email;
      if (!userId) {
        return res.status(401).json({
          message: "Authentication required.",
        });
      }

      try {
        const input = api.assessments.create.input.parse(req.body);
        
        const job = await assessmentQueue.add("predict", {
          input,
          userId
        });

        return res.status(202).json({
          message: "Assessment request accepted and is being processed.",
          jobId: job.id
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }
        logger.error({ err }, "Error enqueueing assessment");
        return res.status(500).json({ message: "Failed to queue clinical assessment." });
      }
    }
  );

  app.get("/api/assessments/jobs/:id", requireAuth, requireVerified, async (req, res) => {
    try {
      const job = await assessmentQueue.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      const state = await job.getState();
      if (state === "completed") {
        return res.json({ status: "completed", result: job.returnvalue });
      } else if (state === "failed") {
        return res.status(500).json({ status: "failed", error: job.failedReason });
      } else {
        return res.json({ status: state });
      }
    } catch (err) {
      return res.status(500).json({ message: "Error fetching job status" });
    }
  });`;

content = content.replace(createRegex, replacement + '\n\n');
fs.writeFileSync(routesFile, content);
