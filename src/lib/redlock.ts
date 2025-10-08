import Redlock, { CompatibleRedisClient } from "redlock";
import { redis } from "./redis";

export const redlock = new Redlock(
  [redis as unknown as CompatibleRedisClient],
  {
    driftFactor: 0.01,
    retryCount: 3,
    retryDelay: 200,
    retryJitter: 200,
  }
);
