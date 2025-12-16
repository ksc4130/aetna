import { Controller, Get } from "@tsed/common";
import { Inject } from "@tsed/di";
import { PathParams } from "@tsed/platform-params";
import { BadRequest, NotFound } from "@tsed/exceptions";
import { DatabaseService } from "../services/DatabaseService";
import { OpenAiService } from "../services/OpenAiService";


@Controller("/preferences")
export class PreferencesController {
  @Inject()
  private databaseService!: DatabaseService;
  @Inject()
  private openAiService!: OpenAiService;

  @Get("/")
  getUserIds() {
    return { userIds: this.databaseService.getAllUserIds().slice(0, 20), count: 20 };
  }

  @Get("/:userId")
  async getUserPreferences(@PathParams("userId") userId: string) {
    const id = parseInt(userId, 10);
    if (isNaN(id)) throw new BadRequest("Invalid user ID");

    const userRatings = this.databaseService.getUserRatings(id);
    if (!userRatings.length) throw new NotFound("User not found");

    const ratingsForAnalysis = userRatings
      .filter((r) => r.movie)
      .map((r) => ({
        title: r.movie!.title,
        rating: r.rating,
        genres: r.movie!.genres,
        overview: r.movie!.overview,
        releaseDate: r.movie!.releaseDate,
        budget: r.movie!.budget,
      }));

    const llmResult = await this.openAiService.summarizeUserPreferences(id, ratingsForAnalysis);
    const avgRating = userRatings.reduce((s, r) => s + r.rating, 0) / userRatings.length;

    return {
      userId: id,
      summary: llmResult.summary,
      favoriteGenres: llmResult.favoriteGenres,
      averageRating: Math.round(avgRating * 100) / 100,
      ratingCount: userRatings.length,
      preferences: {
        likesBigBudget: llmResult.likesBigBudget,
        prefersClassics: llmResult.prefersClassics,
        topRatedMovies: userRatings.filter((r) => r.movie).sort((a, b) => b.rating - a.rating).slice(0, 5).map((r) => ({ title: r.movie!.title, rating: r.rating })),
      },
    };
  }
}
