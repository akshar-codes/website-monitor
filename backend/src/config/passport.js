import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import * as authService from "../services/auth.service.js";

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

// ── Session (de)serialization ──

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
