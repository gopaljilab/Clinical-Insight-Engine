import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";

passport.use(
  new OAuth2Strategy(
    {
      authorizationURL: process.env.OAUTH2_AUTH_URL || "https://provider.com/oauth2/authorize",
      tokenURL: process.env.OAUTH2_TOKEN_URL || "https://provider.com/oauth2/token",
      clientID: process.env.OAUTH2_CLIENT_ID || "client-id",
      clientSecret: process.env.OAUTH2_CLIENT_SECRET || "client-secret",
      callbackURL: process.env.OAUTH2_CALLBACK_URL || "http://localhost:3000/auth/callback"
    },
    (accessToken: string, refreshToken: string, profile: any, cb: any) => {
      return cb(null, { id: "clinician-id", profile });
    }
  )
);
