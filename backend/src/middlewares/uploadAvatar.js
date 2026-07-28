import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Absolute path to the avatar upload directory, resolved once at module
 * load. `env.AVATAR_UPLOAD_DIR` is relative to the backend project root
 * (backend/), mirroring how utils/logger.js resolves LOG_DIR.
 */
export const AVATAR_DIR_ABSOLUTE = path.resolve(
  __dirname,
  "../..",
  env.AVATAR_UPLOAD_DIR,
);

/** Public URL prefix the directory is mounted under — see app.js. */
export const AVATAR_URL_PREFIX = "/uploads/avatars";

if (!fs.existsSync(AVATAR_DIR_ABSOLUTE)) {
  fs.mkdirSync(AVATAR_DIR_ABSOLUTE, { recursive: true });
}

/** Accepted image MIME types, mapped to the file extension we persist. */
const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR_ABSOLUTE),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES.get(file.mimetype) || "jpg";
    const userId = req.user?.id || req.user?._id?.toString() || "anonymous";
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    cb(null, `${userId}-${Date.now()}-${uniqueSuffix}.${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      ApiError.badRequest(
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      ),
    );
  }
  cb(null, true);
};

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.AVATAR_MAX_FILE_SIZE_BYTES,
    files: 1,
  },
}).single("avatar");

/**
 * Express middleware wrapping multer's callback-based API. Multer doesn't
 * follow the (req, res, next) → Promise convention the rest of this app's
 * middleware uses (see utils/asyncHandler.js), so its errors are converted
 * to ApiError here rather than at every call site.
 */
export const handleAvatarUpload = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const maxMb = Math.round(
            env.AVATAR_MAX_FILE_SIZE_BYTES / (1024 * 1024),
          );
          return next(
            ApiError.badRequest(
              `Avatar image must be smaller than ${maxMb}MB.`,
            ),
          );
        }
        return next(ApiError.badRequest(err.message));
      }

      if (err instanceof ApiError) {
        return next(err);
      }

      logger.error(`Unexpected avatar upload error: ${err.message}`, {
        stack: err.stack,
      });
      return next(ApiError.internal("Failed to process the uploaded file"));
    }

    if (!req.file) {
      return next(ApiError.badRequest("No avatar image was provided"));
    }

    return next();
  });
};
