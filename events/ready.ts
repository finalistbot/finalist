import { Event } from "@/base/classes/event";
import logger from "@/lib/logger";

export default class Ready extends Event<"clientReady"> {
  public event = "clientReady" as const;
  public once: boolean = true;
  public async execute() {
    logger.info(`Logged in as ${this.client.user?.tag}!`);
  }
}
