
import { Response } from "express";
import crypto from "node:crypto";
import { OrderModel, PaymentMethod, PaymentStatus} from "../models/order.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { supabase } from "../config/supabase";

const PAYMENT_BUCKET = process.env.SUPABASE_PAYMENT_BUCKET || "payment-slips";

const findOrder = async (orderId: string) => {
  if (/^[0-9a-fA-F]{24}$/.test(orderId)) {
    const order = await OrderModel.findById(orderId);

    if (order) {
      return order;
    }
  }

  return OrderModel.findOne({ orderId });
};

const isOrderOwner = (order: any, userId: string) => {
  return String(order.user) === userId;
};

export const uploadBankTransferSlip = async (req: AuthRequest,res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a payment slip",
      });
    }

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!isOrderOwner(order, req.user!.id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot upload a slip for this order",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid",
      });
    }

    const extension =
      file.mimetype === "application/pdf"
        ? "pdf"
        : file.mimetype === "image/png"
          ? "png"
          : "jpg";

    const filePath =
      `${order.orderId}/` +
      `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { data, error } = await supabase.storage
      .from(PAYMENT_BUCKET)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error || !data) {
      console.error(
        "Supabase Slip Upload Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to upload payment slip",
      });
    }

    order.paymentMethod = PaymentMethod.BANK_TRANSFER;
    order.paymentStatus = PaymentStatus.PENDING;

    order.paymentSlipUrl = data.path;

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment slip uploaded successfully. Waiting for admin verification.",
    });
  } catch (error) {
    console.error("Upload Bank Slip Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload payment slip",
    });
  }
};

export const getBankTransferSlip = async (req: AuthRequest,res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.paymentMethod !== PaymentMethod.BANK_TRANSFER ||
      !order.paymentSlipUrl
    ) {
      return res.status(404).json({
        success: false,
        message: "Payment slip not found",
      });
    }

    const { data, error } = await supabase.storage
      .from(PAYMENT_BUCKET)
      .createSignedUrl(order.paymentSlipUrl, 60 * 5);

    if (error || !data) {
      console.error("Create Signed URL Error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not access payment slip",
      });
    }

    return res.status(200).json({
      success: true,
      slipUrl: data.signedUrl,
    });
  } catch (error) {
    console.error("Get Bank Slip Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment slip",
    });
  }
};

export const verifyBankTransfer = async (req: AuthRequest,res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "approved must be true or false",
      });
    }

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.paymentMethod !== PaymentMethod.BANK_TRANSFER ||
      !order.paymentSlipUrl
    ) {
      return res.status(400).json({
        success: false,
        message: "No bank transfer slip is available",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "Payment is already confirmed",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be verified",
      });
    }

    order.paymentStatus = approved
      ? PaymentStatus.PAID
      : PaymentStatus.REJECTED;

    if (approved) {
      order.paymentDate = new Date();
    }

    order.verifiedBy = req.user!.id as any;
    order.verifiedAt = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message: approved
        ? "Bank transfer payment approved"
        : "Bank transfer payment rejected",
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("Verify Bank Transfer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify bank transfer",
    });
  }
};

export const selectOfflinePayment = async (req: AuthRequest,res: Response) => {
  try {
    const orderId = String(req.params.orderId);
    const { paymentMethod } = req.body;

    const allowedMethods = [
      PaymentMethod.COD,
      PaymentMethod.CASH_AT_NURSERY,
    ];

    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offline payment method",
      });
    }

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (!isOrderOwner(order, req.user!.id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot update this order",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
      });
    }

    order.paymentMethod = paymentMethod;
    order.paymentStatus = PaymentStatus.PENDING;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment method selected successfully",
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error("Select Offline Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to select payment method",
    });
  }
};


export const confirmCODPayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const orderId = String(req.params.orderId);

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentMethod !== PaymentMethod.COD) {
      return res.status(400).json({
        success: false,
        message: "This order is not Cash on Delivery",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "Payment is already confirmed",
      });
    }

    order.paymentStatus = PaymentStatus.PAID;
    order.paymentDate = new Date();
    order.verifiedBy = req.user!.id as any;
    order.verifiedAt = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message: "COD payment confirmed successfully",
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
    });
  } catch (error) {
    console.error("Confirm COD Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to confirm COD payment",
    });
  }
};


export const confirmCashAtNurseryPayment = async (req: AuthRequest,res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order = await findOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      order.paymentMethod !== PaymentMethod.CASH_AT_NURSERY
    ) {
      return res.status(400).json({
        success: false,
        message: "This order is not Cash at Nursery",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be paid",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "Payment is already confirmed",
      });
    }

    order.paymentStatus = PaymentStatus.PAID;
    order.paymentDate = new Date();
    order.verifiedBy = req.user!.id as any;
    order.verifiedAt = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Cash at Nursery payment confirmed successfully",
    });
  } catch (error) {
    console.error(
      "Confirm Cash at Nursery Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to confirm Cash at Nursery payment",
    });
  }
};
