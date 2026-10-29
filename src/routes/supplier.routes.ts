import { Router } from "express";

import {createSupplier,getAllSuppliers,getSupplierById,updateSupplier,deleteSupplier,} from "../controllers/supplier.controller";

const router = Router();

router.get("/", getAllSuppliers);

router.get("/:id", getSupplierById);

router.post("/", createSupplier);

router.patch("/:id", updateSupplier);

router.delete("/:id", deleteSupplier);

export default router;
