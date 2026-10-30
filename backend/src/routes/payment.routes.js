import { Router } from "express";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/permission.js";
import { validate } from "../middlewares/validate.js";
import { createOrderSchema, verifyPaymentSchema } from "../validators/payment.validator.js";
import { createOrder, verifyPayment, razorpayWebhook } from "../controllers/payment.controller.js";

const router = Router();
router.post("/webhook", razorpayWebhook);
router.use(isAuthenticated, requirePermission("plan:change"));
router.post("/plan-orders", validate(createOrderSchema, "body"), createOrder);
router.post("/verify", validate(verifyPaymentSchema, "body"), verifyPayment);
export default router;
