import { Router } from "express";
import { register, login, getMyDetails } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", authenticate, getMyDetails);

export default router;