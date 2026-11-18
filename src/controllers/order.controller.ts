import { Response } from "express";
import PDFDocument from "pdfkit";
import mongoose,{ isValidObjectId } from "mongoose";
import {
  OrderModel,
  OrderStatus,
  OrderItemType,
  PaymentMethod,
  PaymentStatus,
} from "../models/order.model";
import { PlantModel} from "../models/plant.model";
import { ProductModel, ProductStatus } from "../models/product.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { CounterModel } from "../models/counter.model"; 

type OrderItem =
  | {
      itemType: OrderItemType.PLANT;
      plant: any;
      plantId: string;
      plantName: string;
      plantImage: string;
      quantity: number;
      price: number;
    }
  | {
      itemType: OrderItemType.PRODUCT;
      product: any;
      productId: string;
      productName: string;
      productImage: string;
      quantity: number;
      price: number;
    };
type StockChange = {
  itemType: OrderItemType;
  itemId: string;
  quantity: number;
};

const generateOrderId = async (session?: mongoose.ClientSession): Promise<string> => {
  const existingOrderIds = await OrderModel.aggregate([
    {
      $match: {
        orderId: { $regex: /^O\d+$/i },
      },
    },
    {
      $project: {
        numericId: {
          $convert: {
            input: {
              $substrCP: [
                "$orderId",
                1,
                { $subtract: [{ $strLenCP: "$orderId" }, 1] },
              ],
            },
            to: "int",
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        maxSequence: { $max: "$numericId" },
      },
    },
  ]).session(session ?? null);

  const maxExistingSequence = existingOrderIds[0]?.maxSequence ?? 0;

  await CounterModel.updateOne(
    { _id: "orderId" },
    {
      $max: {
        sequence: maxExistingSequence,
      },
    },
    {
      upsert: true,
      session,
    }
  );

  const counter = await CounterModel.findOneAndUpdate(
    { _id: "orderId" },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    }
  );

  if (!counter) {
    throw new Error("Failed to generate Order ID");
  }

  return `O${String(counter.sequence).padStart(3, "0")}`;
};

// Save order
export const createOrder = async (req: AuthRequest, res: Response) => {

  const session = await mongoose.startSession();


  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const { items, shippingAddress, notes, paymentMethod } = req.body;

    const selectedPaymentMethod =
      typeof paymentMethod === "string"
        ? paymentMethod.trim().toUpperCase()
        : undefined;

    if (!selectedPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (
      !Object.values(PaymentMethod).includes(
        selectedPaymentMethod as PaymentMethod
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one plant to the order",
      });
    }

    if (
      typeof shippingAddress !== "string" ||
      !shippingAddress.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    const quantityMap = new Map<string, {
      itemType: OrderItemType;
      itemId: string;
      quantity: number;
    }>();

    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({
          success: false,
          message: "Every order item must be an object",
        });
      }

      const itemType = String(
        item.itemType ?? OrderItemType.PLANT
      ).toUpperCase() as OrderItemType;

      if (!Object.values(OrderItemType).includes(itemType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order item type",
        });
      }

      const itemId = String(
        itemType === OrderItemType.PLANT
          ? item.plantId ?? item.itemId ?? ""
          : item.productId ?? item.itemId ?? ""
      ).trim().toUpperCase();

      const quantity = Number(item.quantity);

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: "Item ID is required for every item",
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive whole number",
        });
      }

      const key = `${itemType}:${itemId}`;
      const existingItem = quantityMap.get(key);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        quantityMap.set(key, {
          itemType,
          itemId,
          quantity,
        });
      }
    }

    let createdOrder: any;
    await session.withTransaction(async () => {
      
    const orderItems: OrderItem[] = [];

    let totalAmount = 0;

    for (const item of quantityMap.values()) {

      if (item.itemType === OrderItemType.PLANT) {

        const plant = await PlantModel.findOne({
          plantId: item.itemId,
        }).session(session);

        if (!plant) {
          throw Object.assign(new Error(`Plant not found: ${item.itemId}`), {
            statusCode: 404,
          });
        }

        if(plant.isUpcoming &&
          (!plant.availableAt || plant.availableAt.getTime() > Date.now())
        ){
          throw Object.assign(
              new Error(`${plant.name} is not available until its release date`),
              { statusCode: 400 }
            );
        }

        if (plant.stock < item.quantity) {
          throw Object.assign(
            new Error(`Not enough stock for ${plant.name}. Available stock: ${plant.stock}`),
            { statusCode: 400 }
          );
        }

      orderItems.push({
        itemType: OrderItemType.PLANT,
        plant: plant._id,
        plantId: plant.plantId,
        plantName: plant.name,
        plantImage: plant.image || "",
        quantity: item.quantity,
        price: plant.price,
      });

      totalAmount += plant.price * item.quantity;
    }

    else if (item.itemType === OrderItemType.PRODUCT) {
      const product = await ProductModel.findOne({
          productId: item.itemId,
        }).session(session);
      
        if (!product) {
          throw Object.assign(new Error(`Product not found: ${item.itemId}`), {
            statusCode: 404,
          });
        }
        if (product.status !== ProductStatus.ACTIVE) {
          throw Object.assign(new Error(`Product ${product.productName} is not active`), {
            statusCode: 400,
          });
        }

        if (product.stock < item.quantity) {
          throw Object.assign(
            new Error(`Not enough stock for ${product.productName}. Available stock: ${product.stock}`),
            { statusCode: 400 }
          );
        }

        orderItems.push({
          itemType: OrderItemType.PRODUCT,
          product: product._id,
          productId: product.productId,
          productName: product.productName,
          productImage: product.imageUrl || "",
          quantity: item.quantity,
          price: product.sellingPrice,
        });

        totalAmount += product.sellingPrice * item.quantity;
      }
    }

    for (const item of orderItems) {
      if (item.itemType === OrderItemType.PLANT) {
        const updatedPlant = await PlantModel.findOneAndUpdate(
        {
          plantId: item.plantId,
          stock: { $gte: item.quantity },
          $or: [
                { isUpcoming: { $ne: true } },
                { availableAt: { $lte: new Date() } },
              ],
            },
        {
          $inc: { stock: -item.quantity },
        },
        {
          new: true,
          session,
        }
      );
      

      if (!updatedPlant) {
        throw Object.assign(
          new Error(
            `Not enough stock for ${item.plantName}. Please try again.`
          ),
          { statusCode: 400 }
        );
      }
    }else if (item.itemType === OrderItemType.PRODUCT) {
      const updatedProduct = await ProductModel.findOneAndUpdate(
        {
          productId: item.productId,
          stock: { $gte: item.quantity },
          status: ProductStatus.ACTIVE,
        },
        {
          $inc: { stock: -item.quantity },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedProduct) {
        throw Object.assign(
          new Error(
            `Not enough stock for ${item.productName}. Please try again.`
          ),
          { statusCode: 400 }
        );
      }
    }
  }

  const orderId = await generateOrderId(session);

      const order = new OrderModel({
        orderId,
        user: req.user!.id,
        items: orderItems,
        totalAmount,
        status: OrderStatus.PENDING,
        paymentMethod: selectedPaymentMethod as PaymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        shippingAddress: shippingAddress.trim(),
        notes: typeof notes === "string" ? notes.trim() : "",
      });

      await order.save({ session });

      createdOrder = order;
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: createdOrder,
    });
  } catch (error: any) {
    if (error?.code === 11000) { 
      return res.status(409).json({
        success: false,
        message: "Duplicate Order ID detected. Please try creating the order again.",
      });
    }
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  }finally {
    await session.endSession();
  }};
 
// Get all orders
export const getAllOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.user.role === "USER") {
      filter.user = req.user.id;
    }

    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();

      if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      filter.status = status;
    }

    const orders = await OrderModel.find(filter)
      .populate("user", "firstName lastName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await OrderModel.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch orders",
    });
  }
};

// filter order
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);

    const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    ).populate("user", "firstName lastName email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderUserId = (order.user as any)._id?.toString?.()
      ?? order.user.toString();

    if (req.user.role === "USER" && orderUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this order",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch order",
    });
  }
};

// Update order status
export const getOrderPdf = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);
    const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    ).populate("user", "firstName lastName email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderUserId = (order.user as any)._id?.toString?.() ?? order.user.toString();

    if (req.user.role === "USER" && orderUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to download this order receipt",
      });
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nurix-order-${order.orderId}.pdf"`
    );

    doc.pipe(res);
    doc.fontSize(24).text("NURIX", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Order Number: ${order.orderId}`);
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    doc.fontSize(11).text(`Order Date: ${createdAt.toLocaleString()}`);
    doc.text(`Customer: ${(order.user as any)?.firstName || ""} ${(order.user as any)?.lastName || ""}`.trim());
    doc.text(`Email: ${(order.user as any)?.email || "N/A"}`);
    doc.text(`Phone: ${(order.user as any)?.phone || "N/A"}`);
    doc.text(`Payment Method: ${order.paymentMethod || "N/A"}`);
    doc.text(`Payment Status: ${order.paymentStatus}`);
    doc.text(`Order Status: ${order.status}`);
    doc.moveDown();

    doc.fontSize(14).text("Items");
    order.items.forEach((item) => {
      const itemName = item.itemType === OrderItemType.PLANT ? item.plantName : item.productName;
      const line = `${itemName} x ${item.quantity} @ ${Number(item.price).toFixed(2)} = ${Number(item.price * item.quantity).toFixed(2)}`;
      doc.fontSize(10).text(line);
    });

    doc.moveDown();
    doc.fontSize(14).text(`Total Amount: ${Number(order.totalAmount).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(12).text("Shipping Address:");
    doc.text(order.shippingAddress);
    if (order.notes) {
      doc.moveDown();
      doc.text(`Notes: ${order.notes}`);
    }

    doc.end();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate order PDF",
    });
  }
};

export const updateOrderStatus = async (req: AuthRequest,res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);
    const status = String(req.body.status ?? "").toUpperCase();

    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    if (status === OrderStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Please use the cancel order endpoint",
      });
    }

    const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.PROCESSING,
      ],
      [OrderStatus.PROCESSING]: [
        OrderStatus.DELIVERED,
      ],
      [OrderStatus.CONFIRMED]: [],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };
    
    const currentStatus = order.status;

    if (!allowedTransitions[currentStatus].includes(status as OrderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change order status from ${currentStatus} to ${status}`,
      });
    }

    const updatedOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: currentStatus,
      },
      {
        $set: {
          status: status as OrderStatus,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "Order status has changed. Please refresh and try again.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    }); 
  } catch (error: any) {

    console.error("Update Order Status Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};

// Cancel order
export const cancelOrder = async (req: AuthRequest, res: Response) => {

  const session = await mongoose.startSession();
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);
    let cancelledOrder: any;

    await session.withTransaction(async () => {
      const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    ).session(session);

    if (!order) {
      throw Object.assign(new Error("Order not found"), { statusCode: 404 });
    }

    const orderUserId = order.user.toString();

    if (req.user!.role === "USER" && orderUserId !== req.user!.id) {
      throw Object.assign(new Error("You are not allowed to cancel this order"), { statusCode: 403 });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw Object.assign(
        new Error("Paid orders cannot be cancelled because refunds are not supported"),
        { statusCode: 400 }
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw Object.assign(
        new Error("Order is already cancelled"),
        { statusCode: 400 }
      );
    }
    if (order.status === OrderStatus.DELIVERED) {
        throw Object.assign(
          new Error("Delivered orders cannot be cancelled"),
          { statusCode: 400 }
        );
      }
      
    const updatedOrder = await OrderModel.findOneAndUpdate({
      _id: order._id,
      paymentStatus: { $ne: PaymentStatus.PAID },
      status: {
        $nin: [OrderStatus.CANCELLED, OrderStatus.DELIVERED],
      },
    },
    {
      $set: { status: OrderStatus.CANCELLED },
    },
    {
      new: true,
      session,
    });

    if (!updatedOrder) {
      throw Object.assign(new Error("Order status has changed. Please refresh and try again."), { statusCode: 409 });
    }

    for (const item of updatedOrder.items) {
        const itemType = item.itemType ?? OrderItemType.PLANT;

        if (itemType === OrderItemType.PLANT) {
          const restoredPlant = await PlantModel.updateOne(
            {
              _id: item.plant},
              {$inc: { stock: item.quantity } },
            { session }
        );

        if (restoredPlant.matchedCount !== 1){
          throw new Error(`Plant stock restoration failed for order ${updatedOrder.orderId}`);
        } 
        } else if (itemType === OrderItemType.PRODUCT) {

          const restoredProduct = await ProductModel.updateOne(
            {_id: item.product},
            {$inc: { stock: item.quantity } },
            { session }
          );

          if (restoredProduct.matchedCount !== 1){
            throw new Error(`Product stock restoration failed for order ${updatedOrder.orderId}`);
          }
        }
      }
      
      cancelledOrder = await OrderModel.findById(updatedOrder._id)
      .session(session);
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });

  } catch (error: any) {
  return res.status(error?.statusCode || 500).json({
    success: false,
    message: error.message || "Failed to cancel order",
  });
  } finally {
    await session.endSession();
  }
};

// Delete order 
export const deleteOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);

    const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: "Paid orders cannot be deleted because refunds are not supported",
      });
    }

    if (order.status !== OrderStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Only cancelled orders can be deleted",
      });
    }

    const deletion = await OrderModel.deleteOne({
      _id: order._id,
      paymentStatus: { $ne: PaymentStatus.PAID },
    });

    if (deletion.deletedCount !== 1) {
      return res.status(400).json({
        success: false,
        message: "Paid orders cannot be deleted because refunds are not supported",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete order",
    });
  }
};


export const confirmOrderReceived = async (req: AuthRequest,res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const id = String(req.params.id);

    const order = await OrderModel.findOne(
      isValidObjectId(id)
        ? { $or: [{ orderId: id.toUpperCase() }, { _id: id }] }
        : { orderId: id.toUpperCase() }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderUserId = order.user.toString();

    if (req.user.role !== "USER" || orderUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to confirm this order",
      });
    }

    if (order.status !== OrderStatus.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: "You can confirm receipt only after the order is delivered",
      });
    }

    const updatedOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        user: req.user.id,
        status: OrderStatus.DELIVERED,
      },
      {
        $set: {
          status: OrderStatus.CONFIRMED,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "Order status has changed. Please refresh and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order receipt confirmed successfully",
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error("Confirm Order Received Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to confirm order receipt",
    });
  }
};