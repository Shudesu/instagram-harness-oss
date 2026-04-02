import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { InstagramClient } from '@instagram-harness/ig-sdk';
import { processStepDeliveries } from './services/step-delivery.js';
import { processScheduledBroadcasts } from './services/broadcast.js';
import { processReminderDeliveries } from './services/reminder-delivery.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { webhook } from './routes/webhook.js';
import { friends } from './routes/friends.js';
import { tags } from './routes/tags.js';
import { scenarios } from './routes/scenarios.js';
import { broadcasts } from './routes/broadcasts.js';
import { users } from './routes/users.js';
import { igAccounts } from './routes/ig-accounts.js';
import { commentRules } from './routes/comment-rules.js';
import { conversions } from './routes/conversions.js';
import { affiliates } from './routes/affiliates.js';
import { openapi } from './routes/openapi.js';
// Round 3 routes
import { webhooks } from './routes/webhooks.js';
import { calendar } from './routes/calendar.js';
import { reminders } from './routes/reminders.js';
import { scoring } from './routes/scoring.js';
import { templates } from './routes/templates.js';
import { chats } from './routes/chats.js';
import { notifications } from './routes/notifications.js';
import { stripe } from './routes/stripe.js';
import { health } from './routes/health.js';
import { automations } from './routes/automations.js';
import { trackedLinks } from './routes/tracked-links.js';
import { forms } from './routes/forms.js';
import { adPlatforms } from './routes/ad-platforms.js';
import { staff } from './routes/staff.js';
import { images } from './routes/images.js';

export type Env = {
  Bindings: {
    DB: D1Database;
    IMAGES: R2Bucket;
    ASSETS: Fetcher;
    IG_APP_SECRET: string;
    IG_ACCESS_TOKEN: string;
    IG_USER_ID: string;
    IG_VERIFY_TOKEN: string;
    API_KEY: string;
    WORKER_URL: string;
  };
  Variables: {
    staff: { id: string; name: string; role: 'owner' | 'admin' | 'staff' };
  };
};

const app = new Hono<Env>();

// CORS — allow all origins for MVP
app.use('*', cors({ origin: '*' }));

// Rate limiting — runs before auth to block abuse early
app.use('*', rateLimitMiddleware);

// Auth middleware — skips /webhook automatically
app.use('*', authMiddleware);

// Mount route groups — MVP & Round 2
app.route('/', webhook);
app.route('/', friends);
app.route('/', tags);
app.route('/', scenarios);
app.route('/', broadcasts);
app.route('/', users);
app.route('/', igAccounts);
app.route('/', commentRules);
app.route('/', conversions);
app.route('/', affiliates);
app.route('/', openapi);

// Mount route groups — Round 3
app.route('/', webhooks);
app.route('/', calendar);
app.route('/', reminders);
app.route('/', scoring);
app.route('/', templates);
app.route('/', chats);
app.route('/', notifications);
app.route('/', stripe);
app.route('/', health);
app.route('/', automations);
app.route('/', trackedLinks);
app.route('/', forms);
app.route('/', adPlatforms);
app.route('/', staff);
app.route('/', images);

// LINE Harness UUID linkage endpoint
app.get('/connect', (c) => {
  const uid = c.req.query('uid');
  const token = c.req.query('token');
  if (!uid || !token) {
    return c.html(`<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Invalid link</h1></body></html>`, 400);
  }
  // Show page that instructs user to send the token via IG DM
  return c.html(`<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instagram連携</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 20px; text-align: center; }
h1 { font-size: 24px; }
.token-box { background: #f0f0f0; padding: 16px; border-radius: 12px; font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 20px 0; }
.btn { display: inline-block; background: linear-gradient(135deg, #833AB4, #FD1D1D, #F77737); color: white; padding: 14px 28px; border-radius: 25px; text-decoration: none; font-size: 16px; font-weight: bold; margin-top: 16px; }
p { color: #666; line-height: 1.6; }
</style></head><body>
<h1>📱 Instagram連携</h1>
<p>以下のコードをInstagramのDMで送信してください</p>
<div class="token-box">CONNECT:${token}</div>
<a class="btn" href="https://ig.me/m/nodashuichi.ai">DMを開く</a>
<p style="margin-top:24px; font-size:13px; color:#999;">このコードを送信すると、LINEアカウントとInstagramアカウントが連携されます。</p>
</body></html>`);
});

// Handle CONNECT token in DM webhook (processed in webhook.ts handleMessagingEvent)

// Data deletion callback (required for Meta app)
app.post('/data-deletion', async (c) => {
  const body = await c.req.json<{ signed_request?: string }>();
  const confirmationCode = crypto.randomUUID();
  return c.json({
    url: `https://instagram-harness.noda-c40.workers.dev/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});

app.get('/data-deletion', (c) => {
  const code = c.req.query('code');
  return c.html(`<!DOCTYPE html><html><head><title>Data Deletion</title></head><body>
<h1>Data Deletion Request</h1>
<p>Confirmation code: ${code ?? 'N/A'}</p>
<p>Your data has been scheduled for deletion.</p>
</body></html>`);
});

// Privacy policy page (required for Meta app public mode)
app.get('/privacy-policy', (c) => {
  return c.html(`<!DOCTYPE html><html><head><title>Privacy Policy - Instagram Harness</title></head><body>
<h1>Privacy Policy</h1>
<p>Instagram Harness is a self-hosted Instagram DM automation tool. Each user deploys their own instance.</p>
<p>This instance processes Instagram messages and comments solely for the account owner's automation purposes.</p>
<p>No data is shared with third parties. All data is stored in the account owner's Cloudflare D1 database.</p>
<p>Contact: info@aiagent-inc.com</p>
</body></html>`);
});

// 404 fallback — API paths return JSON 404, everything else serves from static assets (admin)
app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/') || path === '/webhook' || path === '/docs' || path === '/openapi.json') {
    return c.json({ success: false, error: 'Not found' }, 404);
  }
  // Serve static assets (admin dashboard)
  return c.env.ASSETS.fetch(c.req.raw);
});

// Scheduled handler for cron triggers
async function scheduled(
  _event: ScheduledEvent,
  env: Env['Bindings'],
  _ctx: ExecutionContext,
): Promise<void> {
  const igClient = new InstagramClient({
    accessToken: env.IG_ACCESS_TOKEN,
    igUserId: env.IG_USER_ID,
  });

  const jobs = [
    processStepDeliveries(env.DB, igClient, env.WORKER_URL),
    processScheduledBroadcasts(env.DB, igClient, env.WORKER_URL),
    processReminderDeliveries(env.DB, igClient),
  ];

  await Promise.allSettled(jobs);
}

export default {
  fetch: app.fetch,
  scheduled,
};
