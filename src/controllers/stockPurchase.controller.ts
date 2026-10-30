
import { Request, Response } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { SupplierModel, Status} from "../models/supplier.model";
import { ProductModel,ProductCategory,ProductStatus} from "../models/product.model";
import {InternalStockModel} from "../models/internalStock.model";
import {StockPurchaseModel,PurchaseSource,StockPurpose} from "../models/stockPurchase.model";


async function generateNextId(
  model: any,
  field: string,
  prefix: string,
  session: any
){
  const records = await model
    .find({}, { [field]: 1 })
    .session(session);

  let maxNumber = 0;

  records.forEach((record: any) => {
    const id = record[field];

    if (id && id.startsWith(prefix)) {
      const number = Number(id.substring(prefix.length));

      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  return `${prefix}${String(maxNumber + 1).padStart(3, "0")}`;
}

async function findSupplier(id: string, session: any) {
  const conditions: any[] = [
    { supplierId: id }
  ];

  if (isValidObjectId(id)) {
    conditions.push({ _id: id });
  }

  return SupplierModel.findOne({
    $or: conditions
  }).session(session);
}

async function findProduct(id: string, session: any) {
  const conditions: any[] = [
    { productId: id }
  ];

  if (isValidObjectId(id)) {
    conditions.push({ _id: id });
  }

  return ProductModel.findOne({
    $or: conditions
  }).session(session);
}

async function findInternalItem(id: string, session: any) {
  const conditions: any[] = [
    { internalItemId: id }
  ];

  if (isValidObjectId(id)) {
    conditions.push({ _id: id });
  }

  return InternalStockModel.findOne({
    $or: conditions
  }).session(session);
}

export const createStockPurchase = async (req: Request,res: Response) => {
  const session = await mongoose.startSession();

  try {
    const {
      purchaseSource,
      stockPurpose,
      supplierId,
      sourceName,
      productId,
      internalItemId,
      itemName,
      category,
      description,
      unit,
      quantity,
      buyingPrice,
      sellingPrice,
      purchaseDate
    } = req.body;

    if (!Object.values(PurchaseSource).includes(purchaseSource)) {
      return res.status(400).json({
        message: "Invalid purchase source"
      });
    }

    if (!Object.values(StockPurpose).includes(stockPurpose)) {
      return res.status(400).json({
        message: "Invalid stock purpose"
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number"
      });
    }

    if (
      typeof buyingPrice !== "number" ||
      !Number.isFinite(buyingPrice) ||
      buyingPrice < 0
    ) {
      return res.status(400).json({
        message: "Invalid buying price"
      });
    }

    const selectedDate = purchaseDate
      ? new Date(purchaseDate)
      : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        message: "Invalid purchase date"
      });
    }

    let finalSourceName = sourceName;

    if (purchaseSource === PurchaseSource.SUPPLIER) {

      if (!supplierId) {
        return res.status(400).json({
          message: "Supplier ID is required"
        });
      }

      const supplier = await findSupplier(supplierId, session);

      if (!supplier) {
        return res.status(404).json({
          message: "Supplier not found"
        });
      }

      if (supplier.status !== Status.ACTIVE) {
        return res.status(400).json({
          message: "Selected supplier is inactive"
        });
      }

      finalSourceName = supplier.supplierName;
    }

    if (purchaseSource === PurchaseSource.SHOP) {

      if (!sourceName || !sourceName.trim()) {
        return res.status(400).json({
          message: "Shop name is required"
        });
      }

      finalSourceName = sourceName.trim();
    }


    let savedPurchase: any = null;


    await session.withTransaction(async () => {

      let savedProduct: any = null;
      let savedInternalItem: any = null;


      if (stockPurpose === StockPurpose.SELLING) {

        if (productId) {

          const product = await findProduct(productId, session);

          if (!product) {
            throw Object.assign(
              new Error("Product not found"),
              { statusCode: 404 }
            );
          }

          if (product.status !== ProductStatus.ACTIVE) {
            throw Object.assign(
              new Error("Selected product is inactive"),
              { statusCode: 400 }
            );
          }

          product.stock += quantity;
          product.buyingPrice = buyingPrice;

          await product.save({ session });

          savedProduct = product;
        }

        else {

          if (!itemName || !itemName.trim()) {
            throw Object.assign(
              new Error("Product name is required"),
              { statusCode: 400 }
            );
          }

          const trimmedName = itemName.trim();

          const existingProduct = await ProductModel.findOne({
            productName: trimmedName
          })
            .collation({
              locale: "en",
              strength: 2
            })
            .session(session);

          if (existingProduct) {

            if (existingProduct.status !== ProductStatus.ACTIVE) {
              throw Object.assign(
                new Error("Selected product is inactive"),
                { statusCode: 400 }
              );
            }

            existingProduct.stock += quantity;
            existingProduct.buyingPrice = buyingPrice;

            await existingProduct.save({ session });

            savedProduct = existingProduct;
          }

          else {

            if (
              !Object.values(ProductCategory).includes(
                category as ProductCategory
              )
            ) {
              throw Object.assign(
                new Error("Invalid product category"),
                { statusCode: 400 }
              );
            }

            if (!description || !unit) {
              throw Object.assign(
                new Error("Description and unit are required"),
                { statusCode: 400 }
              );
            }

            if (
              typeof sellingPrice !== "number" ||
              !Number.isFinite(sellingPrice) ||
              sellingPrice < 0
            ) {
              throw Object.assign(
                new Error("Invalid selling price"),
                { statusCode: 400 }
              );
            }


            const newProductId = await generateNextId(
              ProductModel,
              "productId",
              "PRD",
              session
            );


            const newProduct = await ProductModel.create(
              [
                {
                  productId: newProductId,
                  productName: trimmedName,
                  category: category as ProductCategory,
                  description,
                  unit,
                  buyingPrice,
                  sellingPrice,
                  stock: quantity,
                  status: ProductStatus.ACTIVE
                }
              ],
              { session }
            );

            savedProduct = newProduct[0];
          }
        }
      }

      else if (stockPurpose === StockPurpose.INTERNAL) {

        if (internalItemId) {

          const internalItem = await findInternalItem(
            internalItemId,
            session
          );

          if (!internalItem) {
            throw Object.assign(
              new Error("Internal item not found"),
              { statusCode: 404 }
            );
          }

          internalItem.stock += quantity;
          internalItem.buyingPrice = buyingPrice;

          await internalItem.save({ session });

          savedInternalItem = internalItem;
        }

        else {

          if (!itemName || !itemName.trim()) {
            throw Object.assign(
              new Error("Internal item name is required"),
              { statusCode: 400 }
            );
          }

          const trimmedName = itemName.trim();


          const existingInternalItem = await InternalStockModel.findOne({
            itemName: trimmedName
          })
            .collation({
              locale: "en",
              strength: 2
            })
            .session(session);

          if (existingInternalItem) {

            existingInternalItem.stock += quantity;
            existingInternalItem.buyingPrice = buyingPrice;

            await existingInternalItem.save({ session });

            savedInternalItem = existingInternalItem;
          }

          else {

            if (!category || !description || !unit) {
              throw Object.assign(
                new Error("Category, description and unit are required"),
                { statusCode: 400 }
              );
            }

            const newInternalItemId = await generateNextId(
              InternalStockModel,
              "internalItemId",
              "INS",
              session
            );


            const newInternalItem = await InternalStockModel.create(
              [
                {
                  internalItemId: newInternalItemId,
                  itemName: trimmedName,
                  category,
                  description,
                  unit,
                  stock: quantity,
                  buyingPrice
                }
              ],
              { session }
            );

            savedInternalItem = newInternalItem[0];
          }
        }
      }

      const purchaseId = await generateNextId(
        StockPurchaseModel,
        "purchaseId",
        "PUR",
        session
      );


      const totalAmount = quantity * buyingPrice;
      const newPurchase = await StockPurchaseModel.create(
        [
          {
            purchaseId,
            purchaseSource,
            stockPurpose,

            supplierId:
              purchaseSource === PurchaseSource.SUPPLIER
                ? supplierId
                : undefined,

            sourceName: finalSourceName,

            productId: savedProduct?.productId,

            internalItemId: savedInternalItem?.internalItemId,

            itemName:
              savedProduct?.productName ||
              savedInternalItem?.itemName,

            quantity,
            buyingPrice,
            totalAmount,
            purchaseDate: selectedDate
          }
        ],
        { session }
      );

      savedPurchase = newPurchase[0];

    });


    return res.status(201).json({
      message: "Stock purchase created successfully",
      purchase: savedPurchase
    });

  } catch (error: any) {

    console.error("Stock Purchase Error:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate ID detected. Please try again."
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    return res.status(500).json({
      message: "Failed to create stock purchase",
      error: error.message
    });

  } finally {
    await session.endSession();
  }
};

export const getAllStockPurchases = async (req: Request,res: Response) => {
  try {

    const {
      search,
      purchaseSource,
      stockPurpose
    } = req.query;

    const filter: any = {};


    if (search) {

      const searchValue = String(search);

      filter.$or = [
        { purchaseId: { $regex: searchValue, $options: "i" } },
        { itemName: { $regex: searchValue, $options: "i" } },
        { sourceName: { $regex: searchValue, $options: "i" } },
        { supplierId: { $regex: searchValue, $options: "i" } },
        { productId: { $regex: searchValue, $options: "i" } },
        { internalItemId: { $regex: searchValue, $options: "i" } }
      ];
    }


    if (purchaseSource) {
      filter.purchaseSource = purchaseSource;
    }

    if (stockPurpose) {
      filter.stockPurpose = stockPurpose;
    }


    const purchases = await StockPurchaseModel.find(filter)
      .sort({ purchaseDate: -1 });


    return res.status(200).json({
      message: "Stock purchases retrieved successfully",
      count: purchases.length,
      purchases
    });

  } catch (error: any) {

    console.error("Get Stock Purchases Error:", error);

    return res.status(500).json({
      message: "Failed to retrieve stock purchases",
      error: error.message
    });
  }
};

export const getStockPurchaseById = async (req: Request,res: Response) => {
  try {

    const { id } = req.params;

    const conditions: any[] = [
      { purchaseId: id }
    ];

    if (isValidObjectId(id)) {
      conditions.push({ _id: id });
    }


    const purchase = await StockPurchaseModel.findOne({
      $or: conditions
    });


    if (!purchase) {
      return res.status(404).json({
        message: "Stock purchase not found"
      });
    }


    return res.status(200).json({
      message: "Stock purchase retrieved successfully",
      purchase
    });

  } catch (error: any) {

    console.error("Get Stock Purchase Error:", error);

    return res.status(500).json({
      message: "Failed to retrieve stock purchase",
      error: error.message
    });
  }
};
