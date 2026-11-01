import { v2 as cloudinary } from "cloudinary";
import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const configured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET,
);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Uploads an in-memory image and returns its Cloudinary URL and public ID. */
export const uploadImage = (
  buffer,
  { folder, publicId, transformation } = {},
) => {
  if (!configured) {
    throw ApiError.internal(
      "Image uploads are unavailable: Cloudinary is not configured",
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder,
        public_id: publicId,
        overwrite: false,
        ...(transformation ? { transformation } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
};

/** Best-effort asset cleanup. Only pass public IDs owned by this app. */
export const deleteImage = async (publicId) => {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    logger.warn(
      `Cloudinary image cleanup failed for ${publicId}: ${error.message}`,
    );
  }
};

/** Get the public ID only for assets uploaded into this app's folder. */
export const getManagedImagePublicId = (url) => {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com/"))
    return null;
  try {
    const pathname = new URL(url).pathname;
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex < 0) return null;
    const assetPath = pathname.slice(uploadIndex + "/upload/".length);
    const parts = assetPath.split("/");
    // Skip Cloudinary's optional version segment (v1234567890).
    if (/^v\d+$/.test(parts[0])) parts.shift();
    const publicId = decodeURIComponent(parts.join("/")).replace(
      /\.[^.]+$/,
      "",
    );
    return publicId.startsWith("sitewatch/") ? publicId : null;
  } catch {
    return null;
  }
};
