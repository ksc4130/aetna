import { generateAllEmbeddings, initEmbeddings } from "./embeddings.ts";
import { closeConnections } from "./db.ts";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Movie Embedding Generation Script\n");
  console.log("=".repeat(50));

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not found in environment variables.");
    process.exit(1);
  }

  // Check existing embeddings
  const existingCount = initEmbeddings();
  console.log(`Existing embeddings: ${existingCount}`);

  // Generate embeddings for movies that don't have them
  await generateAllEmbeddings();

  console.log("\n" + "=".repeat(50));
  console.log("Embedding generation complete!");

  closeConnections();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  closeConnections();
  process.exit(1);
});
