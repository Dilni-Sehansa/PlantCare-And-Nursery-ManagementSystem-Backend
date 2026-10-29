import { Router } from "express";

import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
} from "../controllers/order.controller";

import {
  authenticate,
  adminOnly,
} from "../middleware/auth.middleware";

const router = Router();

router.post("/", authenticate, createOrder);

router.get("/", authenticate, getAllOrders);

router.get("/:id", authenticate, getOrderById);

router.patch("/:id/status", authenticate, adminOnly, updateOrderStatus);

router.patch("/:id/cancel", authenticate, cancelOrder);

router.delete("/:id", authenticate, adminOnly, deleteOrder);

export default router;