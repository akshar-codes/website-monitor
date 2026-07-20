import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import * as authService from "../services/auth.service.js";
import { registerOAuthStrategies } from "./oauth/index.js";

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await authService.validateCredentials(email, password);
        if (!user) {
          return done(null, false, {
            message: "Incorrect email or password",
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// ── OAuth strategies (Google, GitHub, and any future providers) ──
// Each strategy self-registers only if its credentials are fully
// configured — see config/oauth/providers.config.js.
registerOAuthStrategies(passport);

// ── Session (de)serialization ──
// Shared by every strategy (local + every OAuth provider) — the session
// only ever stores the user ID, regardless of how the user authenticated.

passport.serializeUser((user, done) => {
  done(null, user.id || user._id.toString());
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await authService.getUserById(id);
    if (!user) return done(null, false);
    return done(null, user);
  } catch (error) {
    return done(error);
  }
});

export default passport;
