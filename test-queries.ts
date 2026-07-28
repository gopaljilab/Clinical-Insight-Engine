import { getDb } from "./server/db";
import { sql } from "drizzle-orm";
import { assessments } from "./shared/schema";

async function main() {
  const db = getDb();
  
  const factorsResult = await db.execute(sql`
    SELECT 
      f->>'name' as factor, 
      COUNT(*)::int as count
    FROM ${assessments}, jsonb_array_elements(${assessments.factors}) f
    GROUP BY f->>'name'
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log("factorsResult", factorsResult);

  const genderDistResult = await db.execute(sql`
    SELECT 
      ${assessments.gender} as gender,
      ${assessments.riskCategory} as "riskCategory",
      COUNT(*)::int as count
    FROM ${assessments}
    GROUP BY ${assessments.gender}, ${assessments.riskCategory}
  `);
  console.log("genderDistResult", genderDistResult);

  const ageDistResult = await db.execute(sql`
    SELECT 
      CASE 
        WHEN ${assessments.age} < 40 THEN '< 40'
        WHEN ${assessments.age} BETWEEN 40 AND 60 THEN '40-60'
        ELSE '> 60'
      END as "ageGroup",
      ${assessments.riskCategory} as "riskCategory",
      COUNT(*)::int as count
    FROM ${assessments}
    GROUP BY "ageGroup", ${assessments.riskCategory}
  `);
  console.log("ageDistResult", ageDistResult);
}

main().catch(console.error);
