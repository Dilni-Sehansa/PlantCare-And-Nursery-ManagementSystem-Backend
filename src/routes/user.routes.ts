import { Router } from "express";

import {
  getAllUsers,
  getUserStats,
  getUserById,
  createAdmin,
  updateAdminDetails,
  updateUserRole,
  updateUserStatus,
} from "../controllers/user.controller";

import { authenticate, allowRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate, allowRoles("SUPER_ADMIN"));
router.get("/", getAllUsers);
router.get("/stats", getUserStats);
router.post("/create-admin", createAdmin);
router.get("/:id", getUserById);
router.patch("/:id/details", updateAdminDetails);
router.patch("/:id/role", updateUserRole);
router.patch("/:id/status", updateUserStatus);

export default router;