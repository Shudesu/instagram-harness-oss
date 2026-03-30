import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

export function registerManageOutgoingWebhooks(server: McpServer): void {
  server.tool(
    "manage_outgoing_webhooks",
    "Outgoing webhook management. list: all webhooks, create: new webhook, update: modify, delete: remove. Webhooks fire on Instagram events like new followers, comments, or broadcasts.",
    {
      action: z
        .enum(["list", "create", "update", "delete"])
        .describe("Action to perform"),
      webhookId: z
        .string()
        .optional()
        .describe("Webhook ID (required for update, delete)"),
      name: z.string().optional().describe("Webhook name (for create, update)"),
      url: z.string().optional().describe("Destination URL to POST events to (for create, update)"),
      eventTypes: z
        .array(z.string())
        .optional()
        .describe("Event types to subscribe to (for create, update). Supported: \"dm_received\", \"comment_received\", \"tag_change\", \"postback\", \"cv_fire\""),
      secret: z
        .string()
        .nullable()
        .optional()
        .describe("HMAC signing secret for request verification (for create, update)"),
      isActive: z.boolean().optional().describe("Active status (for create, update)"),
    },
    async ({ action, webhookId, name, url, eventTypes, secret, isActive }) => {
      try {
        const client = getClient();

        if (action === "list") {
          const webhooks = await client.outgoingWebhooks.list();
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, webhooks }, null, 2) }] };
        }

        if (action === "create") {
          if (!name || !url || !eventTypes?.length) {
            throw new Error("name, url, and eventTypes are required for create");
          }
          const webhook = await client.outgoingWebhooks.create({
            name,
            url,
            eventTypes,
            secret: secret ?? null,
            isActive: isActive ?? true,
          });
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, webhook }, null, 2) }] };
        }

        if (!webhookId) throw new Error("webhookId is required for this action");

        if (action === "update") {
          const input: Record<string, unknown> = {};
          if (name !== undefined) input.name = name;
          if (url !== undefined) input.url = url;
          if (eventTypes !== undefined) input.eventTypes = eventTypes;
          if (secret !== undefined) input.secret = secret;
          if (isActive !== undefined) input.isActive = isActive;
          const webhook = await client.outgoingWebhooks.update(webhookId, input);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, webhook }, null, 2) }] };
        }

        if (action === "delete") {
          await client.outgoingWebhooks.delete(webhookId);
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted: webhookId }, null, 2) }] };
        }

        throw new Error(`Unknown action: ${action}`);
      } catch (err) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: String(err) }) }], isError: true };
      }
    },
  );
}
