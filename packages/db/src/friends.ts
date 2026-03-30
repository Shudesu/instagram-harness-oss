import { jstNow } from './utils.js';

export interface Friend {
  id: string;
  igsid: string;
  // Backward compat aliases for code that still references line_user_id
  line_user_id: string;
  username: string | null;
  display_name: string | null;
  picture_url: string | null;
  status_message: string | null;
  is_following: number;
  user_id: string | null;
  score: number;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface GetFriendsOptions {
  limit?: number;
  offset?: number;
  tagId?: string;
}

export async function getFriends(
  db: D1Database,
  opts: GetFriendsOptions = {},
): Promise<Friend[]> {
  const { limit = 50, offset = 0, tagId } = opts;

  if (tagId) {
    const result = await db
      .prepare(
        `SELECT f.*
         FROM friends f
         INNER JOIN friend_tags ft ON ft.friend_id = f.id
         WHERE ft.tag_id = ?
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(tagId, limit, offset)
      .all<Friend>();
    return result.results;
  }

  const result = await db
    .prepare(
      `SELECT * FROM friends
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all<Friend>();
  return result.results;
}

export async function getFriendByIgsid(
  db: D1Database,
  igsid: string,
): Promise<Friend | null> {
  return db
    .prepare(`SELECT * FROM friends WHERE igsid = ?`)
    .bind(igsid)
    .first<Friend>();
}

/** Backward compat alias */
export async function getFriendByLineUserId(
  db: D1Database,
  igsid: string,
): Promise<Friend | null> {
  return getFriendByIgsid(db, igsid);
}

export async function getFriendById(
  db: D1Database,
  id: string,
): Promise<Friend | null> {
  return db
    .prepare(`SELECT * FROM friends WHERE id = ?`)
    .bind(id)
    .first<Friend>();
}

export interface UpsertFriendInput {
  igsid: string;
  username?: string | null;
  displayName?: string | null;
  pictureUrl?: string | null;
  // Legacy alias
  lineUserId?: string;
  statusMessage?: string | null;
}

export async function upsertFriend(
  db: D1Database,
  input: UpsertFriendInput,
): Promise<Friend> {
  const now = jstNow();
  const igsid = input.igsid || input.lineUserId!;
  const existing = await getFriendByIgsid(db, igsid);

  if (existing) {
    await db
      .prepare(
        `UPDATE friends
         SET username = ?,
             display_name = ?,
             picture_url = ?,
             is_following = 1,
             updated_at = ?
         WHERE igsid = ?`,
      )
      .bind(
        input.username ?? existing.username,
        input.displayName ?? existing.display_name,
        input.pictureUrl ?? existing.picture_url,
        now,
        igsid,
      )
      .run();

    return (await getFriendByIgsid(db, igsid))!;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO friends (id, igsid, username, display_name, picture_url, is_following, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      id,
      igsid,
      input.username ?? null,
      input.displayName ?? null,
      input.pictureUrl ?? null,
      now,
      now,
    )
    .run();

  return (await getFriendById(db, id))!;
}

export async function updateFriendFollowStatus(
  db: D1Database,
  igsid: string,
  isFollowing: boolean,
): Promise<void> {
  await db
    .prepare(
      `UPDATE friends
       SET is_following = ?, updated_at = ?
       WHERE igsid = ?`,
    )
    .bind(isFollowing ? 1 : 0, jstNow(), igsid)
    .run();
}

export async function getFriendCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as count FROM friends`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
