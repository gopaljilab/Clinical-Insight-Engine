#!/bin/bash
gh issue create -R gopaljilab/Clinical-Insight-Engine --title "[CRITICAL] Remote Code Execution Risk in CSV Upload/Processing Pipeline" --body "### Summary
The system currently parses user-uploaded or externally sourced CSV files (\`analyze.py\` and \`services/safe_csv_reader.py\`) without strict sanitization against CSV Injection (Formula Injection) or potentially unsafe deserialization via pandas. 

### Impact
If a malicious CSV file is processed, it can lead to arbitrary code execution, unauthorized data exfiltration, or complete system compromise. This is a severe security vulnerability.

### Suggested Mitigation
- Implement strict validation and sanitization of CSV headers and cell content.
- Restrict pandas \`read_csv\` capabilities or use sandboxed environments.
- Apply security linters (e.g., Bandit) in CI/CD pipelines to prevent insecure parser configurations.

*Reported by @atul-upadhyay-7*"

gh issue create -R gopaljilab/Clinical-Insight-Engine --title "[CRITICAL] Root Privilege Escalation Risk in Docker Container Configuration" --body "### Summary
The current \`Dockerfile\` deployment configurations run containerized processes as the \`root\` user rather than utilizing a least-privilege, non-root user approach.

### Impact
If an attacker compromises the application layer (e.g., via a dependency vulnerability), they will inherit root privileges within the container, drastically increasing the likelihood of container escape and host system compromise.

### Suggested Mitigation
- Add a \`USER\` directive to the \`Dockerfile\` to create and switch to an unprivileged application user.
- Ensure file permissions (e.g., for \`node_modules\` or Python dependencies) are correctly locked down.
- Implement security context constraints in orchestration.

*Reported by @atul-upadhyay-7*"

gh issue create -R gopaljilab/Clinical-Insight-Engine --title "[CRITICAL] Lack of Rate Limiting and DoS Protection on Public API Endpoints" --body "### Summary
Public-facing server endpoints (in \`server/routes/\`) lack implementation of rate-limiting, request throttling, or comprehensive payload size validation mechanisms.

### Impact
The application is vulnerable to Denial of Service (DoS), brute-force attacks, and server resource exhaustion. Attackers can quickly overwhelm the server or attempt massive automated scraping.

### Suggested Mitigation
- Implement standard rate-limiting middleware (e.g., \`express-rate-limit\` or equivalent).
- Add strict payload size limits to backend controllers.
- Configure WAF rules in the deployment environment.

*Reported by @atul-upadhyay-7*"

gh issue create -R gopaljilab/Clinical-Insight-Engine --title "[CRITICAL] Hardcoded or Unencrypted Secrets Exposure Risk in CI/CD and Container Environment" --body "### Summary
There is a high risk of sensitive environment variables or secrets being improperly managed within the deployment pipeline and Docker environment (\`docker-compose.yml\` and \`.env.example\`). The application lacks integration with a secure secrets management solution (e.g., AWS Secrets Manager, HashiCorp Vault).

### Impact
Accidental exposure of secrets in the Docker context, environment configurations, or source code can lead to immediate and total compromise of database systems and external API keys.

### Suggested Mitigation
- Integrate a robust secrets management tool.
- Remove any static environment configuration relying on local or unencrypted \`.env\` files for production.
- Add automated secret-scanning (e.g., TruffleHog, GitGuardian) to GitHub Actions.

*Reported by @atul-upadhyay-7*"
