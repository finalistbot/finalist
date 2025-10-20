import { Event } from '@/base/classes/event'
export default class GlobalErrorHandler extends Event<'error'> {
  public event: 'error' = 'error'
  async execute(error: Error): Promise<void> {
    console.error('Global error caught:', error)
  }
}
