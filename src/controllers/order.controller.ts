import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { OrderModel, OrderStatus } from "../models/order.model";
import { PlantModel } from "../models/plant.model";
import { AuthRequest } from "../middleware/auth.middleware";


const generateOrderId = async (): Promise<string> => {
  const lastOrder = await OrderModel.findOne()
    .sort({ createdAt: -1 })
    .select("orderId");

  if (!lastOrder) {
    return "O001";
  }

  const match = lastOrder.orderId.match(/^O(\d+)$/i);

  if (!match) {
    throw new Error(
      "Existing Order ID format is invalid. Please check existing orders."
    );
  }

  const nextNumber = Number(match[1]) + 1;

  return `O${String(nextNumber).padStart(3, "0")}`;
};

// Save order
export const createOrder = async (req: AuthRequest, res: Response) => {

  const reducedStock: { plantId: string; quantity: number }[] = [];

  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const { items, shippingAddress, notes } = req.body;

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

    const quantityMap = new Map<string, number>();

    for (const item of items) {
      const plantId = String(item.plantId ?? "").trim().toUpperCase();
      const quantity = Number(item.quantity);

      if (!plantId) {
        return res.status(400).json({
          success: false,
          message: "Plant ID is required for every item",
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive whole number",
        });
      }

      quantityMap.set(
        plantId,
        (quantityMap.get(plantId) ?? 0) + quantity
      );
    }

    const orderItems = [];
    let totalAmount = 0;

    for (const [plantId, quantity] of quantityMap) {
      const plant = await PlantModel.findOne({ plantId });

      if (!plant) {
        return res.status(404).json({
          success: false,
          message: `Plant not found: ${plantId}`,
        });
      }

      if (plant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${plant.name}. Available stock: ${plant.stock}`,
        });
      }

      orderItems.push({
        plant: plant._id,
        plantId: plant.plantId,
        plantName: plant.name,
        quantity,
        price: plant.price,
      });

      totalAmount += plant.price * quantity;
    }

    for (const item of orderItems) {
      const updatedPlant = await PlantModel.findOneAndUpdate(
        {
          plantId: item.plantId,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
        },
        {
          new: true,
        }
      );

      if (!updatedPlant) {
        throw new Error(
          `Not enough stock for ${item.plantName}. Please try again.`
        );
      }

      reducedStock.push({
        plantId: item.plantId,
        quantity: item.quantity,
      });
    }

    const orderId = await generateOrderId();

    const order = await OrderModel.create({
      orderId,
      user: req.user.id,
      items: orderItems,
      totalAmount,
      status: OrderStatus.PENDING,
      shippingAddress: shippingAddress.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error: any) {
    for (const item of reducedStock) {
      try {
        await PlantModel.updateOne(
          { plantId: item.plantId },
          { $inc: { stock: item.quantity } }
        );
      } catch (stockError) {
        console.error(
          `Stock restoration failed for plant ${item.plantId}:`,
          stockError
        );
      }
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate Order ID detected. Please try creating the order again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create order",
    });
  }
};

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

    if (req.user.role !== "ADMIN") {
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

    if (req.user.role !== "ADMIN" && orderUserId !== req.user.id) {
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
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response
) => {
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

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update an order that is already ${order.status}`,
      });
    }
 
    order.status = status as OrderStatus;
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update order status",
    });
  }
};

// Cancel order
export const cancelOrder = async (req: AuthRequest, res: Response) => {
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

    if (req.user.role !== "ADMIN" && orderUserId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this order",
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    if (order.status === OrderStatus.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: "Delivered orders cannot be cancelled",
      });
    }

    const cancelledOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        status: {
          $nin: [OrderStatus.CANCELLED, OrderStatus.DELIVERED],
        },
      },
      {
        $set: { status: OrderStatus.CANCELLED },
      },
      {
        new: true,
      }
    );

    if (!cancelledOrder) {
      return res.status(409).json({
        success: false,
        message: "Order status has changed. Please refresh and try again.",
      });
    }

    try {
      for (const item of cancelledOrder.items) {
        await PlantModel.updateOne(
          { _id: item.plant },
          { $inc: { stock: item.quantity } }
        );
      }
    } catch (stockError) {
 
      console.error(
        `Stock restoration failed for order ${cancelledOrder.orderId}:`,
        stockError
      );

      return res.status(500).json({
        success: false,
        message:
          "Order was cancelled, but stock restoration failed. Please check the stock manually.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel order",
    });
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

    await OrderModel.deleteOne({ _id: order._id });

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