import "reflect-metadata";
import { PlatformExpress } from "@tsed/platform-express";
import { Server } from "./Server";

import * as dotenv from "dotenv";
import { DatabaseService } from "./services/DatabaseService";

dotenv.config();

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    const platform = await PlatformExpress.bootstrap(Server);
    await platform.listen();

    const databaseService = platform.injector.get(DatabaseService);

    const shutdown = async (signal: string) => {
      console.log(`${signal} received. Shutting down...`);

      try {
        await databaseService.closeConnections();
      } catch (err) {
        console.error("Error closing DB connections", err);
      }

      await platform.stop();
      process.exit(0);
    };

    console.log(`server is listening on port: ${PORT}`);
    
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}


bootstrap();
