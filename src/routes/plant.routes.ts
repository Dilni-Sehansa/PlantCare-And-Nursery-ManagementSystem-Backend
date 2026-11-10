import { Router } from "express";
import { upload } from "../middleware/upload";
import {createPlant,getAllPlants,getPlantById,updatePlant,deletePlant,getLowStockPlants,
  updatePlantStock,} from "../controllers/plant.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/", getAllPlants);
router.get("/:id", getPlantById);
router.get("/low-stock", getLowStockPlants, authenticate, adminOnly);
router.post("/", authenticate, adminOnly , upload.single("image"), createPlant);
router.patch("/:id", authenticate, adminOnly, upload.single("image"), updatePlant);
router.delete("/:id", authenticate, adminOnly ,deletePlant);
router.patch("/:id/stock", authenticate, adminOnly, updatePlantStock);

export default router;