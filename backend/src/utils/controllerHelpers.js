import mongoose from "mongoose";
import ApiError from "./ApiError.js";

export const assertObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ID format: ${id}`, [
      { field: "id", message: `"${id}" is not a valid ID` },
    ]);
  }
};

export const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.errors || result.error.issues || [];
    const details = issues.map((e) => ({
      field:
        Array.isArray(e.path) && e.path.length ? e.path.join(".") : undefined,
      message: e.message,
    }));
    const message = details.map((d) => d.message).join("; ");
    throw ApiError.badRequest(message, details);
  }
  return result.data;
};
