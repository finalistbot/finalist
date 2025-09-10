export type Actor =
  | {
      type: "SYSTEM";
    }
  | {
      type: "ADMIN";
    };

export type EventType = "TEAM_REGISTERED" | "REGISTRATION_STARTED";

interface BaseEvent {
  timestamp: Date;
  actor?: Actor;
  type: EventType;
  metadata?: Record<string, unknown>;
}

export interface TeamRegisteredEvent extends BaseEvent {
  type: "TEAM_REGISTERED";
  metadata: {
    teamId: string;
    teamName: string;
  };
}

export interface RegistrationStartedEvent extends BaseEvent {
  type: "REGISTRATION_STARTED";
  metadata: {
    scrimId: string;
  };
}

export class EventLogger {
  async logEvent(event: BaseEvent): Promise<void> {}
}
