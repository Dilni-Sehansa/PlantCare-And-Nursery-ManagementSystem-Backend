import { Router } from "express";
import {getAllInternalStock,getInternalStockById,} from "../controllers/internalStock.controller";
import {authenticate,adminOnly,} from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, adminOnly, getAllInternalStock);
router.get("/:id", authenticate, adminOnly, getInternalStockById);

export default router;