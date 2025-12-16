import OpenAI from "openai";
import { getAllMovies, getRawDb } from "./db.ts";
import dotenv from "dotenv";
dotenv.config();

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;


function toBlob(floats: number[]): Buffer {
  const buf = Buffer.alloc(floats.length * 4);
  floats.forEach((f, i) => buf.writeFloatLE(f, i * 4));
  return buf;
}

export function initVectorTable(): void {
  getRawDb().exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS movie_vectors USING vec0(
      movie_id INTEGER PRIMARY KEY,
      embedding float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
    )
  `);
}


export function getEmbeddingCount(): number {
  try {
    const row = getRawDb()
      .prepare("SELECT COUNT(*) as n FROM movie_vectors_rowids")
      .get() as { n: number } | undefined;
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}


export function initEmbeddings(): number {
  try {
    initVectorTable();
    return getEmbeddingCount();
  } catch {
    return 0;
  }
}


async function embedBatch(texts: string[]): Promise<number[][]> {
  // redundant but doing for the sake of simplicity and the scope of this project
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPEN_API_KEY is required to run this project.')
  }

  const openAiclient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  const response = await openAiclient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

function storeEmbedding(movieId: number, embedding: number[]): void {
  getRawDb()
    .prepare("INSERT OR REPLACE INTO movie_vectors (movie_id, embedding) VALUES (?, ?)")
    .run(BigInt(movieId), toBlob(embedding));
}


function buildMovieText(movie: { title: string; overview: string | null; genres: string | null }): string {
  const parts = [movie.title];
  if (movie.overview) parts.push(movie.overview);
  if (movie.genres) {
    try {
      const genreList = JSON.parse(movie.genres) as { name: string }[];
      parts.push(`Genres: ${genreList.map(g => g.name).join(", ")}`);
    } catch {
      parts.push(`Genres: ${movie.genres}`);
    }
  }
  return parts.join(". ");
}


export async function generateAllEmbeddings(): Promise<{ processed: number; skipped: number; failed: number }> {
  initVectorTable();

  const db = getRawDb();
  const movies = getAllMovies();

  // Get movies that already have embeddings
  let existingIds = new Set<number>();
  try {
    const rows = db.prepare("SELECT id FROM movie_vectors_rowids").all() as { id: number }[];
    existingIds = new Set(rows.map(r => r.id));
  } catch {
    // Table doesn't exist yet
  }

  // Filter to movies needing embeddings
  const toProcess = movies.filter(m => m.overview && !existingIds.has(m.movieId));
  const skipped = movies.length - toProcess.length;

  if (toProcess.length === 0) {
    console.log(`All ${movies.length} movies already have embeddings or no overview.`);
    return { processed: 0, skipped, failed: 0 };
  }

  console.log(`Generating embeddings for ${toProcess.length} movies (${skipped} skipped)...\n`);

  let processed = 0;
  let failed = 0;
  const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const texts = batch.map(buildMovieText);
      const embeddings = await embedBatch(texts);

      // Use transaction for faster bulk insert
      db.exec("BEGIN");
      try {
        for (let j = 0; j < batch.length; j++) {
          storeEmbedding(batch[j].movieId, embeddings[j]);
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }

      processed += batch.length;
      const pct = Math.round((processed / toProcess.length) * 100);
      console.log(`  [${batchNum}/${totalBatches}] ${processed}/${toProcess.length} (${pct}%)`);

      // Rate limiting
      if (i + BATCH_SIZE < toProcess.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      failed += batch.length;
      console.error(`  [${batchNum}/${totalBatches}] Failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nDone: ${processed} processed, ${skipped} skipped, ${failed} failed`);
  return { processed, skipped, failed };
}
