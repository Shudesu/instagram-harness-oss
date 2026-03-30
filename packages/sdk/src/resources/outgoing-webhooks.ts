import type { HttpClient } from '../http.js'
import type { ApiResponse, OutgoingWebhook, CreateOutgoingWebhookInput, UpdateOutgoingWebhookInput } from '../types.js'

export class OutgoingWebhooksResource {
  constructor(private readonly http: HttpClient) {}

  async list(): Promise<OutgoingWebhook[]> {
    const res = await this.http.get<ApiResponse<OutgoingWebhook[]>>('/api/webhooks/outgoing')
    return res.data
  }

  async get(id: string): Promise<OutgoingWebhook> {
    const res = await this.http.get<ApiResponse<OutgoingWebhook>>(`/api/webhooks/outgoing/${id}`)
    return res.data
  }

  async create(input: CreateOutgoingWebhookInput): Promise<OutgoingWebhook> {
    const res = await this.http.post<ApiResponse<OutgoingWebhook>>('/api/webhooks/outgoing', input)
    return res.data
  }

  async update(id: string, input: UpdateOutgoingWebhookInput): Promise<OutgoingWebhook> {
    const res = await this.http.put<ApiResponse<OutgoingWebhook>>(`/api/webhooks/outgoing/${id}`, input)
    return res.data
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/api/webhooks/outgoing/${id}`)
  }
}
