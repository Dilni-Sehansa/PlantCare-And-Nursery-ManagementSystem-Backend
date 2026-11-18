
import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {ProductModel,ProductCategory,ProductStatus,} from "../models/product.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { CounterModel } from "../models/counter.model";


const findProduct = async (id: string) => {
    if (id.toUpperCase().startsWith("PRD")) {
        return await ProductModel.findOne({
            productId: id.toUpperCase(),
        });
    }

    if (isValidObjectId(id)) {
        return await ProductModel.findById(id);
    }

    return null;
};

const generateProductId = async (): Promise<string> => {
    const existingProductIds = await ProductModel.aggregate([
        {
            $match: {
                productId: { $regex: /^PRD\d+$/i },
            },
        },
        {
            $project: {
                numericId: {
                    $convert: {
                        input: {
                            $substrCP: [
                                "$productId",
                                3,
                                { $subtract: [{ $strLenCP: "$productId" }, 3] },
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
    ]);

    const maxExistingSequence = existingProductIds[0]?.maxSequence ?? 0;

    await CounterModel.updateOne(
        { _id: "productId" },
        {
            $max: {
                sequence: maxExistingSequence,
            },
        },
        { upsert: true }
    );

    const counter = await CounterModel.findOneAndUpdate(
        { _id: "productId" },
        {
            $inc: {
                sequence: 1,
            },
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );

    if (!counter) {
        throw new Error("Failed to generate Product ID");
    }

    return `PRD${String(counter.sequence).padStart(3, "0")}`;
};

const isAdminUser = (req: AuthRequest): boolean => {
    return (
        req.user?.role === "ADMIN" ||
        req.user?.role === "SUPER_ADMIN"
    );
};

const formatProductResponse = (product: any, isAdmin: boolean) => {
    const productData = product.toObject();

    if (isAdmin) {
        return productData;
    }

    return {
        _id: productData._id,
        productId: productData.productId,
        productName: productData.productName,
        category: productData.category,
        description: productData.description,
        unit: productData.unit,
        sellingPrice: productData.sellingPrice,
        imageUrl: productData.imageUrl,
    };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      productName,
      category,
      description,
      unit,
      buyingPrice,
      sellingPrice,
      imageUrl,
    } = req.body ?? {};

    if (
        typeof productName !== "string" ||
        !productName.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof unit !== "string" ||
        !unit.trim() ||
        !category
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (
        typeof category !== "string" ||
        !Object.values(ProductCategory).includes(
            category as ProductCategory)
        ) {
            return res.status(400).json({
                message: "Invalid product category",
            });
        }

        if (
            buyingPrice === undefined ||
            buyingPrice === null ||
            buyingPrice === "" ||
            (typeof buyingPrice !== "number" &&
                typeof buyingPrice !== "string") ||
            !Number.isFinite(Number(buyingPrice)) ||
            Number(buyingPrice) < 0
        ) {
            return res.status(400).json({
                message: "Invalid buying price",
            });
        }

        if (
            sellingPrice === undefined ||
            sellingPrice === null ||
            sellingPrice === "" ||
            (typeof sellingPrice !== "number" &&
                typeof sellingPrice !== "string") ||
            !Number.isFinite(Number(sellingPrice)) ||
            Number(sellingPrice) < 0
        ) {
            return res.status(400).json({
                message: "Invalid selling price",
            });
        }
        
        const buy = Number(buyingPrice);
        const sell = Number(sellingPrice);

     if (imageUrl !== undefined && imageUrl !== "") {
            if (typeof imageUrl !== "string") {
                return res.status(400).json({
                    message: "Invalid product image URL",
                });
            }

            try {
                const parsedUrl = new URL(imageUrl.trim());

                if (
                    parsedUrl.protocol !== "https:" ||
                    !parsedUrl.hostname
                ) {
                    return res.status(400).json({
                        message: "Invalid product image URL",
                    });
                }
            } catch {
                return res.status(400).json({
                    message: "Invalid product image URL",
                });
            }
        }

        const productId = await generateProductId();

        const product = await ProductModel.create({
            productId,
            productName: productName.trim(),
            category: category as ProductCategory,
            description: description.trim(),
            unit: unit.trim(),
            buyingPrice: buy,
            sellingPrice: sell,
            stock: 0,
            status: ProductStatus.ACTIVE,
            imageUrl:
                typeof imageUrl === "string"
                    ? imageUrl.trim()
                    : "",
        });

        return res.status(201).json({
            message: "Product created successfully",
            product,
        });
  } catch (error: any) {

    if (error.code === 11000) {
        return res.status(409).json({
            message: "Product ID or another unique field already exists",
        });
    }

    return res.status(500).json({
      message: error.message || "Failed to create product",
    });
  }
};

export const getAllProducts = async (req: AuthRequest, res: Response) => {
    try {
        const { search, category, status } = req.query;

        const filter: any = {};

        const isAdmin = isAdminUser(req);

        if (typeof search === "string" && search.trim()) {
            const escapedSearch = search
                .trim()
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const searchRegex = new RegExp(
                escapedSearch,
                "i"
            );

            filter.$or = [
                { productId: searchRegex },
                { productName: searchRegex },
                { description: searchRegex },
            ];
        }

        if (typeof category === "string") {
            if (
                !Object.values(ProductCategory).includes(
                    category as ProductCategory
                )
            ) {
                return res.status(400).json({
                    message: "Invalid product category",
                });
            }

            filter.category = category;
        }
        if (isAdmin) {
            if (typeof status === "string") {
                if (
                    !Object.values(ProductStatus).includes(
                        status as ProductStatus
                    )
                ) {
                    return res.status(400).json({
                        message: "Invalid product status",
                    });
                }

                filter.status = status;
            }else {
                filter.status = ProductStatus.ACTIVE;
            }
        }else {
            filter.status = ProductStatus.ACTIVE;
        }

        const products = await ProductModel.find(filter).sort({
            createdAt: -1,
        });

        const formattedProducts = products.map((product) =>
            formatProductResponse(product, isAdmin)
        );

        return res.status(200).json({
            count: formattedProducts.length,
            products: formattedProducts,
        });
    } catch (error) {
        console.error("Get Products Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const productId = req.params.id;

        if (typeof productId !== "string") {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await findProduct(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found or invalid product ID",
            });
        }

        const isAdmin = isAdminUser(req);

        if (!isAdmin && product.status !== ProductStatus.ACTIVE) {
            return res.status(404).json({
                message: "Product not found or inactive",
            });
        }

        return res.status(200).json({
            product: formatProductResponse(product, isAdmin),
        });
    } catch (error) {
        console.error("Get Product Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const updateProduct = async (req: Request,res: Response) => {
    try {
        const productId = req.params.id;

        if (typeof productId !== "string") {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await findProduct(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found or invalid product ID",
            });
        }

        const {
            productName,
            category,
            description,
            unit,
            buyingPrice,
            sellingPrice,
            status,
            stock,
            productId: requestedProductId,
            imageUrl,
        } = req.body ??{};

        if (
            stock !== undefined ||
            requestedProductId !== undefined
        ) {
            return res.status(400).json({
                message:
                    "Stock and product ID cannot be changed through this endpoint",
            });
        }

        if (productName !== undefined) {
            if (
                typeof productName !== "string" ||
                !productName.trim()
            ) {
                return res.status(400).json({
                    message: "Product name cannot be empty",
                });
            }

            product.productName = productName.trim();
        }

        if (category !== undefined) {
            if (
                typeof category !== "string" ||
                !Object.values(ProductCategory).includes(
                    category as ProductCategory
                )
            ) {
                return res.status(400).json({
                    message: "Invalid product category",
                });
            }

            product.category = category as ProductCategory;
        }

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                !description.trim()
            ) {
                return res.status(400).json({
                    message: "Description cannot be empty",
                });
            }

            product.description = description.trim();
        }

        if (unit !== undefined) {
            if (
                typeof unit !== "string" ||
                !unit.trim()
            ) {
                return res.status(400).json({
                    message: "Unit cannot be empty",
                });
            }

            product.unit = unit.trim();
        }

        if (buyingPrice !== undefined) {
            if (
                typeof buyingPrice !== "number" ||
                !Number.isFinite(buyingPrice) ||
                buyingPrice < 0
            ) {
                return res.status(400).json({
                    message: "Buying price must be a valid number",
                });
            }

            product.buyingPrice = buyingPrice;
        }

        if (sellingPrice !== undefined) {
            if (
                typeof sellingPrice !== "number" ||
                !Number.isFinite(sellingPrice) ||
                sellingPrice < 0
            ) {
                return res.status(400).json({
                    message: "Selling price must be a valid number",
                });
            }

            product.sellingPrice = sellingPrice;
        }

        if (status !== undefined) {
            if (
                typeof status !== "string" ||
                !Object.values(ProductStatus).includes(
                    status as ProductStatus
                )
            ) {
                return res.status(400).json({
                    message: "Invalid product status",
                });
            }

            product.status = status as ProductStatus;
        }

        if (imageUrl !== undefined) {

            if (typeof imageUrl !== "string") {
                return res.status(400).json({
                    message: "Invalid product image URL",
                });
            }

            if (imageUrl.trim() !== "") {
                try {
                    const parsedUrl = new URL(imageUrl.trim());

                    if (
                        parsedUrl.protocol !== "https:" ||
                        !parsedUrl.hostname
                    ) {
                        return res.status(400).json({
                            message: "Invalid product image URL",
                        });
                    }
                } catch {
                    return res.status(400).json({
                        message: "Invalid product image URL",
                    });
                }
            }

            product.imageUrl = imageUrl.trim();
        }

        await product.save();

        return res.status(200).json({
            message: "Product updated successfully",
            product,
        });
    } catch (error: any) {
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        console.error("Update Product Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const deactivateProduct = async (req: Request,res: Response) => {
    try {
        const productId = req.params.id;

        if (typeof productId !== "string") {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await findProduct(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found or invalid product ID",
            });
        }

        if (product.status === ProductStatus.INACTIVE) {
            return res.status(400).json({
                message: "Product is already inactive",
            });
        }

        product.status = ProductStatus.INACTIVE;

        await product.save();

        return res.status(200).json({
            message: "Product deactivated successfully",
            product,
        });
    } catch (error) {
        console.error("Deactivate Product Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const activateProduct = async (req: Request, res: Response) => {
    try {
        const productId = req.params.id;

        if (typeof productId !== "string") {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await findProduct(productId);

        if (!product) {
            return res.status(404).json({
                message: "Product not found or invalid product ID",
            });
        }

        if (product.status === ProductStatus.ACTIVE) {
            return res.status(400).json({
                message: "Product is already active",
            });
        }

        product.status = ProductStatus.ACTIVE;

        await product.save();

        return res.status(200).json({
            message: "Product activated successfully",
            product,
        });

    } catch (error) {
        console.error("Activate Product Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};