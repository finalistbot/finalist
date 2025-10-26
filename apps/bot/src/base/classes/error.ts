export class BracketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketError";
  }
}

export class CommandError extends BracketError {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}

export class CheckFailure extends CommandError {
  constructor(message: string) {
    super(message);
    this.name = "CommandCheckError";
  }
}
