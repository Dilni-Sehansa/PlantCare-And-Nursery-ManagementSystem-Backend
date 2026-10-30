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