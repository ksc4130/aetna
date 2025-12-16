import { Injectable, ProviderScope } from "@tsed/di";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from '../db/schema';
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { sql, eq, inArray, avg, count, like } from "drizzle-orm";


@Injectable({
  scope: ProviderScope.SINGLETON
})
export class DatabaseService {
    private readonly DB_PATH = path.resolve(__dirname, "../../../db/movies.db");

    private dbInstance: BetterSQLite3Database<typeof schema> | null = null;
    private dbConnection: Database.Database | null = null;

    getRawDb(): Database.Database {
        if (!this.dbConnection) {
            this.dbConnection = new Database(this.DB_PATH);
            sqliteVec.load(this.dbConnection);
        }
        return this.dbConnection;
    }

    getDb(): BetterSQLite3Database<typeof schema> {
        if (!this.dbInstance) {
            this.getRawDb();
            this.dbInstance = drizzle(this.dbConnection!, { schema });
        }
        return this.dbInstance;
    }

    closeConnections(): void {
        if (this.dbConnection) {
            this.dbConnection.close();
            this.dbConnection = null;
            this.dbInstance = null;
        }
    }

    initEnrichedAttributesTable(): void {
      const db = this.getDb();
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

   getMovieById(movieId: number) {
     const db = this.getDb();
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

   getUserRatings(userId: number) {
     const db = this.getDb();
   
     // Use JOIN to get ratings with movie info in a single query
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

   getAllUserIds(): number[] {
     const db = this.getDb();
     const result = db
       .selectDistinct({ userId: schema.ratings.userId })
       .from(schema.ratings)
       .all();
     return result.map((r) => r.userId);
   }

   getAllMovies(limit?: number) {
     const db = this.getDb();
     const query = db.select().from(schema.movies);
     if (limit) {
       return query.limit(limit).all();
     }
     return query.all();
   }

   getEnrichedAttributeByMovieId(movieId: number) {
     const db = this.getDb();
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
     const db = this.getDb();
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

   getMovieWithRatings(movieId: number) {
     const db = this.getDb();
     return db
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
       .where(eq(schema.movies.movieId, movieId))
       .groupBy(schema.movies.movieId)
       .get();
   }
}