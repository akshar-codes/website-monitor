import { Router } from "express";
import {
  createSuggestion,
  listMySuggestions,
} from "../controllers/suggestion.controller.js";
import { validate } from "../middlewares/validate.js";
import { createSuggestionSchema } from "../validators/suggestion.validator.js";

const router = Router();

router.post("/", validate(createSuggestionSchema, "body"), createSuggestion);
router.get("/", listMySuggestions);

export default router;
