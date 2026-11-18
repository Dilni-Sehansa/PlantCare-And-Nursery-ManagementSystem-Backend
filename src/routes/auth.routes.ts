import { Router } from "express";
import { register, login, getMyDetails, getRefreshToken, verifyEmail } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";


const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getMyDetails);
router.post("/refresh-token",getRefreshToken);
router.get("/verify-email", verifyEmail);

export default router;