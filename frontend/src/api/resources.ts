import { get, post, put, del } from '@/utils/request'

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

export const getResources = async (params?: {
  keyword?: string
  resource_type?: string
}): Promise<{ success: boolean; data?: ResourceData[] }> => {
  const result = await get<ResourceData[]>('/resources', { params })
  return { success: true, data: result }
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
  return get(`/resources/${resourceId}/item-associations`)
}

export const updateResourceItemAssociations = (
  resourceId: string,
  itemIds: number[]
): Promise<ResourceAssociationUpdateResponse> => {
  return put(`/resources/${resourceId}/item-associations`, { item_ids: itemIds })
}
