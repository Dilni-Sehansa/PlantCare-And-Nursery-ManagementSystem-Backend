
import express, { Router } from "express";
import multer from "multer";

import {
  uploadBankTransferSlip,
  getBankTransferSlip,
  verifyBankTransfer,
  selectOfflinePayment,
  confirmCODPayment,
  confirmCashAtNurseryPayment,
} from "../controllers/payment.controller";

import {authenticate,adminOnly,} from "../middleware/auth.middleware";
import { validatePaymentSlipSignature } from "../middleware/file-signature";

const router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/bank-transfer/:orderId",authenticate,upload.single("paymentSlip"),validatePaymentSlipSignature,uploadBankTransferSlip); // CHANGED
router.post("/:orderId/offline-method",authenticate,selectOfflinePayment);
router.get("/bank-transfer/:orderId/slip",authenticate,adminOnly,getBankTransferSlip);
router.patch("/bank-transfer/:orderId/verify",authenticate,adminOnly,verifyBankTransfer);
router.patch("/cod/:orderId/confirm",authenticate,adminOnly,confirmCODPayment);
router.patch("/cash-at-nursery/:orderId/confirm",authenticate,adminOnly,confirmCashAtNurseryPayment);
export default router;
