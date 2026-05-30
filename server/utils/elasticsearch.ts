import { Client } from "@elastic/elasticsearch";

const { ELASTICSEARCH_URL, ELASTICSEARCH_API_KEY } = process.env;

let esClient: Client | null = null;

if (!ELASTICSEARCH_URL || !ELASTICSEARCH_API_KEY) {
  console.error(
    "Elasticsearch is disabled: ELASTICSEARCH_URL and ELASTICSEARCH_API_KEY must be set."
  );
} else {
  esClient = new Client({
    node: ELASTICSEARCH_URL,
    auth: {
      apiKey: ELASTICSEARCH_API_KEY
    }
  });
}

export const indexMedicalDocument = async (id: string, doc: any) => {
  if (!esClient) {
    console.error("Elasticsearch indexing skipped: client is not configured.");
    return;
  }
  try {
    await esClient.index({
      index: "medical_records",
      id: id,
      document: doc
    });
  } catch (err) {
    console.error("Elasticsearch indexing error:", err);
  }
};

export const searchMedicalDocuments = async (queryText: string) => {
  if (!esClient) {
    console.error("Elasticsearch search skipped: client is not configured.");
    return [];
  }
  try {
    const result = await esClient.search({
      index: "medical_records",
      query: {
        multi_match: {
          query: queryText,
          fields: ["symptoms", "diagnosis", "recommendations"],
          fuzziness: "AUTO"
        }
      }
    });
    return result.hits.hits;
  } catch (err) {
    console.error("Elasticsearch search error:", err);
    return [];
  }
};
