import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import { connectToDatabase } from "./database";

test("coalesces concurrent MongoDB connections and retries after failure", async () => {
  const cache = globalThis.mongooseConnectionCache;
  assert.ok(cache);

  const originalConnect = mongoose.connect;
  const originalMongoUri = process.env.MONGO_URI;
  let connectCalls = 0;

  cache.connection = null;
  cache.promise = null;
  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/test";
  mongoose.connect = (() => {
    connectCalls += 1;
    if (connectCalls === 1) {
      return Promise.reject(new Error("simulated connection failure"));
    }
    return Promise.resolve(mongoose);
  }) as typeof mongoose.connect;

  try {
    const firstAttempts = await Promise.allSettled([
      connectToDatabase(),
      connectToDatabase(),
    ]);

    assert.equal(connectCalls, 1);
    assert.equal(firstAttempts[0].status, "rejected");
    assert.equal(firstAttempts[1].status, "rejected");

    assert.equal(await connectToDatabase(), mongoose);
    assert.equal(connectCalls, 2);
  } finally {
    mongoose.connect = originalConnect;
    cache.connection = null;
    cache.promise = null;
    if (originalMongoUri === undefined) {
      delete process.env.MONGO_URI;
    } else {
      process.env.MONGO_URI = originalMongoUri;
    }
  }
});
