export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** A domain rule a service enforces beyond the router's input schema. */
export class ValidationError extends Error {
  readonly code = "BAD_REQUEST" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
