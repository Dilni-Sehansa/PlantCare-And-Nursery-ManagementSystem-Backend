import app from "./index";
import { connectToDatabase } from "./config/database";
import dns from "node:dns";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error(`Backend startup failed (${errorName})`);
  process.exitCode = 1;
});
