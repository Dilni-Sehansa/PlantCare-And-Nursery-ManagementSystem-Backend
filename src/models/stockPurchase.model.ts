import { Schema, Document, model } from "mongoose";

export enum PurchaseSource {
    SUPPLIER = "Supplier",
    SHOP = "Shop",
}

export enum StockPurpose {
    SELLING = "Selling",
    INTERNAL = "Internal",
}

export interface IStockPurchase extends Document {
    purchaseId: string;
    purchaseSource: PurchaseSource;
    stockPurpose: StockPurpose;
    supplierId?: string;
    sourceName: string;
    productId?: string;
    internalItemId?: string;
    itemName: string;
    quantity: number;
    buyingPrice: number;
    totalAmount: number;
    purchaseDate: Date;
}

const stockPurchaseSchema = new Schema<IStockPurchase>(
    {
        purchaseId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        purchaseSource: {
            type: String,
            enum: Object.values(PurchaseSource),
            required: true,
        },

        stockPurpose: {
            type: String,
            enum: Object.values(StockPurpose),
            required: true,
        },

        supplierId: {
            type: String,
            trim: true,
            uppercase: true,
        },

        sourceName: {
            type: String,
            required: true,
            trim: true,
        },

        productId: {
            type: String,
            trim: true,
            uppercase: true,
        },

        internalItemId: {
            type: String,
            trim: true,
            uppercase: true,
        },

        itemName: {
            type: String,
            required: true,
            trim: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: (value: number) => Number.isInteger(value),
                message: "Quantity must be a whole number",
            },
        },

        buyingPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        purchaseDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

export const StockPurchaseModel = model<IStockPurchase>(
    "System_StockPurchase",
    stockPurchaseSchema
);