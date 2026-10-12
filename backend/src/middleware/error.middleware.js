import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle known AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle PostgreSQL unique constraint violations (code 23505)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: {
        message: 'A duplicate record with this unique value already exists.',
        details: err.detail,
      },
    });
  }

  // Handle PostgreSQL foreign key violations (code 23503)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Referenced entity does not exist.',
        details: err.detail,
      },
    });
  }

  // Unexpected internal server error
  console.error('💥 Unhandled Internal Error:', err);

  const response = {
    success: false,
    error: {
      message: 'Internal server error occurred',
    },
  };

  // Only expose stack trace in non-production
  if (env.NODE_ENV !== 'production') {
    response.error.stack = err.stack;
    response.error.raw = err.message;
  }

  res.status(500).json(response);
};

export const notFoundHandler = (req, res, next) => {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};
