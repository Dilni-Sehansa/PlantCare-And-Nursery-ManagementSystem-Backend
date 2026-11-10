
import { Router } from "express";
import {getAllProducts,getProductById,updateProduct,deactivateProduct,createProduct} from "../controllers/product.controller";
import {authenticate,adminOnly,} from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, adminOnly, createProduct);
router.get("/", authenticate, getAllProducts);
router.get("/:id", authenticate, getProductById);
router.patch("/:id",authenticate,adminOnly,updateProduct);
router.patch("/:id/deactivate",authenticate,adminOnly,deactivateProduct);

export default router;
