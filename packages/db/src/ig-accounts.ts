import { jstNow } from './utils.js';

// =============================================================================
// IG Accounts — Multi-Account Management
// =============================================================================

export interface IgAccount {
  id: string;
  ig_user_id: string;
  name: string;
  access_token: string;
  app_secret: string;
  is_active: number;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIgAccountInput {
  igUserId: string;
  name: string;
  accessToken: string;
  appSecret: string;
}

export async function createIgAccount(
  db: D1Database,
  input: CreateIgAccountInput,
): Promise<IgAccount> {
  const id = crypto.randomUUID();
  const now = jstNow();

  await db
    .prepare(
      `INSERT INTO ig_accounts (id, ig_user_id, name, access_token, app_secret, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(id, input.igUserId, input.name, input.accessToken, input.appSecret, now, now)
    .run();

  return (await getIgAccountById(db, id))!;
}

export async function getIgAccountById(
  db: D1Database,
  id: string,
): Promise<IgAccount | null> {
  return db
    .prepare(`SELECT * FROM ig_accounts WHERE id = ?`)
    .bind(id)
    .first<IgAccount>();
}

export async function getIgAccounts(db: D1Database): Promise<IgAccount[]> {
  const result = await db
    .prepare(`SELECT * FROM ig_accounts ORDER BY created_at DESC`)
    .all<IgAccount>();
  return result.results;
}

export async function getIgAccountByUserId(
  db: D1Database,
  igUserId: string,
): Promise<IgAccount | null> {
  return db
    .prepare(`SELECT * FROM ig_accounts WHERE ig_user_id = ?`)
    .bind(igUserId)
    .first<IgAccount>();
}

export type UpdateIgAccountInput = Partial<
  Pick<IgAccount, 'name' | 'access_token' | 'app_secret' | 'is_active' | 'token_expires_at'>
>;

export async function updateIgAccount(
  db: D1Database,
  id: string,
  updates: UpdateIgAccountInput,
): Promise<IgAccount | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.access_token !== undefined) {
    fields.push('access_token = ?');
    values.push(updates.access_token);
  }
  if (updates.app_secret !== undefined) {
    fields.push('app_secret = ?');
    values.push(updates.app_secret);
  }
  if (updates.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.is_active);
  }
  if (updates.token_expires_at !== undefined) {
    fields.push('token_expires_at = ?');
    values.push(updates.token_expires_at);
  }

  if (fields.length === 0) return getIgAccountById(db, id);

  fields.push('updated_at = ?');
  values.push(jstNow());
  values.push(id);

  await db
    .prepare(`UPDATE ig_accounts SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return getIgAccountById(db, id);
}

export async function deleteIgAccount(
  db: D1Database,
  id: string,
): Promise<void> {
  await db.prepare(`DELETE FROM ig_accounts WHERE id = ?`).bind(id).run();
}

// Backward compat aliases for code that still uses LINE naming
export {
  getIgAccounts as getLineAccounts,
  getIgAccountById as getLineAccountById,
  getIgAccountByUserId as getLineAccountByChannelId,
  createIgAccount as createLineAccount,
  updateIgAccount as updateLineAccount,
  deleteIgAccount as deleteLineAccount,
};
export type {
  IgAccount as LineAccount,
  CreateIgAccountInput as CreateLineAccountInput,
  UpdateIgAccountInput as UpdateLineAccountInput,
};
