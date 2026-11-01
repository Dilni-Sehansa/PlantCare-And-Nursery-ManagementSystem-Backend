import { Request, Response } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { ProductSaleModel } from "../models/productSale.model";
import { ProductModel,ProductStatus,} from "../models/product.model";

const generateSaleId = async (session: mongoose.ClientSession) => {
    const sales = await ProductSaleModel.find({})
        .select("saleId")
        .session(session);

    let maxNumber = 0;

    sales.forEach((sale) => {
        const number = parseInt(
            sale.saleId.replace("SAL", ""),
            10
        );

        if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
        }
    });

    return `SAL${String(maxNumber + 1).padStart(3, "0")}`;
};

export const createProductSale = async (req: Request,res: Response) => {
    const session = await mongoose.startSession();

    try {
        const {
            productId,
            quantity,
            saleDate,
        } = req.body;

        if (!productId || !String(productId).trim()) {
            return res.status(400).json({
                message: "Product ID is required",
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

        let parsedSaleDate = new Date();

        if (saleDate !== undefined) {
            parsedSaleDate = new Date(saleDate);

            if (isNaN(parsedSaleDate.getTime())) {
                return res.status(400).json({
                    message: "Invalid sale date",
                });
            }
        }

        let savedSale;

        await session.withTransaction(async () => {
            let product;

            if (isValidObjectId(productId)) {
                product = await ProductModel.findById(productId)
                    .session(session);
            } else {
                product = await ProductModel.findOne({ productId })
                    .session(session);
            }

            if (!product) {
                throw new Error("Product not found");
            }

            if (product.status !== ProductStatus.ACTIVE) {
                throw new Error("This product is inactive");
            }

            if (product.stock < quantity) {
                throw new Error(
                    `Insufficient stock. Available stock: ${product.stock}`
                );
            }

            const updatedProduct = await ProductModel.findOneAndUpdate(
                {
                    _id: product._id,
                    stock: { $gte: quantity },
                    status: ProductStatus.ACTIVE,
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

            if (!updatedProduct) {
                throw new Error(
                    "Stock is insufficient or product is inactive"
                );
            }

            const saleId = await generateSaleId(session);
            const totalAmount = quantity * product.sellingPrice;
            const sale = new ProductSaleModel({
                saleId,
                productId: product.productId,
                productName: product.productName,
                quantity,
                sellingPrice: product.sellingPrice,
                totalAmount,
                saleDate: parsedSaleDate,
            });
            const result = await ProductSaleModel.create(
                [sale],
                { session }
            );
            savedSale = result[0];
        });

        return res.status(201).json({
            message: "Product sale created successfully",
            sale: savedSale,
        });

    } catch (error: any) {
        console.error("Create Product Sale Error:", error);

        if (
            error.message === "Product not found" ||
            error.message === "This product is inactive" ||
            error.message.startsWith("Insufficient stock") ||
            error.message.startsWith("Stock is insufficient")
        ) {
            return res.status(400).json({
                message: error.message,
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Duplicate sale ID",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message: "Failed to create product sale",
        });

    } finally {
        await session.endSession();
    }
};

export const getAllProductSales = async (req: Request,res: Response) => {
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
                    saleId: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    productId: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    productName: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (startDate || endDate) {
            filter.saleDate = {};

            if (startDate) {
                const start = new Date(String(startDate));

                if (isNaN(start.getTime())) {
                    return res.status(400).json({
                        message: "Invalid start date",
                    });
                }

                start.setHours(0, 0, 0, 0);
                filter.saleDate.$gte = start;
            }

            if (endDate) {
                const end = new Date(String(endDate));

                if (isNaN(end.getTime())) {
                    return res.status(400).json({
                        message: "Invalid end date",
                    });
                }

                end.setHours(23, 59, 59, 999);
                filter.saleDate.$lte = end;
            }
        }

        const sales = await ProductSaleModel.find(filter)
            .sort({ saleDate: -1 });

        return res.status(200).json({
            count: sales.length,
            sales,
        });

    } catch (error: any) {
        console.error("Get Product Sales Error:", error);

        return res.status(500).json({
            message: "Failed to get product sales",
        });
    }
};


export const getProductSaleById = async (
    req: Request,
    res: Response
) => {
    try {
        const { id } = req.params;

        let sale;

        if (isValidObjectId(id)) {
            sale = await ProductSaleModel.findById(id);
        } else {
            sale = await ProductSaleModel.findOne({
                saleId: id,
            });
        }

        if (!sale) {
            return res.status(404).json({
                message: "Product sale not found",
            });
        }

        return res.status(200).json({
            sale,
        });

    } catch (error: any) {
        console.error("Get Product Sale Error:", error);

        return res.status(500).json({
            message: "Failed to get product sale",
        });
    }
};


export const cancelProductSale = async (req: Request,res: Response) => {
    const session = await mongoose.startSession();

    try {
        const { id } = req.params;

        let cancelledSale;

        await session.withTransaction(async () => {
            let sale;

            if (isValidObjectId(id)) {
                sale = await ProductSaleModel.findById(id)
                    .session(session);
            } else {
                sale = await ProductSaleModel.findOne({
                    saleId: id,
                }).session(session);
            }

            if (!sale) {
                throw new Error("Product sale not found");
            }

            const product = await ProductModel.findOne({
                productId: sale.productId,
            }).session(session);

            if (!product) {
                throw new Error(
                    "Product not found. Cannot restore stock"
                );
            }

            product.stock += sale.quantity;
            await product.save({ session });
            await ProductSaleModel.deleteOne({
                    _id: sale._id,
                },
                {
                    session,
                }
            );

            cancelledSale = sale;
        });

        return res.status(200).json({
            message: "Product sale cancelled and stock restored successfully",
            sale: cancelledSale,
        });

    } catch (error: any) {
        console.error("Cancel Product Sale Error:", error);

        if (
            error.message === "Product sale not found" ||
            error.message === "Product not found. Cannot restore stock"
        ) {
            return res.status(404).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message: "Failed to cancel product sale",
        });

    } finally {
        await session.endSession();
    }
};
