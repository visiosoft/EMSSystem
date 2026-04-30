import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Returns structured JSON for every uncaught error. In non-production (or when
 * API_EXPOSE_ERROR_DETAILS=true), includes `detail` and `stack` so DevTools → Network
 * shows the real failure reason without digging into server logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    const detailParts: string[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        const m = b.message;
        if (typeof m === 'string') {
          message = m;
        } else if (Array.isArray(m)) {
          message = m.map(String).join('; ');
        } else if (typeof b.error === 'string') {
          message = b.error;
        }
        if (typeof b.detail === 'string' && b.detail.trim()) {
          detailParts.push(b.detail.trim());
        }
      }
    } else if (exception instanceof QueryFailedError) {
      message = 'Database query failed';
      detailParts.push(exception.message);
      const de = exception.driverError as { message?: string } | undefined;
      if (de?.message && de.message !== exception.message) {
        detailParts.push(`driver: ${de.message}`);
      }
    } else if (exception instanceof Error) {
      detailParts.push(exception.message);
    } else {
      detailParts.push(String(exception));
    }

    const isProd = process.env.NODE_ENV === 'production';
    const forceExpose = process.env.API_EXPOSE_ERROR_DETAILS === 'true';
    const expose = !isProd || forceExpose;

    if (!(exception instanceof HttpException)) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(err.message, err.stack);
    }

    const payload: Record<string, unknown> = {
      statusCode: status,
      message,
      path: req?.url ?? '',
      timestamp: new Date().toISOString(),
    };

    if (expose) {
      if (detailParts.length > 0) {
        payload.detail = detailParts.join(' | ');
      }
      if (exception instanceof Error && exception.stack) {
        payload.stack = exception.stack;
      }
      if (exception instanceof Object && exception.constructor?.name) {
        payload.errorType = exception.constructor.name;
      }
    }

    res.status(status).json(payload);
  }
}
