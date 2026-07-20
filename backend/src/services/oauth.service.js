import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { issueEmailVerificationToken } from "./auth.service.js";

/**
 * Applies fresh profile data from the provider onto an existing user.
 * Returns true if anything actually changed, so callers only hit the DB
 * when there's something worth persisting.
 */
const syncProfileFields = (user, { name, avatarUrl }) => {
  let changed = false;

  if (avatarUrl && user.avatarUrl !== avatarUrl) {
    user.avatarUrl = avatarUrl;
    changed = true;
  }

  if (name && user.name !== name) {
    user.name = name;
    changed = true;
  }

  return changed;
};

/**
 * Shared identity-resolution logic used by every OAuth provider strategy
 * (Google, GitHub, and any future provider — see config/oauth/). Every
 * strategy's verify callback normalizes its provider's profile shape into
 * this one input contract and delegates here, so account-linking and
 * duplicate-prevention logic lives in exactly one place.
 *
 * Resolution order:
 *   1. This exact provider account is already linked      -> log them in
 *   2. No link exists, but the email matches an existing
 *      user AND the provider has verified that email      -> auto-link
 *   3. No link exists and the email is unverified by the
 *      provider but matches an existing user               -> reject
 *      (prevents account takeover via an unconfirmed email claim)
 *   4. No match at all                                     -> create a
 *      brand-new account
 */
export const findOrCreateOAuthUser = async ({
  provider,
  providerId,
  email,
  name,
  avatarUrl,
  emailVerifiedByProvider,
}) => {
  if (!providerId) {
    throw ApiError.badRequest(`${provider} did not return a valid profile ID`);
  }

  // ── 1. Already linked to this exact provider account ──
  const existingByProvider = await User.findByOAuthAccount(
    provider,
    providerId,
  );

  if (existingByProvider) {
    if (syncProfileFields(existingByProvider, { name, avatarUrl })) {
      await existingByProvider.save({ validateBeforeSave: false });
    }
    return existingByProvider;
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  if (!normalizedEmail) {
    throw ApiError.badRequest(
      `${provider} did not share an email address. Please make your ${provider} email public, or sign in with a different method.`,
    );
  }

  // ── 2/3. Existing account with the same email ──
  const existingByEmail = await User.findByEmail(normalizedEmail).select(
    "+oauthAccounts",
  );

  if (existingByEmail) {
    if (!emailVerifiedByProvider) {
      // Refuse to auto-link on an unverified email claim — this is the
      // account-takeover vector: anyone could claim to own your email on
      // a provider that doesn't itself verify it.
      throw ApiError.conflict(
        `An account already exists for ${normalizedEmail}. Sign in with your password, then link ${provider} from account settings.`,
      );
    }

    existingByEmail.linkOAuthAccount(provider, providerId);
    syncProfileFields(existingByEmail, { name, avatarUrl });

    if (!existingByEmail.emailVerified) {
      existingByEmail.emailVerified = true;
      existingByEmail.emailVerifiedAt = new Date();
    }

    await existingByEmail.save({ validateBeforeSave: false });

    logger.info(
      `Linked ${provider} account (${providerId}) to existing user ${existingByEmail._id} (${normalizedEmail})`,
    );

    return existingByEmail;
  }

  // ── 4. Brand-new account ──
  const user = new User({
    name: name || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    emailVerified: !!emailVerifiedByProvider,
    emailVerifiedAt: emailVerifiedByProvider ? new Date() : null,
    avatarUrl: avatarUrl || null,
    oauthAccounts: [{ provider, providerId }],
  });

  await user.save();

  logger.info(
    `Created new user ${user._id} via ${provider} OAuth (${normalizedEmail})`,
  );

  if (!emailVerifiedByProvider) {
    // The provider couldn't confirm the email address — fall back to our
    // own verification flow. The OAuth callback controller blocks session
    // creation until this completes (mirrors the local-registration flow).
    await issueEmailVerificationToken(user);
  }

  return user;
};
