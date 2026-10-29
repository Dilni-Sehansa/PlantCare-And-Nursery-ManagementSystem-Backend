import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import dns from "node:dns";
import path from "node:path";
import authRoutes from "./routes/auth.routes";
import plantRoutes from "./routes/plant.routes";
import plantTypeRoutes from "./routes/plantType.routes";



dotenv.config();
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.use("/api/plants", plantRoutes);

app.use("/api/plant-types", plantTypeRoutes);

app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"))
);


app.get("/", (req, res) => {
  res.send("Plant Care Backend is running!");
});

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env");
    }

    const conn = await mongoose.connect(mongoUri);

    console.log(
      `MongoDB Connected Successfully: ${conn.connection.host}`
    );
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
