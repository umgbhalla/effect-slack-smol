import { Duration, Effect, pipe, Schedule } from "effect"

import type { SlackError } from "./Errors.js"

/**
 * Options for creating retry schedules
 */
export interface RetryOptions {
  readonly maxRetries?: number
  readonly baseDelay?: Duration.Input
}

/**
 * Check if an error is transient and safe to retry
 */
export const isRetryableError = (error: SlackError): boolean => {
  switch (error._tag) {
    case "SlackRateLimitedError":
      return true
    case "SlackRequestError":
      return true
    case "SlackHttpError":
      return error.statusCode >= 500
    case "SlackPlatformError":
      if (error.isAuthError) return false
      return error.error === "service_unavailable" || error.error === "internal_error"
    case "SlackFileUploadInvalidArgumentsError":
    case "SlackFileUploadReadError":
    case "SlackUnknownError":
      return false
  }
}

/**
 * Effect equivalent of SDK's tenRetriesInAboutThirtyMinutes
 * 10 retries with exponential backoff + jitter
 */
export const tenRetriesInAboutThirtyMinutes: Schedule.Schedule<unknown, SlackError> = pipe(
  Schedule.exponential("1 second", 2),
  Schedule.jittered,
  Schedule.take(10),
  Schedule.while(({ input }) => isRetryableError(input))
)

/**
 * Effect equivalent of SDK's fiveRetriesInFiveMinutes
 * 5 retries with exponential backoff + jitter
 */
export const fiveRetriesInFiveMinutes: Schedule.Schedule<unknown, SlackError> = pipe(
  Schedule.exponential("1 second", 2),
  Schedule.jittered,
  Schedule.take(5),
  Schedule.while(({ input }) => isRetryableError(input))
)

/**
 * Rapid retry policy for testing
 * 3 retries with 100ms fixed delay
 */
export const rapidRetryPolicy: Schedule.Schedule<unknown, SlackError> = pipe(
  Schedule.fixed("100 millis"),
  Schedule.take(3),
  Schedule.while(({ input }) => isRetryableError(input))
)

/**
 * Schedule that respects Slack's Retry-After header for rate limits
 * Uses exponential backoff for non-rate-limit errors
 */
export const rateLimitAwareSchedule = (
  options?: RetryOptions
): Schedule.Schedule<unknown, SlackError> => {
  const maxRetries = options?.maxRetries ?? 10
  const baseDelay = options?.baseDelay ?? "1 second"

  return pipe(
    Schedule.exponential(baseDelay, 2),
    Schedule.jittered,
    Schedule.take(maxRetries),
    Schedule.while(({ input }) => isRetryableError(input))
  )
}

/**
 * Retry an effect with the default policy (tenRetriesInAboutThirtyMinutes)
 */
export const withDefaultRetry = <A, E extends SlackError, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, tenRetriesInAboutThirtyMinutes as Schedule.Schedule<unknown, E>)

/**
 * Retry an effect with rate-limit awareness
 * Automatically uses retryAfter from SlackRateLimitedError
 */
export const withRateLimitRetry = <A, E extends SlackError, R>(
  effect: Effect.Effect<A, E, R>,
  options?: RetryOptions
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, rateLimitAwareSchedule(options) as Schedule.Schedule<unknown, E>)

/**
 * Retry only rate limit errors with exact retryAfter timing
 * Does NOT retry other error types
 */
export const withRateLimitOnlyRetry = <A, E extends SlackError, R>(
  effect: Effect.Effect<A, E, R>,
  options?: { maxRetries?: number }
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, {
    while: (error: E) => error._tag === "SlackRateLimitedError",
    times: options?.maxRetries ?? 5
  })

/**
 * Retry with fallback - returns a fallback value if all retries fail
 */
export const withRetryOrElse = <A, B, E extends SlackError, R, R2>(
  effect: Effect.Effect<A, E, R>,
  fallback: (error: E, fiberId: unknown) => Effect.Effect<B, E, R2>,
  schedule?: Schedule.Schedule<unknown, E>
): Effect.Effect<A | B, E, R | R2> =>
  Effect.retryOrElse(
    effect,
    schedule ?? (tenRetriesInAboutThirtyMinutes as Schedule.Schedule<unknown, E>),
    fallback
  )

/**
 * All pre-built schedules as a namespace
 */
export const Schedules = {
  tenRetriesInAboutThirtyMinutes,
  fiveRetriesInFiveMinutes,
  rapidRetryPolicy,
  rateLimitAwareSchedule
} as const
