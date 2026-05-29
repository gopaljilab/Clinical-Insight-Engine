import { Client } from "@elastic/elasticsearch";

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY || "api-key"
  }
});

export const indexMedicalDocument = async (id: string, doc: any) => {
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
