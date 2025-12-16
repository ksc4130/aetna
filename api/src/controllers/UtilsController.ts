import { Controller, Get } from "@tsed/common";
import { Inject } from '@tsed/di';
import { OpenAiService } from "../services/OpenAiService";

@Controller("/utils")
export class UtilsController {
  @Inject()
  private openAiService!: OpenAiService;
  @Get("/models")
  async getModels() {
    return await this.openAiService.getModelsList();
  }
}
