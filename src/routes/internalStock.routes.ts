import { Router } from "express";
import {getAllInternalStock,getInternalStockById,updateInternalStock,deleteInternalStock,} from "../controllers/internalStock.controller";
import {authenticate,adminOnly,} from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, adminOnly, getAllInternalStock);
router.patch("/:id", authenticate, adminOnly, updateInternalStock);
router.delete("/:id", authenticate, adminOnly, deleteInternalStock);
router.get("/:id", authenticate, adminOnly, getInternalStockById);

export default router;