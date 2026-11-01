import { Router } from "express";
import {createInternalStockUsage,getAllInternalStockUsages,getInternalStockUsageById,} from "../controllers/internalStockUsage.controller";
import {authenticate,adminOnly,} from "../middleware/auth.middleware";

const router = Router();
router.post("/", authenticate, adminOnly, createInternalStockUsage);
router.get("/", authenticate, adminOnly, getAllInternalStockUsages);
router.get("/:id", authenticate, adminOnly, getInternalStockUsageById);

export default router;