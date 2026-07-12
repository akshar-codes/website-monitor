/**
 * Shared controller utilities
 *
 * These helpers were previously duplicated verbatim in every controller.
 * Centralising them here keeps controllers thin and ensures any future
 * change (e.g. error message wording, ID validation library swap) is
 * made in one place.
 */

import mongoose from "mongoose";
import ApiError from "./ApiError.js";

/**
 * Throw a 400 ApiError if `id` is not a valid MongoDB ObjectId.
 *
 * @param {string} id
 * @throws {ApiError}
 */
export const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ID format: ${id}`);
  }
};

/**
 * Run a Zod schema against `data`.  Returns the parsed (and coerced)
 * data on success, throws a 400 ApiError with all validation messages
 * joined on failure.
 *
 * @template T
 * @param {import("zod").ZodSchema<T>} schema
 * @param {unknown} data
 * @returns {T}
 * @throws {ApiError}
 */
export const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.errors.map((e) => e.message).join("; ");
    throw ApiError.badRequest(messages);
  }
  return result.data;
};
