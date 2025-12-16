// spun update with claude 

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Movies table schema (from movies.db)
export const movies = sqliteTable("movies", {
  movieId: integer("movieId").primaryKey(),
  imdbId: text("imdbId").notNull(),
  title: text("title").notNull(),
  overview: text("overview"),
  productionCompanies: text("productionCompanies"), // JSON string
  releaseDate: text("releaseDate"),
  budget: integer("budget"),
  revenue: integer("revenue"),
  runtime: real("runtime"),
  language: text("language"),
  genres: text("genres"), // JSON string like [{"id": 28, "name": "Action"}]
  status: text("status"),
});

// Ratings table schema (now in movies.db after consolidation)
export const ratings = sqliteTable("ratings", {
  ratingId: integer("ratingId").primaryKey(),
  userId: integer("userId").notNull(),
  movieId: integer("movieId").notNull(),
  rating: real("rating").notNull(), // 0-5
  timestamp: integer("timestamp").notNull(),
});

// Enriched attributes table (to be added to movies.db)
// Uses movieId as PK since this is a 1:1 extension of the movies table
// Each movie can have at most one enrichment record
export const enrichedAttributes = sqliteTable("enriched_attributes", {
  movieId: integer("movieId").primaryKey().references(() => movies.movieId),
  sentiment: text("sentiment"), // positive/neutral/negative
  budgetTier: text("budgetTier"), // low/medium/high/blockbuster
  revenueTier: text("revenueTier"), // flop/moderate/success/blockbuster
  effectivenessScore: real("effectivenessScore"), // 0-100
  targetAudience: text("targetAudience"), // description of target audience
  enrichedAt: integer("enrichedAt"), // timestamp when enriched
});

// Type exports for use in application
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;

export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;

export type EnrichedAttribute = typeof enrichedAttributes.$inferSelect;
export type NewEnrichedAttribute = typeof enrichedAttributes.$inferInsert;
