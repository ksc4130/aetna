const API_BASE = "/api";

export interface RecommendationEnrichedAttributes {
  sentiment: string | null;
  budgetTier: string | null;
  revenueTier: string | null;
  effectivenessScore: number | null;
  targetAudience: string | null;
}

export interface MovieRecommendation {
  movieId: number;
  title: string;
  overview: string | null;
  genres: string | null;
  releaseDate: string | null;
  avgRating: number | null;
  matchScore: number;
  matchReason: string;
  isEnriched: boolean;
  enrichmentAttributes?: RecommendationEnrichedAttributes;
}

export interface RecommendResponse {
  recommendations: MovieRecommendation[];
  reasoning: string;
  enhancedQuery?: string;
}

export interface MovieListItem {
  movieId: number;
  title: string;
  genres: string | null;
  releaseDate: string | null;
  avgRating: number | null;
  ratingCount: number;
}

export interface MoviesListResponse {
  movies: MovieListItem[];
}

export interface TopRatedMovie {
  title: string;
  rating: number;
}

export interface UserPreferences {
  likesBigBudget: boolean;
  prefersClassics: boolean;
  topRatedMovies: TopRatedMovie[];
}

export interface PreferencesResponse {
  userId: number;
  summary: string;
  favoriteGenres: string[];
  averageRating: number;
  ratingCount: number;
  preferences: UserPreferences;
}

export interface UserIdsResponse {
  userIds: number[];
  count: number;
}

export interface EnrichedAttributes {
  sentiment: string | null;
  budgetTier: string | null;
  revenueTier: string | null;
  effectivenessScore: number | null;
  targetAudience: string | null;
}

export interface ComparedMovie {
  movieId: number;
  title: string;
  overview: string | null;
  genres: string | null;
  releaseDate: string | null;
  budget: number | null;
  revenue: number | null;
  runtime: number | null;
  avgRating: number | null;
  enrichmentAttributes?: EnrichedAttributes;
}

export interface CompareWinner {
  movieId: number;
  title: string;
  reason: string;
}

export interface CompareResponse {
  movies: ComparedMovie[];
  comparison: string;
  winner?: CompareWinner;
}


export async function getRecommendations(
  query: string,
  limit: number = 5
): Promise<RecommendResponse> {
  const response = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get recommendations");
  }
  return response.json();
}

export async function getMovies(): Promise<MoviesListResponse> {
  const response = await fetch(`${API_BASE}/recommend/movies`);
  if (!response.ok) {
    throw new Error("Failed to fetch movies");
  }
  return response.json();
}

export async function getUserIds(): Promise<UserIdsResponse> {
  const response = await fetch(`${API_BASE}/preferences`);
  if (!response.ok) {
    throw new Error("Failed to fetch user IDs");
  }
  return response.json();
}

export async function getUserPreferences(
  userId: number
): Promise<PreferencesResponse> {
  const response = await fetch(`${API_BASE}/preferences/${userId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch preferences");
  }
  return response.json();
}

export async function compareMovies(
  movieIds: number[]
): Promise<CompareResponse> {
  const response = await fetch(`${API_BASE}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ movieIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to compare movies");
  }
  return response.json();
}
