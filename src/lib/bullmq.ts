import { Queue } from 'bullmq'
import { redis } from './redis'

export const queue = new Queue('finalist', {
  connection: redis,
})
