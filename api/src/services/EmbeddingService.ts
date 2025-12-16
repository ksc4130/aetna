import { Inject, Injectable } from "@tsed/di";
import { DatabaseService } from "./DatabaseService";
import { EMBEDDING_DIMENSIONS } from "../config";

@Injectable()
export class EmbeddingService {
    
    @Inject()
    private databaseService!: DatabaseService;// handled by tsed's DI using !

    toBlob(floats: number[]): Buffer {
        const buf = Buffer.alloc(floats.length * 4);
        floats.forEach((f, i) => buf.writeFloatLE(f, i * 4));
        return buf;
    }

    initVectorTable(): void {
        this.databaseService.getRawDb().exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS movie_vectors USING vec0(
            movie_id INTEGER PRIMARY KEY,
            embedding float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
            )
        `);
    }

    getEmbeddingCount(): number {
        try {
            const row = this.databaseService.getRawDb()
                .prepare("SELECT COUNT(*) as n FROM movie_vectors_rowids")
                .get() as { n: number } | undefined;
            return row?.n ?? 0;
        } catch {
            return 0;
        }
    }

}