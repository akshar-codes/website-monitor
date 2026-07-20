import { registerGoogleStrategy } from "./google.strategy.js";
import { registerGitHubStrategy } from "./github.strategy.js";

// Adding a new provider is a one-line addition here once its strategy
// file exists — nothing else in passport.js needs to change.
const STRATEGY_REGISTRARS = [registerGoogleStrategy, registerGitHubStrategy];

export const registerOAuthStrategies = (passport) => {
  STRATEGY_REGISTRARS.forEach((register) => register(passport));
};
