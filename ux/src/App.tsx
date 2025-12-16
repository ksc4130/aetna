import { useState, useEffect } from "react";
import {
  getRecommendations,
  getMovies,
  getUserIds,
  getUserPreferences,
  compareMovies,
  type MovieRecommendation,
  type MovieListItem,
  type PreferencesResponse,
  type CompareResponse,
} from "./api";

type Tab = "recommend" | "preferences" | "compare";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("recommend");
  const [expandedMovies, setExpandedMovies] = useState<Set<number>>(new Set());

  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>(
    []
  );
  const [reasoning, setReasoning] = useState("");
  const [enhancedQuery, setEnhancedQuery] = useState<string | undefined>();
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState("");

  const [userIds, setUserIds] = useState<number[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(
    null
  );
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");

  const [movies, setMovies] = useState<MovieListItem[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(
    null
  );
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    getMovies()
      .then((res) => setMovies(res.movies))
      .catch((err) => console.error("Failed to load movies:", err));

    getUserIds()
      .then((res) => setUserIds(res.userIds.slice(0, 20)))
      .catch((err) => console.error("Failed to load user IDs:", err));
  }, []);

  const handleRecommend = async () => {
    if (!query.trim()) return;

    setRecommendLoading(true);
    setRecommendError("");
    try {
      const result = await getRecommendations(query, 10);
      setRecommendations(result.recommendations);
      setReasoning(result.reasoning);
      setEnhancedQuery(result.enhancedQuery);
    } catch (err) {
      setRecommendError(
        err instanceof Error ? err.message : "Failed to get recommendations"
      );
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleGetPreferences = async () => {
    if (!selectedUserId) return;

    setPreferencesLoading(true);
    setPreferencesError("");
    try {
      const result = await getUserPreferences(selectedUserId);
      setPreferences(result);
    } catch (err) {
      setPreferencesError(
        err instanceof Error ? err.message : "Failed to get preferences"
      );
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedMovies.length < 2) return;

    setCompareLoading(true);
    setCompareError("");
    try {
      const result = await compareMovies(selectedMovies);
      setCompareResult(result);
    } catch (err) {
      setCompareError(
        err instanceof Error ? err.message : "Failed to compare movies"
      );
    } finally {
      setCompareLoading(false);
    }
  };

  const toggleMovieSelection = (movieId: number) => {
    setSelectedMovies((prev) =>
      prev.includes(movieId)
        ? prev.filter((id) => id !== movieId)
        : prev.length < 5
          ? [...prev, movieId]
          : prev
    );
  };

  const parseGenres = (genres: string | null): string[] => {
    if (!genres) return [];
    try {
      const parsed = JSON.parse(genres);
      return parsed.map((g: { name: string }) => g.name);
    } catch {
      return [];
    }
  };

  const toggleMovieExpanded = (movieId: number) => {
    setExpandedMovies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(movieId)) {
        newSet.delete(movieId);
      } else {
        newSet.add(movieId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-400">
            🎬 Movie Recommendations
          </h1>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center sm:justify-start">
          {(["recommend", "preferences", "compare"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-3 font-medium capitalize transition-colors text-sm sm:text-base ${
                activeTab === tab
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 overflow-x-hidden">
        {/* Recommend Tab */}
        {activeTab === "recommend" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">
                Get Movie Recommendations
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRecommend()}
                  placeholder="e.g., 'action movies with high ratings'"
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleRecommend}
                  disabled={recommendLoading || !query.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  {recommendLoading ? "Loading..." : "Get Recommendations"}
                </button>
              </div>
            </div>

            {recommendError && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
                {recommendError}
              </div>
            )}

            {reasoning && (
              <div className="bg-gray-800 rounded-lg p-4 sm:p-6 overflow-hidden">
                <h3 className="text-lg font-semibold mb-2 text-blue-400">
                  AI Reasoning
                </h3>
                {enhancedQuery && (
                  <div className="mb-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-xs text-gray-400 mb-1">Enhanced search query:</p>
                    <p className="text-sm text-purple-300 italic">"{enhancedQuery}"</p>
                  </div>
                )}
                <p className="text-gray-300 break-words">{reasoning}</p>
              </div>
            )}

            {recommendations.length > 0 && (
              <div className="grid gap-4">
                {recommendations.map((movie) => (
                  <div
                    key={movie.movieId}
                    className="bg-gray-800 rounded-lg p-4 sm:p-6 overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{movie.title}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-1 bg-blue-600 rounded text-xs sm:text-sm">
                          Match: {movie.matchScore}%
                        </span>
                        {movie.avgRating && (
                          <span className="px-2 py-1 bg-yellow-600 rounded text-xs sm:text-sm">
                            ⭐ {movie.avgRating.toFixed(1)}
                          </span>
                        )}
                        {movie.enrichmentAttributes?.sentiment && (
                          <span className="px-2 py-1 bg-green-700 rounded text-xs sm:text-sm">
                            {movie.enrichmentAttributes.sentiment}
                          </span>
                        )}
                        {movie.enrichmentAttributes?.budgetTier && (
                          <span className="px-2 py-1 bg-amber-700 rounded text-xs sm:text-sm">
                            💰 {movie.enrichmentAttributes.budgetTier}
                          </span>
                        )}
                        {movie.enrichmentAttributes?.effectivenessScore && (
                          <span className="px-2 py-1 bg-cyan-700 rounded text-xs sm:text-sm">
                            📊 {movie.enrichmentAttributes.effectivenessScore.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">
                      {movie.releaseDate?.slice(0, 4)} •{" "}
                      {parseGenres(movie.genres).join(", ") || "N/A"}
                    </p>
                    <p className="text-gray-300 mb-3 break-words">{movie.overview}</p>
                    <p className="text-blue-300 text-sm italic">
                      {movie.matchReason}
                    </p>
                    
                    {/* Target Audience */}
                    {movie.enrichmentAttributes?.targetAudience && (
                      <p className="text-gray-400 text-xs mt-2">
                        🎯 Target: {movie.enrichmentAttributes.targetAudience}
                      </p>
                    )}
                    
                    {/* Debug Collapse Section */}
                    <div className="mt-3 border-t border-gray-700 pt-3">
                      <button
                        onClick={() => toggleMovieExpanded(movie.movieId)}
                        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
                      >
                        <span>{expandedMovies.has(movie.movieId) ? "▼" : "▶"}</span>
                        <span>Debug: Raw Data</span>
                      </button>
                      {expandedMovies.has(movie.movieId) && (
                        <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-gray-300 overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                          {JSON.stringify(movie, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 overflow-hidden">
              <h2 className="text-xl font-semibold mb-4">
                Get Movie Recommendations
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <select
                  value={selectedUserId ?? ""}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a user...</option>
                  {userIds.map((id) => (
                    <option key={id} value={id}>
                      User {id}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGetPreferences}
                  disabled={preferencesLoading || !selectedUserId}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                  {preferencesLoading ? "Loading..." : "Analyze Preferences"}
                </button>
              </div>
            </div>

            {preferencesError && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
                {preferencesError}
              </div>
            )}

            {preferences && (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">
                    User {preferences.userId} Profile
                  </h3>
                  <p className="text-gray-300 mb-4">{preferences.summary}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Avg Rating:</span>
                      <span className="ml-2 text-yellow-400">
                        ⭐ {preferences.averageRating.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Ratings:</span>
                      <span className="ml-2">{preferences.ratingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">
                    Favorite Genres
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preferences.favoriteGenres.map((genre) => (
                      <span
                        key={genre}
                        className="px-3 py-1 bg-blue-600 rounded-full text-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${preferences.preferences.likesBigBudget ? "bg-green-500" : "bg-gray-500"}`}
                      />
                      <span>
                        {preferences.preferences.likesBigBudget
                          ? "Likes"
                          : "Doesn't prefer"}{" "}
                        big budget films
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${preferences.preferences.prefersClassics ? "bg-green-500" : "bg-gray-500"}`}
                      />
                      <span>
                        {preferences.preferences.prefersClassics
                          ? "Prefers"
                          : "Doesn't prefer"}{" "}
                        classic films
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 md:col-span-2">
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">
                    Top Rated Movies
                  </h3>
                  <div className="grid gap-2">
                    {preferences.preferences.topRatedMovies.map(
                      (movie, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-gray-700 rounded p-3"
                        >
                          <span>{movie.title}</span>
                          <span className="text-yellow-400">
                            ⭐ {movie.rating.toFixed(1)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compare Tab */}
        {activeTab === "compare" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Compare Movies</h2>
              <p className="text-gray-400 mb-4">
                Select 2-5 movies to compare (
                {selectedMovies.length} selected)
              </p>
              <div className="max-h-60 overflow-y-auto grid gap-2 mb-4">
                {movies.slice(0, 30).map((movie) => (
                  <button
                    key={movie.movieId}
                    onClick={() => toggleMovieSelection(movie.movieId)}
                    className={`flex justify-between items-center p-3 rounded transition-colors ${
                      selectedMovies.includes(movie.movieId)
                        ? "bg-blue-600"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <span>{movie.title}</span>
                    <span className="text-sm text-gray-300">
                      {movie.avgRating?.toFixed(1) ?? "N/A"} ⭐
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleCompare}
                disabled={compareLoading || selectedMovies.length < 2}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {compareLoading ? "Comparing..." : "Compare Selected Movies"}
              </button>
            </div>

            {compareError && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-200">
                {compareError}
              </div>
            )}

            {compareResult && (
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-blue-400">
                    AI Comparison
                  </h3>
                  <p className="text-gray-300">{compareResult.comparison}</p>
                  {compareResult.winner && (
                    <div className="mt-4 p-4 bg-green-900/30 border border-green-500 rounded-lg">
                      <p className="font-semibold text-green-400">
                        🏆 Winner: {compareResult.winner.title}
                      </p>
                      <p className="text-gray-300 text-sm mt-1">
                        {compareResult.winner.reason}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {compareResult.movies.map((movie) => (
                    <div
                      key={movie.movieId}
                      className="bg-gray-800 rounded-lg p-6"
                    >
                      <h3 className="text-lg font-semibold mb-2">
                        {movie.title}
                      </h3>
                      <p className="text-gray-400 text-sm mb-3">
                        {movie.releaseDate?.slice(0, 4)} •{" "}
                        {parseGenres(movie.genres).join(", ") || "N/A"}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Rating:</span>
                          <span className="ml-2">
                            {movie.avgRating?.toFixed(1) ?? "N/A"} ⭐
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Runtime:</span>
                          <span className="ml-2">
                            {movie.runtime ?? "N/A"} min
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Budget:</span>
                          <span className="ml-2">
                            {movie.budget
                              ? `$${(movie.budget / 1000000).toFixed(0)}M`
                              : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Revenue:</span>
                          <span className="ml-2">
                            {movie.revenue
                              ? `$${(movie.revenue / 1000000).toFixed(0)}M`
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                      {movie.enrichmentAttributes && (
                        <div className="border-t border-gray-700 pt-3 mt-3">
                          <p className="text-xs text-gray-400 mb-2">
                            AI Analysis:
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {movie.enrichmentAttributes.sentiment && (
                              <span className="px-2 py-1 bg-gray-700 rounded">
                                {movie.enrichmentAttributes.sentiment}
                              </span>
                            )}
                            {movie.enrichmentAttributes.budgetTier && (
                              <span className="px-2 py-1 bg-gray-700 rounded">
                                Budget: {movie.enrichmentAttributes.budgetTier}
                              </span>
                            )}
                            {movie.enrichmentAttributes.effectivenessScore && (
                              <span className="px-2 py-1 bg-gray-700 rounded">
                                Effectiveness:{" "}
                                {movie.enrichmentAttributes.effectivenessScore}
                              </span>
                            )}
                          </div>
                          {movie.enrichmentAttributes.targetAudience && (
                            <p className="text-xs text-gray-400 mt-2">
                              Target: {movie.enrichmentAttributes.targetAudience}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
