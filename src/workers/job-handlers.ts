import { Job } from "bullmq";

import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { JobHandler } from "./job-registry";

import { ScrimService } from "@/services/scrim";

export class ScrimRegistrationHandler
  implements JobHandler<{ scrimId: number }>
{
  constructor(private scrimService: ScrimService) {}
  async handle(job: Job<{ scrimId: number }, any, string>): Promise<void> {
    const { scrimId } = job.data;
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      logger.error(`Scrim with id ${scrimId} not found`);
      return;
    }
    await this.scrimService.openRegistration(scrim);
  }
}

export class ScrimAutoCleanHandler implements JobHandler<{ scrimId: number }> {
  constructor(private scrimService: ScrimService) {}
  async handle(job: Job<{ scrimId: number }, any, string>): Promise<void> {
    const { scrimId } = job.data;
    const scrim = await prisma.scrim.findUnique({
      where: { id: scrimId },
    });
    if (!scrim) {
      logger.error(`Scrim with id ${scrimId} not found`);
      return;
    }
    await this.scrimService.autoClean(scrim);
  }
}
