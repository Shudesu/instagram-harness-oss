import { I as InstagramClient } from "./worker-entry-daCh42OM.js";
import { v, a } from "./worker-entry-daCh42OM.js";
function textPayload(text) {
  return { type: "text", text };
}
function imagePayload(url) {
  return { type: "image", url };
}
function templateElement(opts) {
  const element = {
    title: opts.title,
    subtitle: opts.subtitle,
    image_url: opts.imageUrl,
    buttons: opts.buttons
  };
  if (opts.url) {
    element.default_action = { type: "web_url", url: opts.url };
  }
  return element;
}
function quickReply(title, payload) {
  return { content_type: "text", title, payload };
}
function webUrlButton(title, url) {
  return { type: "web_url", title, url };
}
function postbackButton(title, payload) {
  return { type: "postback", title, payload };
}
export {
  InstagramClient,
  imagePayload,
  postbackButton,
  quickReply,
  templateElement,
  textPayload,
  v as verifyWebhookChallenge,
  a as verifyWebhookSignature,
  webUrlButton
};
