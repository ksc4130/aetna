import { Configuration, Inject } from "@tsed/di";
import { PlatformApplication } from "@tsed/common";
import "@tsed/platform-express";
import bodyParser from "body-parser";
import compress from "compression";
import cookieParser from "cookie-parser";
import methodOverride from "method-override";
import cors from "cors";

import * as controllers from "./controllers";

@Configuration({
  acceptMimes: ["application/json"],
  httpPort: process.env.PORT || 3001,
  httpsPort: false,
  logger: {
    debug: false,
    level: "info",
  },
  mount: {
    "/api": [...Object.values(controllers)],
  },
  middlewares: [
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }),
    cookieParser(),
    compress({}),
    methodOverride(),
    bodyParser.json(),
    bodyParser.urlencoded({ extended: true }),
  ],
  exclude: ["**/*.spec.ts"],
})
export class Server {
  @Inject()
  protected app!: PlatformApplication;

  @Configuration()
  protected settings!: Configuration;
}
