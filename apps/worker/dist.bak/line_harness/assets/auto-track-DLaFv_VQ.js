import { c as createTrackedLink } from "./worker-entry-CSHkXpe4.js";
const APP_LINK_DOMAINS = /* @__PURE__ */ new Set([
  "x.com",
  "twitter.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "facebook.com",
  "github.com"
]);
function isAppLinkDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return APP_LINK_DOMAINS.has(hostname);
  } catch {
    return false;
  }
}
const URL_REGEX = /https?:\/\/[^\s"'<>\])}]+/g;
const SKIP_PATTERNS = [
  /\/t\/[0-9a-f-]{36}/,
  // already a tracking link
  /liff\.line\.me/,
  // LIFF URLs
  /line\.me\/R\//,
  // LINE deep links
  /line-crm-worker/
  // our own worker
];
function shouldSkip(url) {
  return SKIP_PATTERNS.some((p) => p.test(url));
}
function extractUrls(content) {
  const urls = /* @__PURE__ */ new Set();
  for (const match of content.matchAll(URL_REGEX)) {
    const url = match[0].replace(/[.,;:!?)]+$/, "");
    if (!shouldSkip(url)) urls.add(url);
  }
  return urls;
}
async function createTrackingMap(db, urls, workerUrl) {
  const urlMap = /* @__PURE__ */ new Map();
  for (const url of urls) {
    const link = await createTrackedLink(db, {
      name: `auto: ${url.slice(0, 60)}`,
      originalUrl: url
    });
    const trackingUrl = `${workerUrl}/t/${link.id}`;
    const hostname = new URL(url).hostname.replace("www.", "");
    const label = hostname.length > 20 ? hostname.slice(0, 20) + "…" : hostname;
    urlMap.set(url, { trackingUrl, originalUrl: url, label });
  }
  return urlMap;
}
function textToFlex(text, links) {
  let cleanText = text;
  for (const link of links) {
    cleanText = cleanText.split(link.originalUrl).join("").trim();
  }
  cleanText = cleanText.replace(/\s{2,}/g, " ").replace(/[👉🔗➡️]\s*$/g, "").trim();
  const bodyContents = [];
  if (cleanText) {
    bodyContents.push({
      type: "text",
      text: cleanText,
      size: "md",
      color: "#333333",
      wrap: true
    });
  }
  const buttons = links.map((link) => {
    const uri = isAppLinkDomain(link.originalUrl) ? `${link.trackingUrl}${link.trackingUrl.includes("?") ? "&" : "?"}openExternalBrowser=1` : link.trackingUrl;
    return {
      type: "button",
      action: {
        type: "uri",
        label: `${link.label} を開く`,
        uri
      },
      style: "primary",
      color: "#1a1a2e",
      margin: "sm"
    };
  });
  const bubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: bodyContents,
      paddingAll: "16px"
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: buttons,
      paddingAll: "12px"
    }
  };
  return JSON.stringify(bubble);
}
async function autoTrackContent(db, messageType, content, workerUrl) {
  if (messageType === "image") return { messageType, content };
  const urls = extractUrls(content);
  if (urls.size === 0) return { messageType, content };
  const urlMap = await createTrackingMap(db, urls, workerUrl);
  if (messageType === "text") {
    const links = Array.from(urlMap.values());
    return {
      messageType: "flex",
      content: textToFlex(content, links)
    };
  }
  let result = content;
  for (const [original, { trackingUrl, originalUrl }] of urlMap) {
    const finalUrl = isAppLinkDomain(originalUrl) ? `${trackingUrl}${trackingUrl.includes("?") ? "&" : "?"}openExternalBrowser=1` : trackingUrl;
    result = result.split(original).join(finalUrl);
  }
  return { messageType, content: result };
}
export {
  autoTrackContent
};
