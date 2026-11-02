export class HttpError extends Error {
  constructor(statusCode, message, details = undefined, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.expose = options.expose ?? statusCode < 500;
  }
}
