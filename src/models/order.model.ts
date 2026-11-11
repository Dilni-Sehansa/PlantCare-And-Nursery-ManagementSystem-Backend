import { Schema, Document, model, Types } from "mongoose";

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum OrderItemType {
  PLANT = "PLANT",
  PRODUCT = "PRODUCT",
}

export interface IOrderItem {
  itemType: OrderItemType;
  plant?: Types.ObjectId;
  product?: Types.ObjectId;
  plantId?: string;
  plantName?: string;
  plantImage?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  orderId: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  notes: string;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    itemType: {
      type: String,
      enum: Object.values(OrderItemType),
      required: true,
      default: OrderItemType.PLANT,
    },

    plant: {
      type: Schema.Types.ObjectId,
      ref: "system_plants",
    },

    product: {
      type: Schema.Types.ObjectId,
      ref: "System_Product",
    },

    plantId: {
      type: String,
    },

    plantName: {
      type: String,
    },

    plantImage: {
      type: String,
      default: "",
    },

    productId: {
      type: String,
    },

    productName: {
      type: String,
    },

    productImage: {
      type: String,
      default: "",
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (value: IOrderItem[]) =>
          Array.isArray(value) && value.length > 0,
        message: "Order must have at least one item",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },

    shippingAddress: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export const OrderModel = model<IOrder>("system_orders", orderSchema);