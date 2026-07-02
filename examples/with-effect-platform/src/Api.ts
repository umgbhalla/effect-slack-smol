import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"

import {
  SlackEventPayload,
  ChallengeResponse,
  EventAckResponse,
  SlashCommandPayload,
  SlashCommandResponse,
  HealthResponse,
  SignatureVerificationError,
  SlackApiError
} from "./Schemas.js"

// =============================================================================
// Events Group - /slack/events
// =============================================================================

const EventsGroup = HttpApiGroup.make("events").add(
  HttpApiEndpoint.post("handleEvent", "/slack/events", {
    payload: SlackEventPayload.pipe(HttpApiSchema.asJson()),
    success: Schema.Union([ChallengeResponse, EventAckResponse]),
    error: [SignatureVerificationError, SlackApiError]
  })
)

// =============================================================================
// Commands Group - /slack/commands
// =============================================================================

const CommandsGroup = HttpApiGroup.make("commands").add(
  HttpApiEndpoint.post("handleCommand", "/slack/commands", {
    payload: SlashCommandPayload.pipe(HttpApiSchema.asFormUrlEncoded()),
    success: SlashCommandResponse,
    error: [SignatureVerificationError, SlackApiError]
  })
)

// =============================================================================
// Health Group - /health
// =============================================================================

const HealthGroup = HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HealthResponse })
)

// =============================================================================
// Top-Level API
// =============================================================================

export class SlackBotApi extends HttpApi.make("SlackBotApi")
  .add(EventsGroup)
  .add(CommandsGroup)
  .add(HealthGroup) {}
