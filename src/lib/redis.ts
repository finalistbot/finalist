import config from '@/config'
import { Redis } from 'ioredis'

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: null,
})
