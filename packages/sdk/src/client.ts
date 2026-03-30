import { HttpClient } from './http.js'
import { FollowersResource } from './resources/followers.js'
import { TagsResource } from './resources/tags.js'
import { ScenariosResource } from './resources/scenarios.js'
import { BroadcastsResource } from './resources/broadcasts.js'
import { CommentRulesResource } from './resources/comment-rules.js'
import { OutgoingWebhooksResource } from './resources/outgoing-webhooks.js'
import { TrackedLinksResource } from './resources/tracked-links.js'
import { FormsResource } from './resources/forms.js'
import { StaffResource } from './resources/staff.js'
import { ImagesResource } from './resources/images.js'
import type { InstagramHarnessConfig } from './types.js'

export class InstagramHarness {
  readonly followers: FollowersResource
  readonly tags: TagsResource
  readonly scenarios: ScenariosResource
  readonly broadcasts: BroadcastsResource
  readonly commentRules: CommentRulesResource
  readonly outgoingWebhooks: OutgoingWebhooksResource
  readonly trackedLinks: TrackedLinksResource
  readonly forms: FormsResource
  readonly staff: StaffResource
  readonly images: ImagesResource

  constructor(config: InstagramHarnessConfig) {
    const apiUrl = config.apiUrl.replace(/\/$/, '')

    const http = new HttpClient({
      baseUrl: apiUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30_000,
    })

    this.followers = new FollowersResource(http)
    this.tags = new TagsResource(http)
    this.scenarios = new ScenariosResource(http)
    this.broadcasts = new BroadcastsResource(http)
    this.commentRules = new CommentRulesResource(http)
    this.outgoingWebhooks = new OutgoingWebhooksResource(http)
    this.trackedLinks = new TrackedLinksResource(http)
    this.forms = new FormsResource(http)
    this.staff = new StaffResource(http)
    this.images = new ImagesResource(http)
  }
}
