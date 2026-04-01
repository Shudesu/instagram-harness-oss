import {
  getBroadcastById,
  updateBroadcastStatus,
  jstNow,
  createBroadcastInsight,
} from '@instagram-harness/db';
import type { Broadcast } from '@instagram-harness/db';
import type { InstagramClient } from '@instagram-harness/ig-sdk';
import { calculateStaggerDelay, sleep } from './stealth.js';
import { buildSegmentQuery } from './segment-query.js';
import type { SegmentCondition } from './segment-query.js';

const BATCH_SIZE = 50;

interface FriendRow {
  id: string;
  igsid: string;
}

export async function processSegmentSend(
  db: D1Database,
  igClient: InstagramClient,
  broadcastId: string,
  condition: SegmentCondition,
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
    const { sql, bindings } = buildSegmentQuery(condition);
    const queryResult = await db
      .prepare(sql)
      .bind(...bindings)
      .all<FriendRow>();

    const friends = queryResult.results ?? [];
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
          await sendIgMessage(igClient, friend.igsid, broadcast.message_type, messageBody);
          successCount++;

          await db
            .prepare(
              `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
               VALUES (?, 'out', ?, ?, 'broadcast')`,
            )
            .bind(friend.id, broadcast.message_type, broadcast.message_content)
            .run();
        } catch (err) {
          console.error(`Segment send failed for friend ${friend.id}:`, err);
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
