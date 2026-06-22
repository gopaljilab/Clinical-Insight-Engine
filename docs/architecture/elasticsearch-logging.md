# Elasticsearch Logging Architecture

## Overview
While the Node.js application outputs JSON logs to `stdout`, enterprise deployments route these logs into an ELK (Elasticsearch, Logstash, Kibana) stack for long-term retention and anomaly detection.

## Architecture Pipeline
1. **Application Layer:** Express backend uses Winston to format logs as structured JSON.
2. **Shipper (Filebeat/Fluentd):** Runs as a sidecar container, scraping `stdout` and forwarding to Logstash.
3. **Logstash:** Filters logs, applies secondary PII redaction if necessary, and structures indices by date.
4. **Elasticsearch:** Indexes the logs for fast retrieval.
5. **Kibana:** Provides operational dashboards (e.g., API error rates, model inference latency, auth failures).

## Monitoring Alerts
We configure Kibana alerts to trigger PagerDuty if:
- Endpoint 500 Error rate exceeds 2% over a 5-minute window.
- ML Service latency exceeds 3000ms.
- Anomalous spikes in 401/403 Unauthorized events occur.
