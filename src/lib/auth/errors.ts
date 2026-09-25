export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required.");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("You do not have access to this resource.");
    this.name = "ForbiddenError";
  }
}
