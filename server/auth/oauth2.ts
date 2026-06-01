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
