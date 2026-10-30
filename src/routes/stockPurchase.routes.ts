
import { Router } from "express";
import {createStockPurchase,getAllStockPurchases,getStockPurchaseById} from "../controllers/stockPurchase.controller";
import {authenticate,adminOnly} from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, adminOnly, createStockPurchase);
router.get("/", authenticate, adminOnly, getAllStockPurchases);
router.get("/:id", authenticate, adminOnly, getStockPurchaseById);

export default router;
