import request, { del, get, post, put } from '@/utils/request'

export interface ResourceLinkData {
  id?: number
  resource_id?: number
  resource_name: string
  resource_type: string
  drive_type: string
  resource_url: string
  recommend_level?: number
  update_mode?: '' | 'daily' | 'weekly' | 'interval'
  update_weekdays?: number[]
  daily_episode_count?: number
  interval_days?: number
  latest_episode?: number
  is_completed?: boolean
  remark?: string
  is_invalid?: boolean
  association_count?: number
  created_at?: string
  updated_at?: string
}

export interface ResourceLinkPayload {
  resource_id?: number
  resource_name?: string
  drive_type: string
  resource_url: string
}

export interface ResourceLinkImportDuplicate {
  id: number
  resource_name: string
  resource_type?: string
  drive_type: string
  drive_type_label: string
  existing_url: string
  new_url: string
}

export interface ResourceLinkImportError {
  index: number
  message: string
  preview: string
}

export interface ResourceLinkImportResponse {
  success: boolean
  message: string
  requires_confirmation?: boolean
  duplicates?: ResourceLinkImportDuplicate[]
  errors?: ResourceLinkImportError[]
  created_count?: number
  updated_count?: number
  total_count?: number
  parsed_count?: number
}

export const getResourceLinks = async (params?: {
  keyword?: string
  drive_type?: string
  resource_type?: string
  invalid_status?: boolean
}): Promise<{ success: boolean; data?: ResourceLinkData[] }> => {
  const result = await get<ResourceLinkData[]>('/resource-links', { params })
  return { success: true, data: result }
}

export const createResourceLink = (
  data: ResourceLinkPayload
): Promise<{ id: number; message: string }> => {
  return post('/resource-links', data)
}

export const updateResourceLink = (
  linkId: string,
  data: ResourceLinkPayload
): Promise<{ message: string }> => {
  return put(`/resource-links/${linkId}`, data)
}

export const updateResourceLinkInvalidStatus = (
  linkId: string,
  data: { is_invalid: boolean }
): Promise<{ message: string; is_invalid: boolean }> => {
  return put(`/resource-links/${linkId}/invalid-status`, data)
}

export const deleteResourceLink = (linkId: string): Promise<{ message: string }> => {
  return del(`/resource-links/${linkId}`)
}

export const importResourceLinks = (data: {
  resource_name: string
  content: string
  confirm_update?: boolean
}): Promise<ResourceLinkImportResponse> => {
  return post('/resource-links/import', data)
}

export const importResourceLinksCsv = (formData: FormData): Promise<ResourceLinkImportResponse> => {
  return post('/resource-links/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadResourceLinksTemplate = async (): Promise<Blob> => {
  const response = await request.get('/resource-links/template', {
    responseType: 'blob',
  })
  return response.data
}

export const exportResourceLinksDocument = async (params?: {
  export_mode?: 'all' | 'updated'
  updated_after?: string
  updated_preset?: string
}): Promise<Blob> => {
  const response = await request.get('/resource-links/export-document', {
    responseType: 'blob',
    params,
  })
  return response.data
}
