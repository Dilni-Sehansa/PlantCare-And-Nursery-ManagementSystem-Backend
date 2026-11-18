import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { connectToDatabase } from "./config/database";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import plantRoutes from "./routes/plant.routes";
import plantTypeRoutes from "./routes/plantType.routes";
import orderRoutes from "./routes/order.routes";
import supplierRoutes from "./routes/supplier.routes";
import productRoutes from "./routes/product.routes";
import stockPurchaseRoutes from "./routes/stockPurchase.routes";
import internalStockRoutes from "./routes/internalStock.routes";
import productSaleRoutes from "./routes/productSale.routes";
import internalStockUsageRoutes from "./routes/internalStockUsage.routes";
import paymentRoutes from "./routes/payment.routes";


dotenv.config();

const app = express();

const allowedOrigins = new Set(["http://localhost:5173"]);
const frontendUrl = process.env.FRONTEND_URL?.trim();

if (process.env.NODE_ENV === "production" && !frontendUrl) {
  throw new Error("FRONTEND_URL is required in production");
}

if (frontendUrl) {
  let frontendOrigin: URL;
  try {
    frontendOrigin = new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL must be a valid absolute URL");
  }

  if (
    !["http:", "https:"].includes(frontendOrigin.protocol) ||
    frontendOrigin.username ||
    frontendOrigin.password ||
    frontendOrigin.pathname !== "/" ||
    frontendOrigin.search ||
    frontendOrigin.hash ||
    (process.env.NODE_ENV === "production" &&
      frontendOrigin.protocol !== "https:")
  ) {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin without a path");
  }

  allowedOrigins.add(frontendOrigin.origin);
}

app.use(cors({ origin: [...allowedOrigins] }));
app.use(express.json());
app.use(cookieParser());

app.use(async (_req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`MongoDB connection failed (${errorName})`);
    res.status(503).json({
      success: false,
      message: "Database unavailable",
    });
  }
});

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/plants", plantRoutes);

app.use("/api/plant-types", plantTypeRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/products", productRoutes);

app.use("/api/stock-purchases", stockPurchaseRoutes);

app.use("/api/internal-stock", internalStockRoutes);

app.use("/api/product-sales", productSaleRoutes);

app.use("/api/internal-stock-usages", internalStockUsageRoutes);

app.use("/api/payments", paymentRoutes);

app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"))
);


app.get("/", (_req, res) => {
  res.send("Plant Care Backend is running!");
});

export = app;
