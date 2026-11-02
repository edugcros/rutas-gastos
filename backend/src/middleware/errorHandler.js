export function notFoundHandler(req, _res, next) {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || (error.name === 'ZodError' ? 400 : 500);
  const payload = {
    success: false,
    message: status >= 500 && !error.expose ? 'Ocurrió un error interno.' : error.message,
  };

  if (error.code) payload.code = error.code;
  if (typeof error.retryable === 'boolean') payload.retryable = error.retryable;
  if (Number.isInteger(error.retryAfterSeconds) && error.retryAfterSeconds > 0) {
    payload.retryAfterSeconds = error.retryAfterSeconds;
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
  }

  if (error.name === 'ZodError') payload.details = error.issues;
  else if (error.details) payload.details = error.details;

  if (process.env.NODE_ENV !== 'production') {
    payload.debug = error.message;
  }

  // No registrar prompts, tokens ni credenciales. El proveedor puede incluir
  // contenido sensible en sus mensajes, por eso solo se registra código/status.
  if (status >= 500) {
    console.error('[API_ERROR]', {
      status,
      code: error.code || error.name,
      message: error.message,
    });
  }

  res.status(status).json(payload);
}
