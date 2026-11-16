import { customType, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

export const id = () => uuid().primaryKey().defaultRandom();
export const tz = () => timestamp({ withTimezone: true, mode: 'date' });
export const createdAt = () => tz().notNull().defaultNow();
export const updatedAt = () =>
  tz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const status = (len = 24) => varchar({ length: len }).notNull();

/** Builds a CHECK expression `col IN ('A','B')` for status/role columns. */
export const inList = (column: string, values: readonly string[]) =>
  sql.raw(`"${column}" IN (${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`);
