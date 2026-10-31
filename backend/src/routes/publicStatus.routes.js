import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validate.js";
import { getPublic } from "../controllers/statusPage.controller.js";
const router = Router();
router.get(
  "/:slug",
  validate(
    z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
    "params",
  ),
  getPublic,
);
export default router;
