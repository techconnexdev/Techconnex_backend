import express from "express";
import { checkEmail, login } from "./controller.js";

const router = express.Router();

router.post("/login", login);
router.get("/check-email", checkEmail);

export default router;
