import { Inject, Injectable } from "@tsed/di";
import { DatabaseService } from "./DatabaseService";
import { OpenAiService } from "./OpenAiService";
import { inArray, sql, eq } from "drizzle-orm";
import * as schema from '../db/schema';
import { buildIgnoreLog } from "@tsed/common";
import { EMBEDDING_MODEL } from "../config";

export interface MovieWithRatingsAndEnrichment {
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
    enrichmentAttributes?: {
        sentiment: string | null,
        budgetTier: string | null,
        revenueTier: string | null,
        effectivenessScore: number | null,
        targetAudience: string | null
    }
}

@Injectable()
export class MoviesService {
    
    @Inject()
    private databaseService!: DatabaseService; // DI hanlde this using !
    @Inject()
    private openAiService!: OpenAiService; // DI handles this using !

    toBlob(floats: number[]): Buffer {
        const buf = Buffer.alloc(floats.length * 4);
        floats.forEach((f, i) => buf.writeFloatLE(f, i * 4));
        return buf;
    }

    async embed(text: string): Promise<number[]> {
        const response = await this.openAiService.getOpenAIClient().embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
        });
        return response.data[0].embedding;
    }

    getEmbeddingCount(): number {
        try {
            const row = this.databaseService.getRawDb()
                .prepare("SELECT COUNT(*) as n FROM movie_vectors_rowids")
                .get() as { n: number } | undefined;
            return row?.n ?? 0;
        } catch {
            return 0;
        }
    }

    async searchSimilar(
        query: string,
        limit: number = 50
    ): Promise<{ results: { movieId: number; score: number }[]; enhancedQuery: string }> {
        const count = this.getEmbeddingCount();
        if (count === 0) return { results: [], enhancedQuery: query };

        // Enhance query for better semantic matching
        const enhancedQuery = await this.openAiService.enhanceSearchQuery(query);
        const queryVector = await this.embed(enhancedQuery);
        const dbResults = this.databaseService.getRawDb()
            .prepare(`
      SELECT movie_id, distance
      FROM movie_vectors
      WHERE embedding MATCH ? AND k = ?
    `)
            .all(this.toBlob(queryVector), limit) as { movie_id: number; distance: number }[];

        return {
            results: dbResults.map(r => ({
                movieId: r.movie_id,
                score: 1 - r.distance / 2
            })),
            enhancedQuery
        };
    }

    getMoviesByIds(movieIds: number[]) {
        if (movieIds.length === 0) return [];
        const db = this.databaseService.getDb();
        return db
            .select()
            .from(schema.movies)
            .where(inArray(schema.movies.movieId, movieIds))
            .all();
    }

    getEnrichedAttributeByMovieId(movieId: number) {
        const db = this.databaseService.getDb();
        return db
            .select()
            .from(schema.enrichedAttributes)
            .where(eq(schema.enrichedAttributes.movieId, movieId))
            .get();
    }

    saveEnrichedAttribute(
        movieId: number,
        attributes: {
            sentiment: string;
            budgetTier: string;
            revenueTier: string;
            effectivenessScore: number;
            targetAudience: string;
        }
    ): void {
        const db = this.databaseService.getDb();
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

    async getSampleMoviesWithRatings(
        limit: number = 80
    ): Promise<MovieWithRatingsAndEnrichment[]> {
        const db = this.databaseService.getDb();

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
                sentiment: schema.enrichedAttributes.sentiment,
                budgetTier: schema.enrichedAttributes.budgetTier,
                revenueTier: schema.enrichedAttributes.revenueTier,
                effectivenessScore: schema.enrichedAttributes.effectivenessScore,
                targetAudience: schema.enrichedAttributes.targetAudience
            })
            .from(schema.movies)
            .leftJoin(schema.ratings, eq(schema.movies.movieId, schema.ratings.movieId))
            .leftJoin(schema.enrichedAttributes, eq(schema.movies.movieId, schema.enrichedAttributes.movieId))
            .groupBy(schema.movies.movieId)
            .orderBy(sql`COUNT(${schema.ratings.rating}) DESC`)
            .limit(limit)
            .all();

        return results.map((movie) => ({
            movieId: movie.movieId,
            imdbId: movie.imdbId || "",
            title: movie.title || "Unknown",
            overview: movie.overview,
            productionCompanies: movie.productionCompanies,
            releaseDate: movie.releaseDate,
            budget: movie.budget,
            revenue: movie.revenue,
            runtime: movie.runtime,
            language: movie.language,
            genres: movie.genres,
            status: movie.status,
            avgRating: movie.avgRating,
            ratingCount: movie.ratingCount ?? 0,
            enrichmentAttributes: {
                sentiment: movie.sentiment,
                budgetTier: movie.budgetTier,
                revenueTier: movie.revenueTier,
                effectivenessScore: movie.effectivenessScore,
                targetAudience: movie.targetAudience
            }
        }));
    }

    getMovieWithRatingsAndEnrichment(movieId: number): MovieWithRatingsAndEnrichment | null {
        const db = this.databaseService.getDb();
        const movie = db
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
                sentiment: schema.enrichedAttributes.sentiment,
                budgetTier: schema.enrichedAttributes.budgetTier,
                revenueTier: schema.enrichedAttributes.revenueTier,
                effectivenessScore: schema.enrichedAttributes.effectivenessScore,
                targetAudience: schema.enrichedAttributes.targetAudience
            })
            .from(schema.movies)
            .leftJoin(schema.ratings, eq(schema.movies.movieId, schema.ratings.movieId))
            .leftJoin(schema.enrichedAttributes, eq(schema.movies.movieId, schema.enrichedAttributes.movieId))
            .where(eq(schema.movies.movieId, movieId))
            .groupBy(schema.movies.movieId)
            .get();



        if (!movie) {
            return null;
        }

        return {
            movieId: movie.movieId,
            imdbId: movie.imdbId || "",
            title: movie.title || "Unknown",
            overview: movie.overview,
            productionCompanies: movie.productionCompanies,
            releaseDate: movie.releaseDate,
            budget: movie.budget,
            revenue: movie.revenue,
            runtime: movie.runtime,
            language: movie.language,
            genres: movie.genres,
            status: movie.status,
            avgRating: movie.avgRating,
            ratingCount: movie.ratingCount ?? 0,
            enrichmentAttributes: {
                sentiment: movie.sentiment,
                budgetTier: movie.budgetTier,
                revenueTier: movie.revenueTier,
                effectivenessScore: movie.effectivenessScore,
                targetAudience: movie.targetAudience
            }
        }
    }

}