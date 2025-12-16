import OpenAI from "openai";
import { Inject, Injectable } from "@tsed/di";
import { GuardrailService, RecommendationOutput } from "./GuardrailService";
import { MAX_COMPARISON_TOKENS, MAX_ENRICHMENT_TOKENS, MAX_MOVIES_FOR_RECOMMEND_CONTEXT, MAX_QUERY_ENHANCE_TOKENS, MAX_RATING_SUMMARY_TOKENS, MAX_RECOMMENDATION_TOKENS, MAX_TARGET_AUDIENCE_LENGTH, MODEL_FULL, MODEL_MINI } from "../config";


export interface MovieWithEnrichment {
  movieId: number;
  title: string;
  overview: string | null;
  genres: string | null;
  releaseDate: string | null;
  budget: number | null;
  revenue: number | null;
  avgRating: number | null;
  enrichedAttributes?: {
    sentiment: string | null;
    budgetTier: string | null;
    revenueTier: string | null;
    effectivenessScore: number | null;
    targetAudience: string | null;
  };
}

export interface MovieEnrichmentRequest {
    title: string;
    overview: string | null;
    genres: string | null;
    budget: number | null;
    revenue: number | null;
    avgRating: number | null;
}

export interface MovieEnrichmentReponse {
    sentiment: string;
    budgetTier: string;
    revenueTier: string;
    effectivenessScore: number;
    targetAudience: string;
}

export interface UserRatingRecord {
    title: string;
    rating: number;
    genres: string | null;
    overview: string | null;
    releaseDate: string | null;
    budget: number | null;
}

export interface SummarizeUserPreferencesResponse {
    summary: string;
    favoriteGenres: string[];
    likesBigBudget: boolean;
    prefersClassics: boolean;
}

export interface CompareMovieRequest {
    movieId: number;
    title: string;
    overview: string | null;
    genres: string | null;
    budget: number | null;
    revenue: number | null;
    runtime: number | null;
    avgRating: number | null;
    releaseDate: string | null;
}

export interface CompareMovieResponse {
    comparison: string;
    winner?: {
        movieId: number;
        title: string;
        reason: string;
    }
}

@Injectable()
export class OpenAiService {
    private openAiclient: OpenAI;


    @Inject()
    private readonly guardrailService!: GuardrailService; // handled by tsed's DI using !

    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPEN_API_KEY is required to run this project.')
        }

        this.openAiclient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    getOpenAIClient() {
        return this.openAiclient;
    }

    async getModelsList() {
        return await this.openAiclient.models.list();
    }

    async chatCompletion(
        systemPrompt: string,
        userPrompt: string,
        options: {
            model?: string,
            temperature?: number,
            maxTokens?: number,
            responseFormat?: 'text' | 'json_object'
        } = {}
    ) {
        const {
            model = MODEL_MINI,
            temperature = 0.7,
            maxTokens = 2000,
            responseFormat = 'text'
        } = options;

        const maxRetries = 3;
        let lastError: Error | null = null;
        // Newer models have different parameter requirements
        const isNewerModel = model.includes('gpt-5') || model.includes('01') || model.includes('o3');

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.openAiclient.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    ... (isNewerModel ? {} : { temperature }),
                    ... (isNewerModel
                        ? { max_completion_tokens: maxTokens }
                        : { max_tokens: maxTokens }
                    ),
                    response_format: { type: responseFormat }
                });

                const content = response.choices[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty response from openAI');
                }

                return content;
            } catch (err) {
                lastError = err as Error;
                console.error(`OpenAI API attempt ${attempt} failed: ${err}`);

                if (attempt < maxRetries) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
        }

        throw lastError || new Error("OpenAI API request failed after retries");
    }

    parseJsonResponse<T>(response: string): T {
        try {
            return JSON.parse(response) as T;
        } catch (err) {
            console.log(`Failed to parse JSON response: ${response}`);
            throw new Error(`Invalid JSON response from LLM: ${err}`);
        }
    }

    async getEnrichmentForMovie(movieData: MovieEnrichmentRequest): Promise<MovieEnrichmentReponse> {
        const systemPrompt = `You are a movie analyst. Analyze the given movie data and provide enriched attributes.
            Return a JSON object with exactly these fields:
            - sentiment: "positive", "neutral", or "negative" based on the movie overview tone
            - budgetTier: "low" (under $10M), "medium" ($10M to under $50M), "high" ($50M-$150M), "blockbuster" (over $150M)
            - revenueTier: "flop" (revenue < budget), "moderate" (revenue=1-2x the budget), "success" (revenue=2-5x the budget), or "blockbuster" (revenue=5x+ the budget or over $500M)
            - effectivenessScore: 0-100 score based on ROI, ratings, and critival reception
            // - targetAudience: A brif description of the ideal target audience (max ${MAX_TARGET_AUDIENCE_LENGTH} characters)

            Be analytical and consistent in your assessments.`;

        const userPrompt = `Analyze this movie:
            Title: ${movieData.title}
            Overview: ${movieData.overview}
            Genres: ${movieData.genres || "Unknown"}
            Budget: ${movieData.budget ? `$${movieData.budget.toLocaleString()}` : "Unknown"}
            Revenue: ${movieData.revenue ? `$${movieData.revenue.toLocaleString()}` : "Unknown"}
            Average Rating: ${movieData.avgRating?.toFixed(2) || "Unknown"}/5`

        const response = await this.chatCompletion(systemPrompt, userPrompt, {
            model: MODEL_FULL,
            temperature: 0.3,
            responseFormat: 'json_object',
            maxTokens: MAX_ENRICHMENT_TOKENS
        });

        const parsedResp = this.parseJsonResponse(response);

        const validated = this.guardrailService.validateEnrichmentOutput(parsedResp);
        if (!validated.valid) {
            console.warn('Enrichment validation errors: ', validated.errors);
            throw new Error(`Invalid enrichment output: ${validated.errors.join(", ")}`);
        }

        // if valid there will be data using !
        return validated.data!;
    }

    async getRecommendations(
        query: string,
        availableMovies: MovieWithEnrichment[],
        limit: number = 5
    ): Promise<RecommendationOutput> {
        console.log('available movie in recommendation', availableMovies.length);
        const sanitized = this.guardrailService.sanitizeInput(query);

        if (sanitized.blocked) {
            console.warn(`Query blocked: ${sanitized.reason}`);
            return { recommendations: [], reasoning: 'Query could not be processed.' };
        }

        const safeQuery = sanitized.sanitized;

        const baseSystemPrompt = `You are a movie recommendation expert. Given a user's query and a list of available movies, select the best matches.
            Return a JSON object with:
            - recommendations: array of objects with:
                - movieId (number)
                - matchScore (0-100 integer)
                - matchReason (brief explanation)
            - reasoning: overall explanation of your selection criteria

            Guidelines:
            - Base matchScore on relevance to the user's query, considering genre, themes, tone, ratings, and release date.
            - Prefer higher-rated and better-aligned movies, but prioritize relevance over popularity.
            - Always return matchScore as an integer between 0 and 100.
            - Do not output NaN or Infinity.

            Constraints:
            - Only recommend movies from the provided list.
            - Do not invent movies or fields.
            - Return valid JSON only (no markdown, no extra text).

            Return at most ${limit} recommendations.`;

        const systemPrompt = this.guardrailService.hardenSystemPrompt(baseSystemPrompt);

        const moviesContext = availableMovies
            .slice(0, MAX_MOVIES_FOR_RECOMMEND_CONTEXT)
            .map(m => {
                let line = `ID:${m.movieId} "${m.title}" (${m.releaseDate?.slice(0, 4) || "N/A"}) - ${m.genres || "Unknown gerne"} - Rating: ${m.avgRating?.toFixed(1) || "N/A"}/5`;

                if (m.budget) {
                    line += ` - Budget: $${(m.budget / 1000000).toFixed(0)}M`;
                }

                if (m.revenue) {
                    line += ` - Revenue: $${(m.revenue / 1000000).toFixed(0)}M`;
                }

                if (m.enrichedAttributes) {
                    const enrichmentParts: string[] = [];

                    if (m.enrichedAttributes.sentiment) {
                        enrichmentParts.push(`Tone: ${m.enrichedAttributes.sentiment}`);
                    }

                    if (m.enrichedAttributes.budgetTier) {
                        enrichmentParts.push(`Budget: ${m.enrichedAttributes.budgetTier}`);
                    }

                    if (m.enrichedAttributes.effectivenessScore) {
                        enrichmentParts.push(`Effectiveness: ${m.enrichedAttributes.effectivenessScore}`);
                    }

                    if (m.enrichedAttributes.targetAudience) {
                        enrichmentParts.push(`Audience: ${m.enrichedAttributes.targetAudience}`);
                    }

                    if (enrichmentParts.length > 0) {
                        line += ` [${enrichmentParts.join(', ')}]`;
                    }
                }

                line += ` - ${m.overview?.slice(0, 100) || 'No description'}...`;
                return line;
            }).join('\n');

        const userPrompt = `User query: ${this.guardrailService.wrapUserInput(safeQuery)}
            
                Available movies:
                ${moviesContext}

                Select the best matching movies for this query.`;

        const response = await this.chatCompletion(systemPrompt, userPrompt, {
            model: MODEL_FULL,
            temperature: 0.5,
            maxTokens: MAX_RECOMMENDATION_TOKENS,
            responseFormat: 'json_object'
        });

        console.log('llm recommendation response', response);

        const parsed = this.parseJsonResponse(response);
        console.log('recommendations parsed', parsed)

        const validMovieIds = availableMovies.map(m => m.movieId);
        const validated = this.guardrailService.validateRecommendationOutput(parsed, validMovieIds);

        if (!validated.valid) {
            console.warn('Recommendation validation error:', validated.errors);
            return { recommendations: [], reasoning: 'Failed to generate valid recommendations.' };
        }

        // valid return will have data using !
        return validated.data!;
    }

    async summarizeUserPreferences(userId: number, ratings: UserRatingRecord[]): Promise<SummarizeUserPreferencesResponse> {
        const systemPrompt = `You are a movie preference analyst. Analyze a user's movie ratings to understand their preferences.
        Return a JSON object with:
        - summary: A 2-3 sentence description of their movie taste
        - favoriteGenres: Array of their top 3 preferred genres
        - likesBigBudget: boolean indicating if they prefer big-buget productions
        - prefersClassics: boolean indicating if they prefer older/classic films (pre-2000)
        
        Base your analysis on the patterns in their highly-rated movies.`;

        const ratingsContext = ratings
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 30)
            .map(
                r => `"${r.title}" - Rating: ${r.rating}/5 - Genres: ${r.genres || 'Unknown'} - Year: ${r.releaseDate?.slice(0, 4) || 'Unknown'} - Budget: ${r.budget ? `$${(r.budget / 1000000).toFixed(0)}M` : "Unknown"}`
            ).join('\n');

        const userPrompt = `User ${userId}'s movie ratings (sorted by rating, highest first):
                ${ratingsContext}

                Analyze their movie preferences.
            `;

        const response = await this.chatCompletion(systemPrompt, userPrompt, {
            model: MODEL_FULL,
            temperature: 0.5,
            maxTokens: MAX_RATING_SUMMARY_TOKENS,
            responseFormat: 'json_object'
        });

        const parsed = this.parseJsonResponse(response);

        const validated = this.guardrailService.validatePreferencesOutput(parsed);
        if (!validated.valid) {
            console.warn('Preferences validation errors:', validated.errors);
            throw new Error(`Invalid preferences output: ${validated.errors.join(', ')}`);
        }

        // a valid resp will have data using !
        return validated.data!;
    }

    async compareMovies(movies: CompareMovieRequest[]): Promise<{ comparison: string, winner?: string }> {
        const systemPrompt = `You are a film critic comparing movies. Provide an insightful comparison of the given movies.
        Return a JSON object with:
        - comparison: A detailed 3-4 sentence comparison discussing key differences and similarities
        - winner: (optional) If one movie stands out, include an object with movieId, title, and reason
        
        Consider budget, revenue, ratings, runtime, genre, and critical reception in your analysis.`;

        const moviesContext = movies
            .map(m => `Movie ID ${m.movieId}: "${m.title}" (${m.releaseDate?.slice(0, 4) || "N/A"})
                - Genres: ${m.genres || "Unknown"}
                - Budget: ${m.budget ? `$${(m.budget / 1000000).toFixed(0)}M` : "Unknown"}
                - Revenue: ${m.revenue ? `$${(m.revenue / 1000000).toFixed(0)}M` : "Unknown"}
                - Runtime: ${m.runtime ? `${m.runtime} min` : "Unknown"}
                - Rating: ${m.avgRating?.toFixed(2) || "Unknown"}/5
                - Overview: ${m.overview || "No description"}
            `).join('\n\n');

        const userPrompt = `Compare these movies: \n\n${moviesContext}`;

        const response = await this.chatCompletion(systemPrompt, userPrompt, {
            model: MODEL_FULL,
            temperature: 0.6,
            maxTokens: MAX_COMPARISON_TOKENS,
            responseFormat: 'json_object'
        });

        // negating validation for the sake of time and scope of this project
        const parsed = this.parseJsonResponse(response) as Record<string, unknown>;

        return {
            comparison: parsed.comparison as string,
            winner: parsed.winner as string
        }
    }

    async enhanceSearchQuery(query: string): Promise<string> {
        if (query.length > 100) {
            // no need to enhance what appears to be a detailed query
            return query;
        }

        const systemPrompt = `You are a movie search expander. Given the short user query, expand it into a more descriptive search phrase that captures the intent and related concepts.
        Rules
        - Output ONLY the expanded query text, nothing else
        - Keep it under 200 characters
        - Include related themes, moods, genres, and movies charateristics
        - Don't add specific movie titles
        - Preserve the original intent
        
        Examples:
        - "funny movies" -> "comedy films with humor, laughs, witty, dialogue, amusing situations, feel-good entertainment"
        - "scary" -> "horror thriller films with suspense, fear, supernatural elements, jump scares, dark atmosphere"
        - "space adventure -> "science fiction space exploration adventure with astronauts, spacecraft, alien worlds, epic journeys"`;

        try {
            const response = await this.chatCompletion(systemPrompt, query, {
                model: MODEL_MINI,
                temperature: 0.3,
                maxTokens: MAX_QUERY_ENHANCE_TOKENS,
                responseFormat: 'text'
            })

            const enhanced = response.trim();
            console.log(`Query enhanced from "${query}" to "${enhanced}`);
            return enhanced;
        } catch (err) {
            console.error('Query enhancement failed, using original:', err);
            return query;
        }
    }
}
