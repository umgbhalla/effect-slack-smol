import { WebClient } from "@slack/web-api"
import { Context, Effect, Layer, Redacted } from "effect"

import { SlackConfig } from "./SlackConfig.js"

/**
 * SlackClient service - provides access to the underlying WebClient
 */
export class SlackClient extends Context.Service<SlackClient, WebClient>()(
  "effect-slack/SlackClient"
) {
  /**
   * Default layer that creates WebClient from SlackConfig
   */
  static readonly layer: Layer.Layer<SlackClient, never, SlackConfig> = Layer.effect(
    SlackClient,
    Effect.gen(function* () {
      const config = yield* SlackConfig
      const token = Redacted.value(config.token)
      return SlackClient.of(new WebClient(token, config.options))
    })
  )

  static readonly Default = SlackClient.layer

  /**
   * Create layer with custom WebClient instance
   */
  static readonly make = (client: WebClient): Layer.Layer<SlackClient> =>
    Layer.succeed(SlackClient, SlackClient.of(client))
}
