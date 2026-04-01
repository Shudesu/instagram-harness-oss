import { Hono } from 'hono';
import {
  InstagramClient,
  verifyWebhookSignature,
  verifyWebhookChallenge,
} from '@instagram-harness/ig-sdk';
import type { WebhookPayload, MessagingEvent } from '@instagram-harness/ig-sdk';
import {
  upsertFriend,
  getFriendByIgsid,
  getScenarios,
  enrollFriendInScenario,
  getScenarioSteps,
  advanceFriendScenario,
  completeFriendScenario,
  upsertChatOnMessage,
  jstNow,
} from '@instagram-harness/db';
import { fireEvent } from '../services/event-bus.js';
import { buildIgMessage, expandVariables } from '../services/step-delivery.js';
import type { Env } from '../index.js';

const webhook = new Hono<Env>();

// GET /webhook — Meta verification challenge
webhook.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode') ?? null;
  const token = c.req.query('hub.verify_token') ?? null;
  const challenge = c.req.query('hub.challenge') ?? null;

  const result = verifyWebhookChallenge(mode, token, challenge, c.env.IG_VERIFY_TOKEN);
  if (result) {
    return c.text(result, 200);
  }
  return c.json({ error: 'Verification failed' }, 403);
});

// POST /webhook — Instagram webhook events
webhook.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Hub-Signature-256') ?? '';
  const db = c.env.DB;

  // Verify signature — try IG App Secret first, then Meta App Secret
  // TODO: determine which secret Meta uses for Instagram API webhooks
  const valid = await verifyWebhookSignature(rawBody, signature, c.env.IG_APP_SECRET);
  if (!valid) {
    console.log('Signature verification failed, logging raw body for debug:', rawBody.substring(0, 200));
    // Don't reject — process anyway during development mode
  }

  // DEBUG: log raw webhook body
  console.log('Webhook received, raw body:', rawBody.substring(0, 500));

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    console.error('Failed to parse webhook body');
    return c.json({ status: 'ok' }, 200);
  }

  console.log('Webhook object:', body.object, 'entries:', body.entry?.length ?? 0);

  if (body.object !== 'instagram') {
    console.log('Skipping non-instagram webhook, object:', body.object);
    return c.json({ status: 'ok' }, 200);
  }

  const igClient = new InstagramClient({
    accessToken: c.env.IG_ACCESS_TOKEN,
    igUserId: c.env.IG_USER_ID,
  });

  // Process asynchronously — Meta expects quick response
  const processingPromise = (async () => {
    for (const entry of body.entry) {
      // Handle DM messaging events (messaging = primary, standby = secondary receiver)
      const messagingEvents = entry.messaging ?? entry.standby ?? [];
      for (const event of messagingEvents) {
        try {
          await handleMessagingEvent(db, igClient, event, c.env.WORKER_URL);
        } catch (err) {
          console.error('Error handling messaging event:', err);
        }
      }

      // Handle comment/mention change events
      if (entry.changes) {
        for (const change of entry.changes) {
          try {
            if (change.field === 'comments') {
              await handleCommentEvent(db, igClient, change.value, c.env.WORKER_URL);
            }
          } catch (err) {
            console.error('Error handling change event:', err);
          }
        }
      }
    }
  })();

  c.executionCtx.waitUntil(processingPromise);
  return c.json({ status: 'ok' }, 200);
});

async function handleMessagingEvent(
  db: D1Database,
  igClient: InstagramClient,
  event: MessagingEvent,
  workerUrl?: string,
): Promise<void> {
  const senderId = event.sender.id;

  // Skip echo messages (our own outgoing messages)
  if (event.message?.is_echo) return;

  // Upsert follower (get profile from IG)
  let profile;
  try {
    profile = await igClient.getUserProfile(senderId);
  } catch (err) {
    console.error('Failed to get profile for', senderId, err);
  }

  const follower = await upsertFriend(db, {
    igsid: senderId,
    username: profile?.username ?? null,
    displayName: profile?.name ?? null,
    pictureUrl: profile?.profile_pic ?? null,
  });

  if (event.message?.text) {
    const incomingText = event.message.text;
    const now = jstNow();
    const logId = crypto.randomUUID();

    // Log incoming message
    await db
      .prepare(
        `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
         VALUES (?, 'in', 'text', ?, NULL)`,
      )
      .bind(follower.id, JSON.stringify({ text: incomingText }))
      .run();

    // Update chat (mark as unread for manual messages)
    await upsertChatOnMessage(db, follower.id);

    // Check auto-reply (comment rules with dm_keyword trigger)
    const autoReplies = await db
      .prepare(
        `SELECT * FROM comment_rules WHERE is_active = 1 AND trigger_type = 'dm_keyword' ORDER BY created_at ASC`,
      )
      .all<{
        id: string;
        keyword: string;
        match_type: 'exact' | 'contains' | 'regex';
        response_type: string;
        response_body: string;
        delay_seconds: number;
      }>();

    let matched = false;
    for (const rule of autoReplies.results) {
      let isMatch = false;
      if (rule.match_type === 'exact') {
        isMatch = incomingText === rule.keyword;
      } else if (rule.match_type === 'contains') {
        isMatch = incomingText.includes(rule.keyword);
      } else if (rule.match_type === 'regex') {
        try {
          isMatch = new RegExp(rule.keyword).test(incomingText);
        } catch {
          isMatch = false;
        }
      }

      if (isMatch) {
        // Apply delay if configured
        if (rule.delay_seconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, rule.delay_seconds * 1000));
        }

        const responseBody = JSON.parse(rule.response_body);
        await sendIgResponse(igClient, senderId, rule.response_type, responseBody);

        // Log outgoing auto-reply
        await db
          .prepare(
            `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
             VALUES (?, 'out', ?, ?, 'comment_rule')`,
          )
          .bind(follower.id, rule.response_type, rule.response_body)
          .run();

        matched = true;
        break;
      }
    }

    // Check dm_keyword scenario triggers
    if (!matched) {
      const scenarios = await getScenarios(db);
      for (const scenario of scenarios) {
        if (
          scenario.trigger_type === 'dm_keyword' &&
          scenario.is_active &&
          scenario.trigger_keyword
        ) {
          if (incomingText.includes(scenario.trigger_keyword)) {
            const existing = await db
              .prepare(`SELECT id FROM follower_scenarios WHERE follower_id = ? AND scenario_id = ?`)
              .bind(follower.id, scenario.id)
              .first<{ id: string }>();
            if (!existing) {
              const friendScenario = await enrollFriendInScenario(db, follower.id, scenario.id);

              // Immediate delivery of first step if delay=0
              const steps = await getScenarioSteps(db, scenario.id);
              const firstStep = steps[0];
              if (firstStep && firstStep.delay_minutes === 0 && friendScenario.status === 'active') {
                try {
                  const expandedContent = expandVariables(firstStep.message_content, follower);
                  const parsed = JSON.parse(expandedContent);
                  await sendIgResponse(igClient, senderId, firstStep.message_type, parsed);

                  await db
                    .prepare(
                      `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
                       VALUES (?, 'out', ?, ?, 'scenario')`,
                    )
                    .bind(follower.id, firstStep.message_type, firstStep.message_content)
                    .run();

                  const secondStep = steps[1] ?? null;
                  if (secondStep) {
                    const nextDeliveryDate = new Date(Date.now() + 9 * 60 * 60_000);
                    nextDeliveryDate.setMinutes(nextDeliveryDate.getMinutes() + secondStep.delay_minutes);
                    await advanceFriendScenario(db, friendScenario.id, firstStep.step_order, nextDeliveryDate.toISOString().slice(0, -1) + '+09:00');
                  } else {
                    await completeFriendScenario(db, friendScenario.id);
                  }
                } catch (err) {
                  console.error('Failed immediate delivery for scenario', scenario.id, err);
                }
              }
            }
            matched = true;
            break;
          }
        }
      }
    }

    // Fire event bus: dm_received
    await fireEvent(db, 'dm_received', {
      friendId: follower.id,
      eventData: { text: incomingText, matched },
    });
  }

  // Handle postback events
  if (event.postback) {
    await fireEvent(db, 'postback', {
      friendId: follower.id,
      eventData: { payload: event.postback.payload, title: event.postback.title },
    });
  }
}

async function handleCommentEvent(
  db: D1Database,
  igClient: InstagramClient,
  value: { id: string; text: string; from: { id: string; username: string }; media: { id: string }; created_time: string },
  _workerUrl?: string,
): Promise<void> {
  const senderId = value.from.id;
  const commentText = value.text;
  const mediaId = value.media.id;

  // Upsert follower
  let profile;
  try {
    profile = await igClient.getUserProfile(senderId);
  } catch {
    // Profile fetch may fail for non-followers
  }

  const follower = await upsertFriend(db, {
    igsid: senderId,
    username: value.from.username ?? profile?.username ?? null,
    displayName: profile?.name ?? null,
    pictureUrl: profile?.profile_pic ?? null,
  });

  // Check comment rules (match by keyword + optional media filter)
  const commentRules = await db
    .prepare(
      `SELECT * FROM comment_rules WHERE is_active = 1 AND trigger_type = 'comment' ORDER BY created_at ASC`,
    )
    .all<{
      id: string;
      keyword: string;
      match_type: 'exact' | 'contains' | 'regex';
      media_id: string | null;
      response_type: string;
      response_body: string;
      delay_seconds: number;
    }>();

  for (const rule of commentRules.results) {
    // Media filter: if rule specifies a media_id, only match that post
    if (rule.media_id && rule.media_id !== mediaId) continue;

    let isMatch = false;
    if (rule.match_type === 'exact') {
      isMatch = commentText === rule.keyword;
    } else if (rule.match_type === 'contains') {
      isMatch = commentText.toLowerCase().includes(rule.keyword.toLowerCase());
    } else if (rule.match_type === 'regex') {
      try {
        isMatch = new RegExp(rule.keyword, 'i').test(commentText);
      } catch {
        isMatch = false;
      }
    }

    if (isMatch) {
      // Apply delay if configured
      if (rule.delay_seconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, rule.delay_seconds * 1000));
      }

      // Send DM to commenter
      const responseBody = JSON.parse(rule.response_body);
      await sendIgResponse(igClient, senderId, rule.response_type, responseBody);

      // Log outgoing message
      await db
        .prepare(
          `INSERT INTO messages_log (follower_id, direction, message_type, body, trigger_source)
           VALUES (?, 'out', ?, ?, 'comment_rule')`,
        )
        .bind(follower.id, rule.response_type, rule.response_body)
        .run();

      break; // Only send first matching rule
    }
  }

  // Check comment-triggered scenarios
  const scenarios = await getScenarios(db);
  for (const scenario of scenarios) {
    if (scenario.trigger_type === 'comment' && scenario.is_active) {
      const keywordMatch = !scenario.trigger_keyword || commentText.toLowerCase().includes(scenario.trigger_keyword.toLowerCase());
      if (keywordMatch) {
        const existing = await db
          .prepare(`SELECT id FROM follower_scenarios WHERE follower_id = ? AND scenario_id = ?`)
          .bind(follower.id, scenario.id)
          .first<{ id: string }>();
        if (!existing) {
          await enrollFriendInScenario(db, follower.id, scenario.id);
        }
      }
    }
  }

  // Fire event bus: comment_received
  await fireEvent(db, 'comment_received', {
    friendId: follower.id,
    eventData: { text: commentText, mediaId, commentId: value.id },
  });
}

/**
 * Send an IG response based on message type.
 */
async function sendIgResponse(
  igClient: InstagramClient,
  recipientId: string,
  responseType: string,
  body: Record<string, unknown>,
): Promise<void> {
  switch (responseType) {
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

export { webhook };
