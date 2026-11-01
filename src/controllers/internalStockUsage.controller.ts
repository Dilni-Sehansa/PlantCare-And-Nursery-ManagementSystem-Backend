import { Request, Response } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { InternalStockModel } from "../models/internalStock.model";
import { InternalStockUsageModel } from "../models/internalStockUsage.model";

const generateUsageId = async (session: mongoose.ClientSession) => {

    const usages = await InternalStockUsageModel.find({})
        .select("usageId")
        .session(session);

    let maxNumber = 0;

    usages.forEach((usage) => {

        const number = parseInt(
            usage.usageId.replace("USG", ""),
            10
        );

        if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
        }

    });

    return `USG${String(maxNumber + 1).padStart(3, "0")}`;

};

export const createInternalStockUsage = async (req: Request,res: Response) => {

    const session = await mongoose.startSession();

    try {

        const {
            internalItemId,
            quantity,
            usageDate,
            notes,
        } = req.body;

        if (!internalItemId || !String(internalItemId).trim()) {
            return res.status(400).json({
                message: "Internal Item ID is required",
            });
        }


        if (
            quantity === undefined ||
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {
            return res.status(400).json({
                message: "Quantity must be a positive whole number",
            });
        }

        let parsedUsageDate = new Date();

        if (usageDate !== undefined) {

            parsedUsageDate = new Date(usageDate);

            if (isNaN(parsedUsageDate.getTime())) {
                return res.status(400).json({
                    message: "Invalid usage date",
                });
            }

        }

        let savedUsage;

        await session.withTransaction(async () => {

            let internalItem;

            if (isValidObjectId(internalItemId)) {

                internalItem = await InternalStockModel.findById(internalItemId)
                    .session(session)
            } else {
                internalItem = await InternalStockModel.findOne({
                    internalItemId,
                }).session(session);
            }

            if (!internalItem) {
                throw new Error("Internal stock item not found");
            }

            if (internalItem.stock < quantity) {
                throw new Error(
                    `Insufficient internal stock. Available stock: ${internalItem.stock}`
                );
            }

            const updatedItem = await InternalStockModel.findOneAndUpdate(
                {
                    _id: internalItem._id,
                    stock: { $gte: quantity },
                },
                {
                    $inc: {
                        stock: -quantity,
                    },
                },
                {
                    new: true,
                    session,
                }
            );

            if (!updatedItem) {
                throw new Error("Internal stock is insufficient");
            }

            const usageId = await generateUsageId(session);
            const usage = new InternalStockUsageModel({
                usageId,
                internalItemId: internalItem.internalItemId,
                itemName: internalItem.itemName,
                quantity,
                unit: internalItem.unit,
                usageDate: parsedUsageDate,
                notes,
            });

            const result = await InternalStockUsageModel.create(
                [usage],
                { session }
            );

            savedUsage = result[0];

        });

        return res.status(201).json({
            message: "Internal stock usage recorded successfully",
            usage: savedUsage,
        });


    } catch (error: any) {
        console.error("Create Internal Stock Usage Error:", error);

        if (
            error.message === "Internal stock item not found" ||
            error.message.startsWith("Insufficient internal stock") ||
            error.message === "Internal stock is insufficient"
        ) {
            return res.status(400).json({
                message: error.message,
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Duplicate usage ID",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message: "Failed to record internal stock usage",
        });

    } finally {
        await session.endSession();
    }

};

export const getAllInternalStockUsages = async (req: Request,res: Response) => {

    try {
        const {
            search,
            startDate,
            endDate,
        } = req.query;

        const filter: any = {};

        if (search) {

            filter.$or = [
                {
                    usageId: {
                        $regex: search,
                        $options: "i",
                    },
                },

                {
                    internalItemId: {
                        $regex: search,
                        $options: "i",
                    },
                },

                {
                    itemName: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (startDate || endDate) {
            filter.usageDate = {};

            if (startDate) {

                const start = new Date(String(startDate));
                if (isNaN(start.getTime())) {
                    return res.status(400).json({
                        message: "Invalid start date",
                    });
                }

                start.setHours(0, 0, 0, 0);
                filter.usageDate.$gte = start;
            }

            if (endDate) {
                const end = new Date(String(endDate));

                if (isNaN(end.getTime())) {
                    return res.status(400).json({
                        message: "Invalid end date",
                    });
                }

                end.setHours(23, 59, 59, 999);
                filter.usageDate.$lte = end;
            }
        }


        const usages = await InternalStockUsageModel.find(filter)
            .sort({ usageDate: -1 });

            return res.status(200).json({

            count: usages.length,
            usages,

        });


    } catch (error: any) {

        console.error("Get Internal Stock Usages Error:", error);

        return res.status(500).json({
            message: "Failed to get internal stock usages",
        });

    }

};

export const getInternalStockUsageById = async (req: Request,res: Response) => {

    try {
        const { id } = req.params;
        let usage;

        if (isValidObjectId(id)) {
            usage = await InternalStockUsageModel.findById(id);

        } else {
            usage = await InternalStockUsageModel.findOne({
                usageId: id,
            });
        }

        if (!usage) {
            return res.status(404).json({
                message: "Internal stock usage not found",
            });
        }

        return res.status(200).json({
            usage,
        });

    } catch (error: any) {

        console.error("Get Internal Stock Usage Error:", error);

        return res.status(500).json({
            message: "Failed to get internal stock usage",
        });
    }
};