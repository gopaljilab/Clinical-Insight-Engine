import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. OAuth2 authentication cannot be configured without it.`
    );
  }
  return value;
}

// Only initialize OAuth2 strategy if all required env vars are present.
// Throws a clear startup error if any are missing, rather than silently
// initializing with dummy credentials that will fail at login time.
const OAUTH2_AUTH_URL = process.env.OAUTH2_AUTH_URL;
const OAUTH2_TOKEN_URL = process.env.OAUTH2_TOKEN_URL;
const OAUTH2_CLIENT_ID = process.env.OAUTH2_CLIENT_ID;
const OAUTH2_CLIENT_SECRET = process.env.OAUTH2_CLIENT_SECRET;
const OAUTH2_CALLBACK_URL = process.env.OAUTH2_CALLBACK_URL;

if (
  OAUTH2_AUTH_URL &&
  OAUTH2_TOKEN_URL &&
  OAUTH2_CLIENT_ID &&
  OAUTH2_CLIENT_SECRET &&
  OAUTH2_CALLBACK_URL
) {
  passport.use(
    new OAuth2Strategy(
      {
        authorizationURL: OAUTH2_AUTH_URL,
        tokenURL: OAUTH2_TOKEN_URL,
        clientID: OAUTH2_CLIENT_ID,
        clientSecret: OAUTH2_CLIENT_SECRET,
        callbackURL: OAUTH2_CALLBACK_URL,
      },
      (accessToken: string, refreshToken: string, profile: any, cb: any) => {
        return cb(null, { id: "clinician-id", profile });
      }
    )
  );
} else if (
  OAUTH2_AUTH_URL ||
  OAUTH2_TOKEN_URL ||
  OAUTH2_CLIENT_ID ||
  OAUTH2_CLIENT_SECRET ||
  OAUTH2_CALLBACK_URL
) {
  // Some but not all env vars are set — throw a clear error
  const missing = [
    !OAUTH2_AUTH_URL && "OAUTH2_AUTH_URL",
    !OAUTH2_TOKEN_URL && "OAUTH2_TOKEN_URL",
    !OAUTH2_CLIENT_ID && "OAUTH2_CLIENT_ID",
    !OAUTH2_CLIENT_SECRET && "OAUTH2_CLIENT_SECRET",
    !OAUTH2_CALLBACK_URL && "OAUTH2_CALLBACK_URL",
  ].filter(Boolean);
  throw new Error(
    `Incomplete OAuth2 configuration. Missing environment variables: ${missing.join(", ")}`
  );
}
// If none are set, OAuth2 is simply not configured — skip silently.
