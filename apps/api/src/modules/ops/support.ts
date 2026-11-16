import { Controller, Delete, Get, HttpCode, Inject, Injectable, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, helpArticles, notifications, supportTicketMessages, supportTickets, users } from '@dentweb/database';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod.js';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { AuditService, MailService } from '../../infra/infra.module.js';

const TicketInput = z.object({
  subject: z.string().trim().min(4).max(255),
  body: z.string().trim().min(10).max(5000),
  /** Optional client diagnostics (app version, OS, last error). Never includes secrets. */
  diagnostics: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
});
const MessageInput = z.object({ body: z.string().trim().min(1).max(5000) });
const TicketStatus = z.object({ status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']) });
const ArticleInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,150}$/),
  kind: z.enum(['GUIDE', 'FAQ', 'TROUBLESHOOTING']),
  title: z.string().trim().min(3).max(255),
  body: z.string().trim().min(10).max(50_000),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
});
const ArticlePatch = ArticleInput.partial();
const ArticleQuery = z.object({ q: z.string().max(100).optional(), kind: z.enum(['GUIDE', 'FAQ', 'TROUBLESHOOTING']).optional() });

@Injectable()
export class SupportService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  // ---------------- tickets ----------------
  async create(userId: string, i: z.infer<typeof TicketInput>) {
    const t = await this.db.transaction(async (tx) => {
      const [t] = await tx.insert(supportTickets).values({ userId, subject: i.subject, status: 'OPEN', diagnostics: i.diagnostics ?? null }).returning();
      await tx.insert(supportTicketMessages).values({ ticketId: t!.id, authorId: userId, body: i.body });
      return t!;
    });
    await this.audit.log({ actorId: userId, action: 'support.ticket.create', targetType: 'support_ticket', targetId: t.id });
    return this.get(userId, t.id);
  }

  async list(userId: string | null, status?: string) {
    const conds = [];
    if (userId) conds.push(eq(supportTickets.userId, userId));
    if (status) conds.push(eq(supportTickets.status, status));
    return this.db
      .select({ t: supportTickets, email: users.email, displayName: users.displayName })
      .from(supportTickets)
      .innerJoin(users, eq(users.id, supportTickets.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(supportTickets.updatedAt))
      .limit(200)
      .then((rows) => rows.map((r) => ({ ...r.t, owner: { email: r.email, displayName: r.displayName } })));
  }

  async get(userId: string | null, id: string) {
    const [t] = await this.db.select().from(supportTickets).where(userId ? and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)) : eq(supportTickets.id, id));
    if (!t) throw Errors.notFound('Tiket');
    const messages = await this.db
      .select({ id: supportTicketMessages.id, body: supportTicketMessages.body, createdAt: supportTicketMessages.createdAt, authorId: supportTicketMessages.authorId, authorName: users.displayName, authorRole: users.role })
      .from(supportTicketMessages)
      .innerJoin(users, eq(users.id, supportTicketMessages.authorId))
      .where(eq(supportTicketMessages.ticketId, id))
      .orderBy(asc(supportTicketMessages.createdAt));
    return { ...t, messages };
  }

  async reply(author: SessionUser, id: string, body: string, asAdmin: boolean) {
    const t = await this.get(asAdmin ? null : author.id, id);
    if (t.status === 'CLOSED') throw Errors.conflict('TICKET_CLOSED', 'Tiket sudah ditutup. Buat tiket baru bila perlu.');
    await this.db.insert(supportTicketMessages).values({ ticketId: id, authorId: author.id, body });
    await this.db.update(supportTickets).set({ status: asAdmin ? 'PENDING' : 'OPEN' }).where(eq(supportTickets.id, id));
    if (asAdmin) {
      await this.db.insert(notifications).values({ userId: t.userId, type: 'support.reply', payload: { ticketId: id, subject: t.subject } });
      const [u] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, t.userId));
      if (u) await this.mail.send({ to: u.email, subject: `Balasan tiket: ${t.subject}`, text: `Tim DENTWEB membalas tiket Anda "${t.subject}". Buka Pusat Bantuan di aplikasi untuk membaca dan membalas.` }).catch(() => undefined);
    }
    return this.get(null, id);
  }

  async setStatus(actorId: string, id: string, status: string) {
    const [t] = await this.db.update(supportTickets).set({ status }).where(eq(supportTickets.id, id)).returning();
    if (!t) throw Errors.notFound('Tiket');
    await this.audit.log({ actorId, action: 'support.ticket.status', targetType: 'support_ticket', targetId: id, metadata: { status } });
    return t;
  }

  // ---------------- help articles ----------------
  async articles(publishedOnly: boolean, q: z.infer<typeof ArticleQuery>) {
    const conds = [];
    if (publishedOnly) conds.push(eq(helpArticles.status, 'PUBLISHED'));
    if (q.kind) conds.push(eq(helpArticles.kind, q.kind));
    if (q.q) conds.push(or(ilike(helpArticles.title, `%${q.q}%`), ilike(helpArticles.body, `%${q.q}%`))!);
    return this.db.select().from(helpArticles).where(conds.length ? and(...conds) : undefined).orderBy(asc(helpArticles.sortOrder), asc(helpArticles.title));
  }

  async article(idOrSlug: string, publishedOnly: boolean) {
    const isId = /^[0-9a-f-]{36}$/i.test(idOrSlug);
    const [a] = await this.db.select().from(helpArticles).where(isId ? eq(helpArticles.id, idOrSlug) : eq(helpArticles.slug, idOrSlug));
    if (!a || (publishedOnly && a.status !== 'PUBLISHED')) throw Errors.notFound('Artikel');
    return a;
  }

  async createArticle(actorId: string, i: z.infer<typeof ArticleInput>) {
    const [dup] = await this.db.select({ id: helpArticles.id }).from(helpArticles).where(eq(helpArticles.slug, i.slug));
    if (dup) throw Errors.conflict('SLUG_TAKEN', 'Slug sudah dipakai');
    const [a] = await this.db.insert(helpArticles).values(i).returning();
    await this.audit.log({ actorId, action: 'help.article.create', targetType: 'help_article', targetId: a!.id });
    return a;
  }

  async patchArticle(actorId: string, id: string, p: z.infer<typeof ArticlePatch>) {
    const [a] = await this.db.update(helpArticles).set(p).where(eq(helpArticles.id, id)).returning();
    if (!a) throw Errors.notFound('Artikel');
    await this.audit.log({ actorId, action: 'help.article.update', targetType: 'help_article', targetId: id });
    return a;
  }

  async deleteArticle(actorId: string, id: string) {
    const [a] = await this.db.delete(helpArticles).where(eq(helpArticles.id, id)).returning({ id: helpArticles.id });
    if (!a) throw Errors.notFound('Artikel');
    await this.audit.log({ actorId, action: 'help.article.delete', targetType: 'help_article', targetId: id });
    return { ok: true };
  }
}

@ApiTags('support')
@Controller()
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('help/articles')
  articles(@ZQuery(ArticleQuery) q: z.infer<typeof ArticleQuery>) {
    return this.svc.articles(true, q);
  }

  @Get('help/articles/:id')
  article(@Param('id') id: string) {
    return this.svc.article(id, true);
  }

  @Post('support/tickets')
  @ApiZodBody(TicketInput)
  create(@CurrentUser() me: SessionUser, @ZBody(TicketInput) b: z.infer<typeof TicketInput>) {
    return this.svc.create(me.id, b);
  }

  @Get('support/tickets')
  list(@CurrentUser() me: SessionUser) {
    return this.svc.list(me.id);
  }

  @Get('support/tickets/:id')
  get(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(me.id, id);
  }

  @Post('support/tickets/:id/messages')
  @ApiZodBody(MessageInput)
  reply(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(MessageInput) b: z.infer<typeof MessageInput>) {
    return this.svc.reply(me, id, b.body, false);
  }
}

@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminSupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('support/tickets')
  list(@ZQuery(z.object({ status: z.string().max(20).optional() })) q: { status?: string }) {
    return this.svc.list(null, q.status);
  }

  @Get('support/tickets/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(null, id);
  }

  @Post('support/tickets/:id/messages')
  @ApiZodBody(MessageInput)
  reply(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(MessageInput) b: z.infer<typeof MessageInput>) {
    return this.svc.reply(me, id, b.body, true);
  }

  @Patch('support/tickets/:id')
  @ApiZodBody(TicketStatus)
  status(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(TicketStatus) b: z.infer<typeof TicketStatus>) {
    return this.svc.setStatus(me.id, id, b.status);
  }

  @Get('help/articles')
  articles(@ZQuery(ArticleQuery) q: z.infer<typeof ArticleQuery>) {
    return this.svc.articles(false, q);
  }

  @Post('help/articles')
  @ApiZodBody(ArticleInput)
  createArticle(@CurrentUser() me: SessionUser, @ZBody(ArticleInput) b: z.infer<typeof ArticleInput>) {
    return this.svc.createArticle(me.id, b);
  }

  @Patch('help/articles/:id')
  @ApiZodBody(ArticlePatch)
  patchArticle(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ArticlePatch) b: z.infer<typeof ArticlePatch>) {
    return this.svc.patchArticle(me.id, id, b);
  }

  @Delete('help/articles/:id')
  @HttpCode(200)
  deleteArticle(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteArticle(me.id, id);
  }
}
