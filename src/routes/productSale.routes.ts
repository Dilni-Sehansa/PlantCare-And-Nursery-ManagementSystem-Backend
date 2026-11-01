import { Router } from "express";
import {createProductSale,getAllProductSales,getProductSaleById,cancelProductSale,} from "../controllers/productSale.controller";
import {authenticate,adminOnly,} from "../middleware/auth.middleware";

const router = Router();
router.post("/", authenticate, adminOnly, createProductSale);
router.get("/", authenticate, adminOnly, getAllProductSales);
router.get("/:id", authenticate, adminOnly, getProductSaleById);
router.delete("/:id", authenticate, adminOnly, cancelProductSale);

export default router;