import { Controller, Post } from "@tsed/common";
import { Inject } from '@tsed/di';
import { BodyParams } from "@tsed/platform-params";
import { BadRequest, NotFound } from "@tsed/exceptions";
import { OpenAiService } from "../services/OpenAiService";
import { MoviesService } from "../services/MoviesService";

@Controller("/compare")
export class CompareController {
  @Inject()
  private openAiService!: OpenAiService;
  @Inject()
  private movieService!: MoviesService;


  @Post("/")
  async compareMovies(@BodyParams() body: { movieIds: number[] }) {
    const { movieIds } = body;

    if (!movieIds || !Array.isArray(movieIds) || movieIds.length < 2) {
      throw new BadRequest("Need at least 2 movie IDs");
    }

    if (movieIds.length > 5) {
      throw new BadRequest("Max 5 movies");
    }

    const movieDetails = [];
    for (const movieId of movieIds) {
      const result = this.movieService.getMovieWithRatingsAndEnrichment(movieId)
      if (!result) throw new NotFound(`Movie ${movieId} not found`);

  
      movieDetails.push(result);
    }

    const llmResult = await this.openAiService.compareMovies(movieDetails);

    return {
      movies: movieDetails,
      comparison: llmResult.comparison,
      winner: llmResult.winner,
    };
  }
}
