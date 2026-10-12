import { AppError } from '../utils/app-error.js';

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return next(new AppError('Validation failed', 400, errorDetails));
  }
  req.body = result.data;
  next();
};

export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return next(new AppError('Invalid route parameters', 400, errorDetails));
  }
  req.params = result.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return next(new AppError('Invalid query parameters', 400, errorDetails));
  }
  req.query = result.data;
  next();
};
