import mongoose from "mongoose";

type MongooseCache = {
  connection: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseConnectionCache: MongooseCache | undefined;
}

const cache: MongooseCache =
  globalThis.mongooseConnectionCache ??
  (globalThis.mongooseConnectionCache = {
    connection: null,
    promise: null,
  });

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  if (cache.connection?.connection.readyState === 1) {
    return cache.connection;
  }

  if (cache.connection) {
    cache.connection = null;
    cache.promise = null;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(mongoUri)
      .then((connection) => {
        cache.connection = connection;
        return connection;
      })
      .catch((error: unknown) => {
        cache.connection = null;
        cache.promise = null;
        throw error;
      });
  }

  return cache.promise;
};
