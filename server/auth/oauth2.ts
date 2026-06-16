import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";

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
      (_accessToken: string, _refreshToken: string, _profile: any, cb: unknown) => {
        // OAuth2 user lookup is not yet implemented.
        // Do NOT replace this with a hardcoded identity — every OAuth2 user would
        // share the same account and see all other users' patient records.
        // Implement a real DB lookup (e.g. by profile.emails[0].value) before enabling.
        return cb(new Error("OAuth2 authentication is not yet configured for this application."));
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
