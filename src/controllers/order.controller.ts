import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { OrderModel, OrderStatus, OrderItemType } from "../models/order.model";
import { PlantModel} from "../models/plant.model";
import { ProductModel, ProductStatus } from "../models/product.model";
import { AuthRequest } from "../middleware/auth.middleware";

type OrderItem =
  | {
      itemType: OrderItemType.PLANT;
      plant: any;
      plantId: string;
      plantName: string;
      quantity: number;
      price: number;
    }
  | {
      itemType: OrderItemType.PRODUCT;
      product: any;
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    };
type StockChange = {
  itemType: OrderItemType;
  itemId: string;
  quantity: number;
};

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

  const stockChanges: StockChange[] = [];

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

    const quantityMap = new Map<string, {
      itemType: OrderItemType;
      itemId: string;
      quantity: number;
    }>();

    for (const item of items) {

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
      
    const orderItems: OrderItem[] = [];

    let totalAmount = 0;

    for (const item of quantityMap.values()) {

      if (item.itemType === OrderItemType.PLANT) {
        const plant = await PlantModel.findOne({
          plantId: item.itemId,
        });

        if (!plant) {
          return res.status(404).json({
            success: false,
            message: `Plant not found: ${item.itemId}`,
          });
        }

        if (plant.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${plant.name}. Available stock: ${plant.stock}`,
          });
      }

      orderItems.push({
        itemType: OrderItemType.PLANT,
        plant: plant._id,
        plantId: plant.plantId,
        plantName: plant.name,
        quantity: item.quantity,
        price: plant.price,
      });

      totalAmount += plant.price * item.quantity;
    }

    else if (item.itemType === OrderItemType.PRODUCT) {
      const product = await ProductModel.findOne({
          productId: item.itemId,
        });
      
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.itemId}`,
          });
        }
        if (product.status !== ProductStatus.ACTIVE) {
          return res.status(400).json({
            success: false,
            message: `${product.productName} is currently inactive`,
          });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Not enough stock for ${product.productName}. Available stock: ${product.stock}`,
          });
        }

        orderItems.push({
          itemType: OrderItemType.PRODUCT,
          product: product._id,
          productId: product.productId,
          productName: product.productName,
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

      stockChanges.push({
        itemType: OrderItemType.PLANT,
        itemId: item.plantId,
        quantity: item.quantity,
      });
    }

    else if (item.itemType === OrderItemType.PRODUCT) {

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
          }
        );

        if (!updatedProduct) {
          throw new Error(
            `Not enough stock for ${item.productName}. Please try again.`
          );
        }

        stockChanges.push({
          itemType: OrderItemType.PRODUCT,
          itemId: item.productId,
          quantity: item.quantity,
        });
      }
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
    for (const item of stockChanges) {
      try {

        if (item.itemType === OrderItemType.PLANT) {

        await PlantModel.updateOne(
          { plantId: item.itemId },
          { $inc: { stock: item.quantity } }
        );

        } else if (item.itemType === OrderItemType.PRODUCT) {

          await ProductModel.updateOne(
            { productId: item.itemId },
            { $inc: { stock: item.quantity } }
          );

        }
      } catch (stockError) {
        console.error(
          `Stock restoration failed for ${item.itemType} ${item.itemId}:`,
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
        const itemType = item.itemType ?? OrderItemType.PLANT;

        if (itemType === OrderItemType.PLANT) {
          await PlantModel.updateOne(
          { _id: item.plant },
          { $inc: { stock: item.quantity } }
        );
        } else if (itemType === OrderItemType.PRODUCT) {
          await ProductModel.updateOne(
            {
              _id: item.product,
            },
            {
              $inc: { stock: item.quantity },
            }
          );
        }
        
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

    if (order.status !== OrderStatus.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Only cancelled orders can be deleted",
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