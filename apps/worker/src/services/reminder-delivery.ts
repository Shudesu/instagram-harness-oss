/**
 * Reminder delivery — runs on cron trigger
 *
 * Delivers reminder steps when target_date + offset_minutes has passed
 * and the step has not yet been delivered.
 */

import {
  getDueReminderDeliveries,
  markReminderStepDelivered,
  completeReminderIfDone,
  getFriendById,
  jstNow,
} from '@instagram-harness/db';
import type { InstagramClient } from '@instagram-harness/ig-sdk';
import { addJitter, sleep } from './stealth.js';

export async function processReminderDeliveries(
  db: D1Database,
  igClient: InstagramClient,
): Promise<void> {
  const now = jstNow();
  const dueReminders = await getDueReminderDeliveries(db, now);

  for (let i = 0; i < dueReminders.length; i++) {
    const fr = dueReminders[i];
    try {
      // Add random delay to avoid burst patterns
      if (i > 0) {
        await sleep(addJitter(50, 200));
      }

      const friend = await getFriendById(db, fr.friend_id);
      if (!friend || !friend.is_following) {
        continue;
      }

      const igsid = (friend as unknown as Record<string, unknown>).igsid as string
        || (friend as unknown as Record<string, unknown>).line_user_id as string;

      for (const step of fr.steps) {
        const body = JSON.parse(step.message_content) as Record<string, unknown>;
        await sendIgMessage(igClient, igsid, step.message_type, body);

        // Log message
        const logId = crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO messages_log (id, friend_id, direction, message_type, content, created_at)
             VALUES (?, ?, 'outgoing', ?, ?, ?)`,
          )
          .bind(logId, friend.id, step.message_type, step.message_content, jstNow())
          .run();

        await markReminderStepDelivered(db, fr.id, step.id);
      }

      await completeReminderIfDone(db, fr.id, fr.reminder_id);
    } catch (err) {
      console.error(`Reminder delivery error (friend_reminder ${fr.id}):`, err);
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
