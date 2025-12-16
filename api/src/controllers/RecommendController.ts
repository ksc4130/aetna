import { Controller, Get, Post } from "@tsed/common";
import { Inject } from "@tsed/di";
import { BodyParams } from "@tsed/platform-params";
import { BadRequest } from "@tsed/exceptions";
import { Description, Returns, Summary } from "@tsed/schema";
import { GuardrailService } from "../services/GuardrailService";
import { MoviesService, MovieWithRatingsAndEnrichment } from "../services/MoviesService";
import { OpenAiService } from "../services/OpenAiService";
import { MAX_QUERY_LENGTH } from "../config";

interface RecommendRequestDto {
  query: string;
  limit?: number;
}

interface EnrichedAttributes {
  sentiment: string | null;
  budgetTier: string | null;
  revenueTier: string | null;
  effectivenessScore: number | null;
  targetAudience: string | null;
}

interface RecommendResponse {
  recommendations: MovieWithRatingsAndEnrichment[];
  reasoning: string;
  enhancedQuery?: string;
}

interface MovieListItem {
  movieId: number;
  title: string;
  genres: string | null;
  releaseDate: string | null;
  avgRating: number | null;
  ratingCount: number;
}

@Controller("/recommend")
export class RecommendController {
  @Inject()
  private guardrailService!: GuardrailService;
  @Inject()
  private moviesService!: MoviesService;
  @Inject()
  private openAiService!: OpenAiService;


  @Post("/")
  @Summary("Get movie recommendations")
  @Description("Get movie recommendations based on natural language query")
  @Returns(200, Object)
  @Returns(400, BadRequest)
  async getRecommendations(@BodyParams() body: RecommendRequestDto): Promise<RecommendResponse> {
    const { query, limit = 50 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new BadRequest("Query parameter is required and must be a non-empty string");
    }

    if (query.length > MAX_QUERY_LENGTH) {
      throw new BadRequest(`Query too long. Maximum ${MAX_QUERY_LENGTH} characters allowed.`);
    }

    let moviesWithData: MovieWithRatingsAndEnrichment[] = [];
    let enhancedQuery: string | undefined;

    try {
      const searchResult = await this.moviesService.searchSimilar(query, 50);
      const similarMovies = searchResult.results;
      enhancedQuery = searchResult.enhancedQuery;

      if (similarMovies.length > 0) {
        moviesWithData = similarMovies.map(
          (sim) => this.moviesService.getMovieWithRatingsAndEnrichment(sim.movieId)
        ).filter(m => m != null);
      }
      else {
        return {
          reasoning: 'No movies were found with provided query.',
          recommendations: []
        };
      }

    } catch (error) {
      console.error("Embedding search failed:", error);
    }

    // Get LLM recommendations
    const llmResult = await this.openAiService.getRecommendations(
      query,
      moviesWithData,
      Math.min(limit, 10)
    );

    const recommendations = llmResult.recommendations.map(
      (sim) => {
        
        const enrichedMovie = this.moviesService.getMovieWithRatingsAndEnrichment(sim.movieId);
        return {
          matchScore: sim.matchScore,
          matchReason: sim.matchReason,
          ...enrichedMovie! // assuming we have the data for movie per validation and scope of project
        };
      }
    );

    recommendations.filter((r) => !r.enrichmentAttributes)
      .forEach(async r => {
        const ea = await this.openAiService.getEnrichmentForMovie({
          title: r.title,
          avgRating: r.avgRating,
          budget: r.budget,
          genres: r.genres,
          overview: r.overview,
          revenue: r.revenue
        });
        this.moviesService.saveEnrichedAttribute(r.movieId, ea);
        r.enrichmentAttributes = ea;
      });

    return {
      recommendations,
      reasoning: llmResult.reasoning,
      enhancedQuery: enhancedQuery !== query ? enhancedQuery : undefined,
    };
  }

  @Get("/movies")
  @Summary("List available movies")
  @Description("Get a list of available movies with ratings")
  @Returns(200, Object)
  async getMovies(): Promise<{ movies: MovieListItem[] }> {
    const movies = await this.moviesService.getSampleMoviesWithRatings(100);
    return {
      movies: movies.map((m) => ({
        movieId: m.movieId,
        title: m.title,
        genres: m.genres,
        releaseDate: m.releaseDate,
        avgRating: m.avgRating,
        ratingCount: m.ratingCount,
      })),
    };
  }
}
