export class BracketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BracketError";
  }
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}

export class CommandCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandCheckError";
  }
}
