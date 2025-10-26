import { Job } from "bullmq";

export interface JobHandler<T = any> {
  handle(job: Job<T>): Promise<void>;
}

export class JobRegistry {
  private handlers = new Map<string, JobHandler>();

  register(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }

  getHandler(jobName: string): JobHandler | undefined {
    return this.handlers.get(jobName);
  }

  getAllJobNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}
