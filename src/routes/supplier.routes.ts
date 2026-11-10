import { Router } from "express";

import {createSupplier,getAllSuppliers,getSupplierById,updateSupplier,deleteSupplier,} from "../controllers/supplier.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/", getAllSuppliers, authenticate, adminOnly);

router.get("/:id", getSupplierById, authenticate, adminOnly);

router.post("/", createSupplier, authenticate, adminOnly);

router.patch("/:id", updateSupplier, authenticate, adminOnly);

router.delete("/:id", deleteSupplier, authenticate, adminOnly);

export default router;
