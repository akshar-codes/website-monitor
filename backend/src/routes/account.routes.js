import { Router } from "express";
import {
  getAccountSettings,
  updateAccountSettings,
  deleteAccount,
} from "../controllers/account.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { updateProfileSchema } from "../validators/profile.validator.js";
import { deleteAccountSchema } from "../validators/account.validator.js";

const router = Router();

router.use(isAuthenticated);
router.get("/settings", getAccountSettings);
router.patch(
  "/settings",
  validate(updateProfileSchema, "body"),
  updateAccountSettings,
);
router.delete("/", validate(deleteAccountSchema, "body"), deleteAccount);

export default router;
