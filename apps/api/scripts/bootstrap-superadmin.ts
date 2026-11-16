/**
 * Creates (or promotes) the first SUPERADMIN from env. Idempotent.
 * Usage: SUPERADMIN_EMAIL=.. SUPERADMIN_PASSWORD=.. SUPERADMIN_NAME=.. pnpm bootstrap:superadmin
 */
import { hash } from '@node-rs/argon2';
import { and, eq } from 'drizzle-orm';
import { authIdentities, createDatabase, licenses, users } from '@dentweb/database';
import { RegisterInput } from '@dentweb/shared-types';

const input = RegisterInput.parse({
  email: process.env.SUPERADMIN_EMAIL,
  password: process.env.SUPERADMIN_PASSWORD,
  displayName: process.env.SUPERADMIN_NAME ?? 'Superadmin',
});
const db = createDatabase(undefined, 1);
try {
  const secretHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 });
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, input.email));
    const u = existing
      ? (await tx.update(users).set({ role: 'SUPERADMIN', status: 'ACTIVE' }).where(eq(users.id, existing.id)).returning())[0]!
      : (await tx.insert(users).values({ email: input.email, displayName: input.displayName, role: 'SUPERADMIN', status: 'ACTIVE' }).returning())[0]!;
    const [ident] = await tx.select().from(authIdentities).where(and(eq(authIdentities.userId, u.id), eq(authIdentities.provider, 'password')));
    if (ident) await tx.update(authIdentities).set({ secretHash, verifiedAt: new Date() }).where(eq(authIdentities.id, ident.id));
    else await tx.insert(authIdentities).values({ userId: u.id, provider: 'password', providerSubject: input.email, secretHash, verifiedAt: new Date() });

    // Ensure Superadmin has an active license with full entitlements
    const [existingLic] = await tx.select().from(licenses).where(and(eq(licenses.userId, u.id), eq(licenses.status, 'ACTIVE')));
    if (!existingLic) {
      await tx.insert(licenses).values({
        userId: u.id,
        status: 'ACTIVE',
        maxDevices: 10,
        entitlements: {
          maxWorkers: 4,
          maxVideosPerDay: 100,
          cloudRender: true,
          cloudRenderMinutesPerMonth: 1000,
        },
      });
    }
    console.log(`[bootstrap] SUPERADMIN siap dengan Lisensi Aktif: ${u.email}`);
  });
} finally {
  await db.$client.end();
}
