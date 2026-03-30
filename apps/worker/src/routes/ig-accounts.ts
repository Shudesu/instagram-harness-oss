import { Hono } from 'hono';
import {
  getIgAccounts,
  getIgAccountById,
  createIgAccount,
  updateIgAccount,
  deleteIgAccount,
} from '@instagram-harness/db';
import type { IgAccount } from '@instagram-harness/db';
import { requireRole } from '../middleware/role-guard.js';
import type { Env } from '../index.js';

const igAccounts = new Hono<Env>();

function serializeIgAccount(row: IgAccount) {
  return {
    id: row.id,
    igUserId: row.ig_user_id,
    name: row.name,
    isActive: Boolean(row.is_active),
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Intentionally omit accessToken and appSecret from list responses
  };
}

function serializeIgAccountFull(row: IgAccount) {
  return {
    ...serializeIgAccount(row),
    accessToken: row.access_token,
    appSecret: row.app_secret,
  };
}

// GET /api/ig-accounts - list all
igAccounts.get('/api/ig-accounts', async (c) => {
  try {
    const items = await getIgAccounts(c.env.DB);
    const results = items.map(serializeIgAccount);
    return c.json({ success: true, data: results });
  } catch (err) {
    console.error('GET /api/ig-accounts error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ig-accounts/:id - get single (secrets only for owner/admin)
igAccounts.get('/api/ig-accounts/:id', async (c) => {
  try {
    const account = await getIgAccountById(c.env.DB, c.req.param('id'));
    if (!account) {
      return c.json({ success: false, error: 'IG account not found' }, 404);
    }
    const staffMember = c.get('staff');
    const data = staffMember?.role === 'staff'
      ? serializeIgAccount(account)
      : serializeIgAccountFull(account);
    return c.json({ success: true, data });
  } catch (err) {
    console.error('GET /api/ig-accounts/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/ig-accounts - create
igAccounts.post('/api/ig-accounts', requireRole('owner'), async (c) => {
  try {
    const body = await c.req.json<{
      igUserId: string;
      name: string;
      accessToken: string;
      appSecret: string;
    }>();

    if (!body.igUserId || !body.name || !body.accessToken || !body.appSecret) {
      return c.json(
        { success: false, error: 'igUserId, name, accessToken, and appSecret are required' },
        400,
      );
    }

    const account = await createIgAccount(c.env.DB, body);
    return c.json({ success: true, data: serializeIgAccountFull(account) }, 201);
  } catch (err) {
    console.error('POST /api/ig-accounts error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/ig-accounts/:id - update
igAccounts.put('/api/ig-accounts/:id', requireRole('owner'), async (c) => {
  try {
    const id = c.req.param('id')!;
    const body = await c.req.json<{
      name?: string;
      accessToken?: string;
      appSecret?: string;
      isActive?: boolean;
    }>();

    const updated = await updateIgAccount(c.env.DB, id, {
      name: body.name,
      access_token: body.accessToken,
      app_secret: body.appSecret,
      is_active: body.isActive !== undefined ? (body.isActive ? 1 : 0) : undefined,
    });

    if (!updated) {
      return c.json({ success: false, error: 'IG account not found' }, 404);
    }
    return c.json({ success: true, data: serializeIgAccountFull(updated) });
  } catch (err) {
    console.error('PUT /api/ig-accounts/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/ig-accounts/:id - delete
igAccounts.delete('/api/ig-accounts/:id', requireRole('owner'), async (c) => {
  try {
    await deleteIgAccount(c.env.DB, c.req.param('id')!);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/ig-accounts/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { igAccounts };
