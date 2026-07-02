import { Context, Effect, Layer, Config, Redacted } from "effect"

export interface AppConfigShape {
  readonly signingSecret: Redacted.Redacted<string>
  readonly port: number
}

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("app/AppConfig") {
  static readonly fromEnv: Layer.Layer<AppConfig, Config.ConfigError> = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const signingSecret = yield* Config.redacted("SLACK_SIGNING_SECRET")
      const port = yield* Config.number("PORT").pipe(Config.withDefault(3000))
      return { signingSecret, port }
    })
  )
}
