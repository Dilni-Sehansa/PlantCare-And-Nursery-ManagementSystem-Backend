import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { InternalStockModel } from "../models/internalStock.model";


export const getAllInternalStock = async (req: Request,res: Response) => {
    try {
        const { search } = req.query;
        const filter: any = {};

        if (typeof search === "string" && search.trim()) {
            const escapedSearch = search
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const searchRegex = new RegExp(escapedSearch, "i");

            filter.$or = [
                { internalItemId: searchRegex },
                { itemName: searchRegex },
                { category: searchRegex },
                { description: searchRegex },
            ];
        }

        const items = await InternalStockModel.find(filter).sort({
            createdAt: -1,
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            items,
        });

    } catch (error) {
        console.error("Get Internal Stock Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getInternalStockById = async (req: Request,res: Response) => {
    try {
        const id = req.params.id;

        if (typeof id !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invalid internal stock ID",
            });
        }

        let item = null;

        if (id.toUpperCase().startsWith("INS")) {
            item = await InternalStockModel.findOne({
                internalItemId: id.toUpperCase(),
            });
        }
        
        else if (isValidObjectId(id)) {
            item = await InternalStockModel.findById(id);
        }

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Internal stock item not found",
            });
        }

        return res.status(200).json({
            success: true,
            item,
        });

    } catch (error) {
        console.error("Get Internal Stock Item Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const updateInternalStock = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (typeof id !== "string" || !id.trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid internal stock ID",
            });
        }

        const conditions: any[] = [{ internalItemId: id.toUpperCase() }];
        if (isValidObjectId(id)) {
            conditions.push({ _id: id });
        }

        const item = await InternalStockModel.findOne({ $or: conditions });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Internal stock item not found",
            });
        }

        const { itemName, category, description, unit, stock, buyingPrice } =
            req.body;

        if (itemName !== undefined) {
            if (typeof itemName !== "string" || !itemName.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Item name cannot be empty",
                });
            }
            item.itemName = itemName.trim();
        }

        if (category !== undefined) {
            if (typeof category !== "string" || !category.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Category cannot be empty",
                });
            }
            item.category = category.trim();
        }

        if (description !== undefined) {
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Description cannot be empty",
                });
            }
            item.description = description.trim();
        }

        if (unit !== undefined) {
            if (typeof unit !== "string" || !unit.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Unit cannot be empty",
                });
            }
            item.unit = unit.trim();
        }

        if (stock !== undefined) {
            if (stock === null || String(stock).trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Stock is required",
                });
            }
            const parsedStock = Number(stock);
            if (!Number.isInteger(parsedStock) || parsedStock < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Stock must be a whole number greater than or equal to zero",
                });
            }
            item.stock = parsedStock;
        }

        if (buyingPrice !== undefined) {
            if (buyingPrice === null || String(buyingPrice).trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: "Buying price is required",
                });
            }
            const parsedBuyingPrice = Number(buyingPrice);
            if (!Number.isFinite(parsedBuyingPrice) || parsedBuyingPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Buying price must be a valid number greater than or equal to zero",
                });
            }
            item.buyingPrice = parsedBuyingPrice;
        }

        await item.save();
        return res.status(200).json({
            success: true,
            message: "Internal stock item updated successfully",
            item,
        });
    } catch (error) {
        console.error("Update Internal Stock Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update internal stock item",
        });
    }
};

export const deleteInternalStock = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (typeof id !== "string" || !id.trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid internal stock ID",
            });
        }

        const conditions: any[] = [{ internalItemId: id.toUpperCase() }];
        if (isValidObjectId(id)) {
            conditions.push({ _id: id });
        }

        const item = await InternalStockModel.findOneAndDelete({
            $or: conditions,
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Internal stock item not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Internal stock item deleted successfully",
            item,
        });
    } catch (error) {
        console.error("Delete Internal Stock Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete internal stock item",
        });
    }
};