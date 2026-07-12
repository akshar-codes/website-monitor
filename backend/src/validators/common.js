import { z } from "zod";
import mongoose from "mongoose";

export const objectIdSchema = z
  .string({ required_error: "ID is required" })
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Must be a valid ID",
  });

export const optionalObjectIdSchema = objectIdSchema.optional();
