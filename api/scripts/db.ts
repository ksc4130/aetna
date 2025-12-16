import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sql, eq, inArray, avg, count, like } from "drizzle-orm";
import path from "path";
import * as schema from "../src/db/schema";
import * as sqliteVec from "sqlite-vec";

const DB_PATH = path.resolve(__dirname, "../../../db/movies.db");

let dbInstance: BetterSQLite3Database<typeof schema> | null = null;
let dbConnection: Database.Database | null = null;

export function getRawDb(): Database.Database {
  if (!dbConnection) {
    dbConnection = new Database(DB_PATH);
    sqliteVec.load(dbConnection);
  }
  return dbConnection;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!dbInstance) {
    getRawDb(); // Ensure connection is created with sqlite-vec loaded
    dbInstance = drizzle(dbConnection!, { schema });
  }
  return dbInstance;
}

export function closeConnections(): void {
  if (dbConnection) {
    dbConnection.close();
    dbConnection = null;
    dbInstance = null;
  }
}

export function initEnrichedAttributesTable(): void {
  const db = getDb();
  db.run(sql`
    CREATE TABLE IF NOT EXISTS enriched_attributes (
      movieId INTEGER PRIMARY KEY REFERENCES movies(movieId),
      sentiment TEXT,
      budgetTier TEXT,
      revenueTier TEXT,
      effectivenessScore REAL,
      targetAudience TEXT,
      enrichedAt INTEGER
    )
  `);
}

export interface MovieWithRatings {
  movieId: number;
  imdbId: string;
  title: string;
  overview: string | null;
  productionCompanies: string | null;
  releaseDate: string | null;
  budget: number | null;
  revenue: number | null;
  runtime: number | null;
  language: string | null;
  genres: string | null;
  status: string | null;
  avgRating: number | null;
  ratingCount: number;
}

export async function getSampleMoviesWithRatings(
  limit: number = 80
): Promise<MovieWithRatings[]> {
  const db = getDb();

  const results = db
    .select({
      movieId: schema.movies.movieId,
      imdbId: schema.movies.imdbId,
      title: schema.movies.title,
      overview: schema.movies.overview,
      productionCompanies: schema.movies.productionCompanies,
      releaseDate: schema.movies.releaseDate,
      budget: schema.movies.budget,
      revenue: schema.movies.revenue,
      runtime: schema.movies.runtime,
      language: schema.movies.language,
      genres: schema.movies.genres,
      status: schema.movies.status,
      avgRating: sql<number>`AVG(${schema.ratings.rating})`,
      ratingCount: sql<number>`COUNT(${schema.ratings.rating})`,
    })
    .from(schema.movies)
    .leftJoin(schema.ratings, eq(schema.movies.movieId, schema.ratings.movieId))
    .groupBy(schema.movies.movieId)
    .orderBy(sql`COUNT(${schema.ratings.rating}) DESC`)
    .limit(limit)
    .all();

  return results.map((r) => ({
    movieId: r.movieId,
    imdbId: r.imdbId,
    title: r.title,
    overview: r.overview,
    productionCompanies: r.productionCompanies,
    releaseDate: r.releaseDate,
    budget: r.budget,
    revenue: r.revenue,
    runtime: r.runtime,
    language: r.language,
    genres: r.genres,
    status: r.status,
    avgRating: r.avgRating,
    ratingCount: r.ratingCount ?? 0,
  }));
}

export function getMovieById(movieId: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.movies)
    .leftJoin(
      schema.enrichedAttributes,
      eq(schema.movies.movieId, schema.enrichedAttributes.movieId)
    )
    .where(eq(schema.movies.movieId, movieId))
    .get();
}

export function getUserRatings(userId: number) {
  const db = getDb();

  return db
    .select({
      ratingId: schema.ratings.ratingId,
      userId: schema.ratings.userId,
      movieId: schema.ratings.movieId,
      rating: schema.ratings.rating,
      timestamp: schema.ratings.timestamp,
      movie: {
        movieId: schema.movies.movieId,
        imdbId: schema.movies.imdbId,
        title: schema.movies.title,
        overview: schema.movies.overview,
        productionCompanies: schema.movies.productionCompanies,
        releaseDate: schema.movies.releaseDate,
        budget: schema.movies.budget,
        revenue: schema.movies.revenue,
        runtime: schema.movies.runtime,
        language: schema.movies.language,
        genres: schema.movies.genres,
        status: schema.movies.status,
      },
    })
    .from(schema.ratings)
    .leftJoin(schema.movies, eq(schema.ratings.movieId, schema.movies.movieId))
    .where(eq(schema.ratings.userId, userId))
    .all();
}

export function getAllUserIds(): number[] {
  const db = getDb();
  const result = db
    .selectDistinct({ userId: schema.ratings.userId })
    .from(schema.ratings)
    .all();
  return result.map((r) => r.userId);
}


export function getAllMovies(limit?: number): schema.Movie[] {
  const db = getDb();
  const query = db.select().from(schema.movies);
  if (limit) {
    return query.limit(limit).all();
  }
  return query.all();
}

export function getMoviesByIds(movieIds: number[]) {
  if (movieIds.length === 0) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.movies)
    .where(inArray(schema.movies.movieId, movieIds))
    .all();
}

export function getEnrichedAttributeByMovieId(movieId: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.enrichedAttributes)
    .where(eq(schema.enrichedAttributes.movieId, movieId))
    .get();
}

export function saveEnrichedAttribute(
  movieId: number,
  attributes: {
    sentiment: string;
    budgetTier: string;
    revenueTier: string;
    effectivenessScore: number;
    targetAudience: string;
  }
): void {
  const db = getDb();
  db.insert(schema.enrichedAttributes)
    .values({
      movieId,
      sentiment: attributes.sentiment,
      budgetTier: attributes.budgetTier,
      revenueTier: attributes.revenueTier,
      effectivenessScore: attributes.effectivenessScore,
      targetAudience: attributes.targetAudience,
      enrichedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: schema.enrichedAttributes.movieId,
      set: {
        sentiment: attributes.sentiment,
        budgetTier: attributes.budgetTier,
        revenueTier: attributes.revenueTier,
        effectivenessScore: attributes.effectivenessScore,
        targetAudience: attributes.targetAudience,
        enrichedAt: Date.now(),
      },
    })
    .run();
}
