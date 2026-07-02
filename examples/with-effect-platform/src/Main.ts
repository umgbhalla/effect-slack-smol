import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { SlackConfig } from "effect-slack"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiSwagger } from "effect/unstable/httpapi"

import { SlackBotApi } from "./Api.js"
import { AppConfig } from "./Config.js"
import { HealthResponse } from "./Schemas.js"
import { EventsLive } from "./SlackEvents.js"
import { CommandsLive } from "./SlashCommands.js"

// =============================================================================
// Health Group Implementation
// =============================================================================

const HealthLive = HttpApiBuilder.group(SlackBotApi, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed(new HealthResponse({ status: "ok" })))
)

// =============================================================================
// API Implementation
// =============================================================================

const ApiLive = HttpApiBuilder.layer(SlackBotApi).pipe(
  Layer.provide(EventsLive),
  Layer.provide(CommandsLive),
  Layer.provide(HealthLive)
)

// =============================================================================
// Server Configuration
// =============================================================================

const HttpServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* AppConfig
    return BunHttpServer.layer({ port: config.port })
  })
)

const RouterLive = ApiLive.pipe(
  // Add Swagger documentation at /docs
  Layer.provide(HttpApiSwagger.layer(SlackBotApi, { path: "/docs" })),
  // Add CORS support
  Layer.provide(HttpRouter.cors())
)

const ServerLive = HttpRouter.serve(RouterLive).pipe(
  // Configure the HTTP server with port from config
  Layer.provide(HttpServerLive),
  // Provide Slack configuration from environment
  Layer.provide(SlackConfig.fromEnv),
  // Provide the app configuration
  Layer.provide(AppConfig.fromEnv)
)

// =============================================================================
// Main
// =============================================================================

BunRuntime.runMain(Layer.launch(ServerLive))
