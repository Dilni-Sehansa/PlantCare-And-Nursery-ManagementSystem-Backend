import { Router } from "express";

import {createSupplier,getAllSuppliers,getSupplierById,updateSupplier,deleteSupplier,} from "../controllers/supplier.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, adminOnly, getAllSuppliers);

router.get("/:id", authenticate, adminOnly, getSupplierById);

router.post("/", authenticate, adminOnly, createSupplier);

router.patch("/:id", authenticate, adminOnly, updateSupplier);

router.delete("/:id", authenticate, adminOnly, deleteSupplier);

export default router;
