import {
  getBroadcastById,
  getBroadcasts,
  updateBroadcastStatus,
  getFriendsByTag,
  jstNow,
  createBroadcastInsight,
} from '@instagram-harness/db';
import type { Broadcast } from '@instagram-harness/db';
import type { InstagramClient } from '@instagram-harness/ig-sdk';
import { calculateStaggerDelay, sleep } from './stealth.js';

const BATCH_SIZE = 50; // IG API is more conservative than LINE

export async function processBroadcastSend(
  db: D1Database,
  igClient: InstagramClient,
  broadcastId: string,
  _workerUrl?: string,
): Promise<Broadcast> {
  await updateBroadcastStatus(db, broadcastId, 'sending');

  const broadcast = await getBroadcastById(db, broadcastId);
  if (!broadcast) {
    throw new Error(`Broadcast ${broadcastId} not found`);
  }

  const messageBody = JSON.parse(broadcast.message_content) as Record<string, unknown>;
  let totalCount = 0;
  let successCount = 0;

  try {
    if (broadcast.target_type === 'all') {
      // IG doesn't have a "broadcast to all" API — must send individually
      // Get all followers from DB
      const followers = await db
        .prepare(`SELECT id, igsid FROM followers`)
        .all<{ id: number; igsid: string }>();
      totalCount = followers.results.length;

      const now = jstNow();
      for (let i = 0; i < followers.results.length; i += BATCH_SIZE) {
        const batch = followers.results.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);

        // Stagger delays between batches
        if (batchIndex > 0) {
          const delay = calculateStaggerDelay(followers.results.length, batchIndex);
          await sleep(delay);
        }

        for (const follower of batch) {
          try {
            await sendIgMessage(igClient, follower.igsid, broadcast.message_type, messageBody);
            successCount++;

            // Log outgoing message
            await db
              .prepare(
                `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
                 VALUES (?, 'out', ?, ?, 'broadcast')`,
              )
              .bind(follower.id, broadcast.message_type, broadcast.message_content)
              .run();
          } catch (err) {
            console.error(`Broadcast send failed for follower ${follower.id}:`, err);
          }
        }
      }
    } else if (broadcast.target_type === 'tag') {
      if (!broadcast.target_tag_id) {
        throw new Error('target_tag_id is required for tag-targeted broadcasts');
      }

      const friends = await getFriendsByTag(db, broadcast.target_tag_id);
      totalCount = friends.length;

      const now = jstNow();
      for (let i = 0; i < friends.length; i += BATCH_SIZE) {
        const batch = friends.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE);

        if (batchIndex > 0) {
          const delay = calculateStaggerDelay(friends.length, batchIndex);
          await sleep(delay);
        }

        for (const friend of batch) {
          try {
            const igsid = friend.igsid;
            await sendIgMessage(igClient, igsid, broadcast.message_type, messageBody);
            successCount++;

            await db
              .prepare(
                `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
                 VALUES (?, 'out', ?, ?, 'broadcast')`,
              )
              .bind(friend.id, broadcast.message_type, broadcast.message_content)
              .run();
          } catch (err) {
            console.error(`Broadcast send failed for friend ${friend.id}:`, err);
          }
        }
      }
    }

    await createBroadcastInsight(db, broadcast.id);
    await updateBroadcastStatus(db, broadcastId, 'sent', { totalCount, successCount });
  } catch (err) {
    await updateBroadcastStatus(db, broadcastId, 'draft');
    throw err;
  }

  return (await getBroadcastById(db, broadcastId))!;
}

export async function processScheduledBroadcasts(
  db: D1Database,
  igClient: InstagramClient,
  workerUrl?: string,
): Promise<void> {
  const allBroadcasts = await getBroadcasts(db);
  const nowMs = Date.now();

  const scheduled = allBroadcasts.filter(
    (b) =>
      b.status === 'scheduled' &&
      b.scheduled_at !== null &&
      new Date(b.scheduled_at).getTime() <= nowMs,
  );

  for (const broadcast of scheduled) {
    try {
      await processBroadcastSend(db, igClient, broadcast.id, workerUrl);
    } catch (err) {
      console.error(`Failed to send scheduled broadcast ${broadcast.id}:`, err);
    }
  }
}

async function sendIgMessage(
  igClient: InstagramClient,
  recipientId: string,
  messageType: string,
  body: Record<string, unknown>,
): Promise<void> {
  switch (messageType) {
    case 'text':
      await igClient.sendText(recipientId, body.text as string);
      break;
    case 'image':
      await igClient.sendImage(recipientId, body.url as string);
      break;
    case 'template':
      await igClient.sendGenericTemplate(recipientId, body.elements as never[]);
      break;
    case 'quick_reply':
      await igClient.sendQuickReply(
        recipientId,
        body.text as string,
        body.quick_replies as never[],
      );
      break;
    default:
      if (typeof body.text === 'string') {
        await igClient.sendText(recipientId, body.text);
      }
  }
}
