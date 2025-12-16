### Data Update and General Overview / Decisions

- I consolidated ratings into `movies.db` to improve query locality, reduce cross-database joins, and maintain relational integrity.
- I created virtual tables using **sqlite-vec** to store embedding vectors and enable semantic search to support LLM-driven recommendations. There was a brief learning curve, as I had not worked extensively with SQLite in recent years. I initially experimented with an in-memory vector store, but it proved inefficient and produced weaker retrieval results. I selected a small embedding model (`text-embedding-3-small`) appropriate for the relatively short text inputs being embedded.
- I used a **top-k nearest-neighbor retrieval** strategy without a similarity threshold due to the two-stage filtering approach used to progressively narrow the candidate set.
- Most safety guardrails are implemented (with a few deprioritized due to time constraints), including input sanitization, prompt injection detection and mitigation, structured input and output validation, system prompt hardening, and explicit user input wrapping for model clarity.
- Key constants (limits, model identifiers, etc.) are centralized in a `config.ts` module, separating configuration from application logic and providing a clear path for environment-based configuration in production.
- I selected **Drizzle ORM** to provide type-safe database access while minimizing abstraction overhead, which aligned with the scope and time constraints of the project. In hindsight, TypeORM or Prisma may have been a better fit given greater personal familiarity.
- The system uses a larger model for reasoning-intensive LLM tasks and a smaller model for lightweight or deterministic tasks to optimize token usage and latency.
- User preference signals are computed from the user’s full rating history to produce a summarized preference profile, while the top five highest-rated movies are exposed separately as a reference list. Integrating these signals directly into recommendation ranking for authenticated users was outside the scope of this assessment.
- The movie comparison feature aggregates core metadata and provides a comparative analysis across selected movies.
- The recommendation pipeline is the primary component of the system. It takes the user’s query, enhances it when necessary to improve semantic clarity while preserving intent, embeds the query, performs a vector similarity search to retrieve the top-k (50) candidates, and then applies LLM-based reasoning to narrow the results to a maximum of 10 recommendations.
- The frontend was implemented as a lightweight interface to support interactive testing and demonstration. LLM assistance (Claude) was used for rapid UI scaffolding and iteration, while all architectural decisions, integration, and validation were handled directly.
- I iterated on the design multiple times to remain within scope while still delivering a usable system outside of a terminal or Postman.
- This implementation is not production-ready and is intended solely as an assessment deliverable. Even containerizing the development environment (e.g., Docker) would represent a meaningful improvement.

### Prerequisites
- Node.js v18+
- OpenAI API key

### Installation

```bash
# Install dependencies from project root
cd api && npm install && cd ../ux && npm install

# Configure environment
cd api
cp .env.example .env
# Make sure you add your OPENAI_API_KEY to .env


# Start backend (Terminal 1) from the api directory
npm run dev

# Start frontend (Terminal 2) from the ux directory
npm run dev
```
Navigate [here](http://localhost:5173)