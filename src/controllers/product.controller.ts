
import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import {ProductModel,ProductCategory,ProductStatus,} from "../models/product.model";


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
  const last = await ProductModel.findOne()
    .sort({ createdAt: -1 })
    .select("productId");

  if (!last?.productId) {
    return "PRD001";
  }

  const match = String(last.productId).match(/^PRD(\d+)$/i);
  if (!match) {
    return "PRD001";
  }

  const next = Number(match[1]) + 1;
  return `PRD${String(next).padStart(3, "0")}`;
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
    } = req.body;

    if (
      !productName ||
      !category ||
      !description ||
      !unit ||
      buyingPrice === undefined ||
      sellingPrice === undefined
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (!Object.values(ProductCategory).includes(category)) {
      return res.status(400).json({
        message: "Invalid product category",
      });
    }

    const buy = Number(buyingPrice);
    const sell = Number(sellingPrice);

    if (!Number.isFinite(buy) || buy < 0) {
      return res.status(400).json({
        message: "Invalid buying price",
      });
    }

    if (!Number.isFinite(sell) || sell < 0) {
      return res.status(400).json({
        message: "Invalid selling price",
      });
    }

    if (imageUrl !== undefined &&(typeof imageUrl !== "string" ||(imageUrl !== "" && !imageUrl.startsWith("https://")))) {
        return res.status(400).json({
            message: "Invalid product image URL",
        });
    }

    const productId = await generateProductId();

    const product = await ProductModel.create({
      productId,
      productName: String(productName).trim(),
      category,
      description: String(description).trim(),
      unit: String(unit).trim(),
      buyingPrice: buy,
      sellingPrice: sell,
      stock: 0,
      status: ProductStatus.ACTIVE,
      imageUrl: imageUrl || "",
    });

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getAllProducts = async (req: Request,res: Response) => {
    try {
        const { search, category, status } = req.query;

        const filter: any = {};

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
        }

        const products = await ProductModel.find(filter).sort({
            createdAt: -1,
        });

        return res.status(200).json({
            count: products.length,
            products,
        });
    } catch (error) {
        console.error("Get Products Error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
};

export const getProductById = async (req: Request,res: Response) => {
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

        return res.status(200).json({
            product,
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
        } = req.body;

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
            if (
                typeof imageUrl !== "string" ||
                (imageUrl !== "" && !imageUrl.startsWith("https://"))
            ) {
                return res.status(400).json({
                    message: "Invalid product image URL",
                });
            }

            product.imageUrl = imageUrl;
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
