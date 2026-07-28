/**
 * Profile routes
 *
 * GET    /api/profile              — the caller's own full profile (auth required)
 * PUT    /api/profile              — partial update of editable profile fields (auth required)
 * POST   /api/profile/avatar       — replace the caller's avatar image (auth required)
 * DELETE /api/profile/avatar       — remove the caller's avatar image (auth required)
 * GET    /api/profile/public/:id   — public-safe profile view (no auth required)
 *
 * Mounted publicly at its mount point (routes/index.js), mirroring
 * plan.routes.js — the authenticated routes below guard themselves
 * individually with `isAuthenticated` so the public profile lookup stays
 * reachable without a session.
 */

import { Router } from "express";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getPublicProfile,
} from "../controllers/profile.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate, validateObjectId } from "../middlewares/validate.js";
import { handleAvatarUpload } from "../middlewares/uploadAvatar.js";
import { updateProfileSchema } from "../validators/profile.validator.js";

const router = Router();

// ── Public ──
router.get("/public/:id", validateObjectId("id"), getPublicProfile);

// ── Authenticated ──
router.get("/", isAuthenticated, getProfile);
router.put(
  "/",
  isAuthenticated,
  validate(updateProfileSchema, "body"),
  updateProfile,
);
router.post("/avatar", isAuthenticated, handleAvatarUpload, uploadAvatar);
router.delete("/avatar", isAuthenticated, deleteAvatar);

export default router;
