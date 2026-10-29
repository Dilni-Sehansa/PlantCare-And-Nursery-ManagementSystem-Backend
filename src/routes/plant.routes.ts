import { Router } from "express";
import { upload } from "../middleware/upload";
import {createPlant,getAllPlants,getPlantById,updatePlant,deletePlant,getLowStockPlants,
  updatePlantStock,} from "../controllers/plant.controller";

const router = Router();

router.get("/", getAllPlants);
router.get("/low-stock", getLowStockPlants);
router.get("/:id", getPlantById);
router.post("/", upload.single("image"), createPlant);
router.patch("/:id", upload.single("image"), updatePlant);
router.delete("/:id", deletePlant);
router.patch("/:id/stock", updatePlantStock);

export default router;