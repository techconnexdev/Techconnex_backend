import express from "express";
import { register,  becomeCustomerHandler, updatePasswordHandler } from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/become-customer", authenticateToken, becomeCustomerHandler);
router.patch("/profile/password", authenticateToken, updatePasswordHandler);

export default router;
