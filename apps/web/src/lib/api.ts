import type {
  Tag,
  CommentRule,
  ApiResponse,
  StaffMember,
} from '@instagram-harness/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL
if (!API_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is not set. Build cannot proceed without a valid API URL. ' +
    'Set it in .env.production (local) or GitHub Secrets (CI).'
  )
}

/**
 * Read the API key from localStorage (set during login).
 */
function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('lh_api_key') || ''
  }
  return ''
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

// ── Follower types (serialized by the worker's friends route) ──

export interface FollowerApi {
  id: string
  igsid: string | null
  username: string | null
  displayName: string | null
  pictureUrl: string | null
  isFollowing: boolean
  score: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export type FollowerListResponse = {
  items: FollowerApi[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
}

export type FollowerListParams = {
  offset?: string
  limit?: string
  tagId?: string
  search?: string
}

// ── Scenario types (aligned with worker's scenarios route) ──

export interface ScenarioApi {
  id: string
  name: string
  description: string | null
  triggerType: string
  triggerTagId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stepCount?: number
}

export const api = {
  followers: {
    // The worker still serves these at /api/friends
    list: (params?: FollowerListParams) => {
      const query: Record<string, string> = {}
      if (params?.offset) query.offset = params.offset
      if (params?.limit) query.limit = params.limit
      if (params?.tagId) query.tagId = params.tagId
      if (params?.search) query.search = params.search
      return fetchApi<ApiResponse<FollowerListResponse>>(
        '/api/friends?' + new URLSearchParams(query)
      )
    },
    get: (id: string) =>
      fetchApi<ApiResponse<FollowerApi>>(`/api/friends/${id}`),
    count: () =>
      fetchApi<ApiResponse<{ count: number }>>('/api/friends/count'),
    addTag: (followerId: string, tagId: string) =>
      fetchApi<ApiResponse<null>>(`/api/friends/${followerId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tagId }),
      }),
    removeTag: (followerId: string, tagId: string) =>
      fetchApi<ApiResponse<null>>(`/api/friends/${followerId}/tags/${tagId}`, {
        method: 'DELETE',
      }),
  },
  tags: {
    list: () =>
      fetchApi<ApiResponse<Tag[]>>('/api/tags'),
    create: (data: { name: string; color: string }) =>
      fetchApi<ApiResponse<Tag>>('/api/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<ApiResponse<null>>(`/api/tags/${id}`, { method: 'DELETE' }),
  },
  commentRules: {
    list: () =>
      fetchApi<ApiResponse<CommentRule[]>>('/api/comment-rules'),
    get: (id: string) =>
      fetchApi<ApiResponse<CommentRule>>(`/api/comment-rules/${id}`),
    create: (data: Omit<CommentRule, 'id' | 'createdAt' | 'updatedAt'>) =>
      fetchApi<ApiResponse<CommentRule>>('/api/comment-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Omit<CommentRule, 'id' | 'createdAt' | 'updatedAt'>>) =>
      fetchApi<ApiResponse<CommentRule>>(`/api/comment-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<ApiResponse<null>>(`/api/comment-rules/${id}`, { method: 'DELETE' }),
    toggle: (id: string, isActive: boolean) =>
      fetchApi<ApiResponse<CommentRule>>(`/api/comment-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      }),
  },
  scenarios: {
    list: () =>
      fetchApi<ApiResponse<ScenarioApi[]>>('/api/scenarios'),
    get: (id: string) =>
      fetchApi<ApiResponse<ScenarioApi>>(`/api/scenarios/${id}`),
    create: (data: { name: string; triggerType: string; triggerTagId?: string | null; isActive: boolean }) =>
      fetchApi<ApiResponse<ScenarioApi>>('/api/scenarios', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { isActive?: boolean; name?: string; triggerType?: string }) =>
      fetchApi<ApiResponse<ScenarioApi>>(`/api/scenarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchApi<ApiResponse<null>>(`/api/scenarios/${id}`, { method: 'DELETE' }),
  },
  staff: {
    me: () =>
      fetchApi<ApiResponse<{ id: string; name: string; role: string }>>('/api/staff/me'),
    list: () =>
      fetchApi<ApiResponse<StaffMember[]>>('/api/staff'),
  },
}
