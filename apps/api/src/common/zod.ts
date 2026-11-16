import { applyDecorators, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';
import { Errors } from '../infra/errors.js';

export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw Errors.invalid(
        'VALIDATION_FAILED',
        'Input tidak valid',
        r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return r.data;
  }
}

const toSchema = (s: ZodType) => {
  try {
    return z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
};

/** Validated + documented request body. */
export const ZBody = (schema: ZodType) => Body(new ZodPipe(schema));
export const ZQuery = (schema: ZodType) => Query(new ZodPipe(schema));
export const ApiZodBody = (schema: ZodType) => applyDecorators(ApiBody({ schema: toSchema(schema) as never }));
