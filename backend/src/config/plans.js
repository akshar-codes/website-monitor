import { PLANS } from "./constants.js";

/**
 * Single source of truth for subscription plan metadata — pricing, limits,
 * and marketing feature copy. Mirrors config/oauth/providers.config.js:
 * PLANS / PLAN_VALUES (the identifiers) live in config/constants.js, while
 * everything ABOUT each plan lives here. Adding a new plan tier is a
 * two-step process once its identifier exists in PLANS:
 *   1. Add a definition here (assign the next `rank` — ranks must stay
 *      contiguous and ordered since upgrade/downgrade comparison and the
 *      frontend catalog both sort/compare on it)
 *   2. Nothing else needs to change — validation (validators/plan.validator.js),
 *      upgrade/downgrade logic (utils/planUtils.js), and the public catalog
 *      endpoint all derive from this map.
 *
 * `maxMonitors` / `teamMembers` use `null` to mean "no limit" rather than
 * `Infinity` — `Infinity` does not survive `JSON.stringify` (it serialises
 * to `null` anyway), so `null` is the explicit, wire-safe sentinel. See
 * utils/planUtils.js for the helpers that interpret it.
 */
export const PLAN_DEFINITIONS = Object.freeze({
  [PLANS.FREE]: Object.freeze({
    id: PLANS.FREE,
    name: "Free",
    tagline: "Get started with essential uptime monitoring.",
    rank: 0,
    price: Object.freeze({ monthly: 0, yearly: 0, currency: "USD" }),
    limits: Object.freeze({
      maxMonitors: 3,
      minCheckIntervalSeconds: 300,
      dataRetentionDays: 7,
      teamMembers: 1,
    }),
    features: Object.freeze([
      "Up to 3 monitors",
      "5-minute check interval",
      "7-day data retention",
      "Email incident notifications",
    ]),
  }),

  [PLANS.PRO]: Object.freeze({
    id: PLANS.PRO,
    name: "Pro",
    tagline: "For growing teams that need faster checks and more coverage.",
    rank: 1,
    price: Object.freeze({ monthly: 12, yearly: 120, currency: "USD" }),
    limits: Object.freeze({
      maxMonitors: 25,
      minCheckIntervalSeconds: 30,
      dataRetentionDays: 90,
      teamMembers: 5,
    }),
    features: Object.freeze([
      "Up to 25 monitors",
      "30-second check interval",
      "90-day data retention",
      "Team access — up to 5 members",
      "Priority email support",
    ]),
  }),

  [PLANS.UNLIMITED]: Object.freeze({
    id: PLANS.UNLIMITED,
    name: "Unlimited",
    tagline: "Unlimited monitors and the fastest checks available.",
    rank: 2,
    price: Object.freeze({ monthly: 49, yearly: 490, currency: "USD" }),
    limits: Object.freeze({
      maxMonitors: null,
      minCheckIntervalSeconds: 30,
      dataRetentionDays: 365,
      teamMembers: null,
    }),
    features: Object.freeze([
      "Unlimited monitors",
      "30-second check interval",
      "365-day data retention",
      "Unlimited team members",
      "Priority support with SLA",
    ]),
  }),
});

/** Returns the definition for a plan id, or `null` if it isn't recognised. */
export const getPlanDefinition = (plan) => PLAN_DEFINITIONS[plan] || null;

/** Full catalog, ordered by rank (Free → Pro → Unlimited). */
export const getPublicPlanCatalog = () =>
  Object.values(PLAN_DEFINITIONS)
    .slice()
    .sort((a, b) => a.rank - b.rank);
