import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const rootDirectory = process.cwd();
for (const fileName of [".env.local", ".env.development.local"]) {
  dotenv.config({ path: path.join(rootDirectory, fileName), override: false });
}

const resourceDirectory = path.join(
  rootDirectory,
  "public",
  "resource",
  "jlpt",
);
const levels = ["n5", "n4", "n3", "n2", "n1"];
const batchSize = 500;

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function loadRows() {
  const rows = [];
  for (const level of levels) {
    const filePath = path.join(resourceDirectory, `${level}.json`);
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!Array.isArray(data.cards)) {
      throw new Error(`${filePath} does not contain a cards array`);
    }

    data.cards.forEach((card, index) => {
      if (
        typeof card.question !== "string" ||
        typeof card.meaning !== "string" ||
        !Array.isArray(card.answer) ||
        card.answer.length === 0 ||
        card.answer.some((reading) => typeof reading !== "string")
      ) {
        throw new Error(`Invalid card at ${level}.json row ${index + 1}`);
      }
      rows.push({
        id: `${level}_${String(index + 1).padStart(4, "0")}`,
        kanji: card.question,
        deck_id: `jlpt-${level}`,
        meaning: card.meaning,
        reading: card.answer,
      });
    });
  }
  return rows;
}

async function main() {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const supabaseKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const tableName = "cards";
  const rows = await loadRows();
  if (rows.length === 0)
    throw new Error("No cards found in the JLPT JSON files");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: "id" });
    if (error)
      throw new Error(
        `Supabase upsert failed for rows ${start + 1}-${start + batch.length}: ${error.message}`,
      );
    console.log(`Upserted ${start + batch.length}/${rows.length} rows`);
  }

  console.log(`Finished syncing ${rows.length} rows to ${tableName}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
