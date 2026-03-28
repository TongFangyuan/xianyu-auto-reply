import request, { get, post, put, del } from '@/utils/request'

export interface ResourceLinkData {
  id?: number
  resource_name: string
  resource_type: string
  drive_type: string
  resource_url: string
  association_count?: number
  associated_items?: ResourceLinkAssociatedItemPreview[]
  created_at?: string
  updated_at?: string
}

export interface ResourceLinkAssociatedItemPreview {
  item_info_id: number
  cookie_id: string
  item_id: string
  item_title: string
}

export interface ResourceLinkImportDuplicate {
  id: number
  resource_name: string
  resource_type?: string
  new_resource_type?: string
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

export interface ResourceLinkAssociationItem {
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

export interface ResourceLinkAssociationResponse {
  resource: ResourceLinkData
  items: ResourceLinkAssociationItem[]
}

export interface ResourceLinkAssociationUpdateResponse {
  message: string
  added_count: number
  replaced_count: number
  removed_count: number
  total_selected: number
}

export const getResourceLinks = async (params?: {
  keyword?: string
  drive_type?: string
  resource_type?: string
}): Promise<{ success: boolean; data?: ResourceLinkData[] }> => {
  const result = await get<ResourceLinkData[]>('/resource-links', { params })
  return { success: true, data: result }
}

export const createResourceLink = (
  data: Omit<ResourceLinkData, 'id' | 'created_at' | 'updated_at'>
): Promise<{ id: number; message: string }> => {
  return post('/resource-links', data)
}

export const updateResourceLink = (
  linkId: string,
  data: Omit<ResourceLinkData, 'id' | 'created_at' | 'updated_at'>
): Promise<{ message: string }> => {
  return put(`/resource-links/${linkId}`, data)
}

export const deleteResourceLink = (linkId: string): Promise<{ message: string }> => {
  return del(`/resource-links/${linkId}`)
}

export const importResourceLinks = (data: {
  resource_name: string
  resource_type: string
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

export const exportResourceLinksDocument = async (): Promise<Blob> => {
  const response = await request.get('/resource-links/export-document', {
    responseType: 'blob',
  })
  return response.data
}

export const getResourceLinkItemAssociations = (linkId: string): Promise<ResourceLinkAssociationResponse> => {
  return get(`/resource-links/${linkId}/item-associations`)
}

export const updateResourceLinkItemAssociations = (
  linkId: string,
  itemIds: number[]
): Promise<ResourceLinkAssociationUpdateResponse> => {
  return put(`/resource-links/${linkId}/item-associations`, { item_ids: itemIds })
}
