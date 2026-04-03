import request, { get, post, put, del } from '@/utils/request'

export interface ResourceData {
  id?: number
  resource_name: string
  resource_type: string
  recommend_level?: number
  update_mode?: '' | 'daily' | 'weekly' | 'interval'
  update_weekdays?: number[]
  daily_episode_count?: number
  interval_days?: number
  latest_episode?: number
  is_completed?: boolean
  remark?: string
  association_count?: number
  associated_items?: ResourceAssociatedItemPreview[]
  created_at?: string
  updated_at?: string
}

export interface ResourceAssociatedItemPreview {
  item_info_id: number
  cookie_id: string
  item_id: string
  item_title: string
}

export interface ResourceAssociationItem {
  id: number
  cookie_id: string
  item_id: string
  item_title?: string
  display_title: string
  item_price?: string
  updated_at?: string
  association_status: 'none' | 'current' | 'other'
  associated_resource_id?: number
  associated_resource_name?: string
}

export interface ResourceAssociationResponse {
  resource: ResourceData
  items: ResourceAssociationItem[]
}

export interface ResourceAssociationUpdateResponse {
  message: string
  added_count: number
  replaced_count: number
  removed_count: number
  total_selected: number
}

const normalizeUpdateWeekdays = (value: unknown): number[] => {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(/[，,\s/]+/)
      : []

  const normalized = candidates
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7)

  return Array.from(new Set(normalized))
}

const normalizeResource = (resource: ResourceData): ResourceData => ({
  ...resource,
  update_weekdays: normalizeUpdateWeekdays(resource.update_weekdays),
})

export const getResources = async (params?: {
  keyword?: string
  resource_type?: string
}): Promise<{ success: boolean; data?: ResourceData[] }> => {
  const result = await get<ResourceData[]>('/resources', { params })
  return { success: true, data: (result || []).map(normalizeResource) }
}

export const createResource = (
  data: Omit<ResourceData, 'id' | 'association_count' | 'associated_items' | 'created_at' | 'updated_at'>
): Promise<{ id: number; message: string }> => {
  return post('/resources', data)
}

export const updateResource = (
  resourceId: string,
  data: Omit<ResourceData, 'id' | 'association_count' | 'associated_items' | 'created_at' | 'updated_at'>
): Promise<{ message: string }> => {
  return put(`/resources/${resourceId}`, data)
}

export const deleteResource = (resourceId: string): Promise<{ message: string }> => {
  return del(`/resources/${resourceId}`)
}

export const getResourceItemAssociations = (resourceId: string): Promise<ResourceAssociationResponse> => {
  return get<ResourceAssociationResponse>(`/resources/${resourceId}/item-associations`)
    .then((result) => ({
      ...result,
      resource: normalizeResource(result.resource),
    }))
}

export const updateResourceItemAssociations = (
  resourceId: string,
  itemIds: number[]
): Promise<ResourceAssociationUpdateResponse> => {
  return put(`/resources/${resourceId}/item-associations`, { item_ids: itemIds })
}

export const exportResourcesDocument = async (params?: {
  resource_types?: string[]
}): Promise<Blob> => {
  const searchParams = new URLSearchParams()
  for (const resourceType of params?.resource_types || []) {
    const normalizedType = resourceType.trim()
    if (normalizedType) {
      searchParams.append('resource_types', normalizedType)
    }
  }
  const response = await request.get('/resources/export-document', {
    params: searchParams,
    responseType: 'blob',
  })
  return response.data
}

export const exportResourcesCopywriting = async (params?: {
  export_range?: 'all' | 'since_last' | 'duration'
  duration_value?: number
  duration_unit?: 'minutes' | 'hours' | 'days'
}): Promise<Blob> => {
  const response = await request.get('/resources/export-copywriting', {
    params,
    responseType: 'blob',
  })
  return response.data
}
