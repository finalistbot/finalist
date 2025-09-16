import { ScrimService } from "@/services/scrim";
import { createWorker } from "@/workers/worker";
import { Worker } from "bullmq";
import { Client, ClientOptions } from "discord.js";

export class BracketClient extends Client {
  public ownerIds: Set<string>;
  public scrimService: ScrimService;
  public worker: Worker;

  constructor(options: ClientOptions, extra?: { ownerIds?: string[] }) {
    super(options);
    this.ownerIds = new Set(extra?.ownerIds);
    this.scrimService = new ScrimService(this);
    this.worker = createWorker(this);
  }

  isOwner(userId: string): boolean {
    if (this.application?.owner?.id === userId) return true;
    return this.ownerIds.has(userId);
  }
}
