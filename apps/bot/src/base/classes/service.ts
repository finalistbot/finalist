import { BracketClient } from "./client";

export abstract class Service {
  constructor(protected client: BracketClient) {}
  async onStart(): Promise<void> {}
  async onStop(): Promise<void> {}
}
