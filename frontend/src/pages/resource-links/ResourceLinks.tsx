import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Key,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  createResourceLink,
  deleteResourceLink,
  downloadResourceLinksTemplate,
  exportResourceLinksDocument,
  getResourceLinks,
  importResourceLinks,
  importResourceLinksCsv,
  updateResourceLink,
  type ResourceLinkData,
  type ResourceLinkImportDuplicate,
  type ResourceLinkImportError,
} from '@/api/resourceLinks'
import { getResources, type ResourceData } from '@/api/resources'
import { getUserSetting } from '@/api/settings'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

type ModalType = 'add' | 'edit' | null

type ResourceLinkFormData = {
  resource_id: string
  drive_type: string
  resource_url: string
}

const driveTypeSuggestions = ['夸克', '百度', '阿里云盘', '迅雷云盘', 'UC网盘']

const driveTypeLabels: Record<string, string> = {
  quark: '夸克',
  baidu: '百度',
}

const driveTypeBadges: Record<string, string> = {
  quark: 'badge-primary',
  baidu: 'badge-warning',
}

const exportModeOptions = [
  { value: 'all', label: '导出全部资源' },
  { value: 'updated', label: '仅导出更新内容' },
]

const exportUpdatedPresetOptions = [
  { value: 'since_last', label: '自上次导出后更新' },
  { value: 'today', label: '今天更新' },
  { value: '3d', label: '最近3天更新' },
  { value: '7d', label: '最近7天更新' },
  { value: 'custom', label: '自定义时间' },
]

const initialFormData: ResourceLinkFormData = {
  resource_id: '',
  drive_type: '',
  resource_url: '',
}

const formatDateTimeLocal = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const getErrorMessage = (error: unknown, fallback: string) => {
  const maybeError = error as {
    response?: {
      data?: {
        detail?: string
        message?: string
      }
    }
  }

  return maybeError.response?.data?.detail || maybeError.response?.data?.message || fallback
}

const getDriveTypeLabel = (driveType: string) => driveTypeLabels[driveType] || driveType

const getDisplayDriveInputValue = (driveType: string) => driveTypeLabels[driveType] || driveType

const formatWeekdayLabels = (weekdays: number[]) => {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((weekday) => labels[weekday - 1] || `周${weekday}`)
    .join(' / ')
}

const buildResourceSummaryLines = (resource?: ResourceData | null) => {
  if (!resource) return ['请选择一个资源']

  const lines = [`${resource.resource_type || '未分类'}${resource.is_completed ? ' · 已完结' : ' · 连载中'}`]

  if (resource.update_mode === 'weekly' && resource.update_weekdays?.length) {
    lines.push(`周更 · ${formatWeekdayLabels(resource.update_weekdays)}`)
  } else if (resource.update_mode === 'daily' && Number(resource.daily_episode_count || 0) > 0) {
    lines.push(`日更 · 每天 ${resource.daily_episode_count} 集`)
  } else if (resource.update_mode === 'interval' && Number(resource.interval_days || 0) > 0) {
    lines.push(`固定更新 · 每 ${resource.interval_days} 天`)
  }

  if (Number(resource.latest_episode || 0) > 0) {
    lines.push(`更新至 ${resource.latest_episode} 集`)
  }

  if (resource.remark) {
    lines.push(resource.remark)
  }

  return lines
}

function SuggestionInput({
  value,
  onChange,
  options,
  placeholder,
  listId,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  listId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const normalizedValue = value.trim().toLowerCase()
  const uniqueOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)))
  const hasExactOption = uniqueOptions.some((option) => option.toLowerCase() === normalizedValue)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`relative flex items-center rounded-2xl border bg-white transition-colors ${
          isOpen
            ? 'border-transparent ring-2 ring-blue-500'
            : 'border-slate-300 hover:border-blue-400'
        }`}
      >
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="input-ios border-0 bg-transparent pr-12 focus:ring-0 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          tabIndex={-1}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {value.trim() && !hasExactOption && (
            <button
              type="button"
              onClick={() => handleSelect(value.trim())}
              className="flex w-full items-center justify-between gap-3 bg-blue-50 px-5 py-4 text-left text-slate-700 transition-colors hover:bg-blue-100"
            >
              <div className="min-w-0">
                <div className="truncate text-base font-medium text-blue-600">{value.trim()}</div>
                <div className="mt-1 text-xs text-slate-500">使用当前输入作为自定义选项</div>
              </div>
              <Check className="h-5 w-5 flex-shrink-0 text-blue-500" />
            </button>
          )}

          {uniqueOptions.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-400">暂无匹配选项</div>
          ) : (
            uniqueOptions.map((option) => {
              const isSelected = option.toLowerCase() === normalizedValue
              return (
                <button
                  key={`${listId}-${option}`}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-base transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{option}</span>
                  {isSelected ? <Check className="h-5 w-5 flex-shrink-0 text-blue-500" /> : null}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export function ResourceLinks() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [resourceLinks, setResourceLinks] = useState<ResourceLinkData[]>([])
  const [resources, setResources] = useState<ResourceData[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [queryKeyword, setQueryKeyword] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [driveFilter, setDriveFilter] = useState('')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [editingLink, setEditingLink] = useState<ResourceLinkData | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<ResourceLinkFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResourceId, setImportResourceId] = useState('')
  const [importContent, setImportContent] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<ResourceLinkImportError[]>([])
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false)
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null)
  const [csvImportErrors, setCsvImportErrors] = useState<ResourceLinkImportError[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [exportingDocument, setExportingDocument] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'all' | 'updated'>('all')
  const [exportUpdatedPreset, setExportUpdatedPreset] = useState('today')
  const [exportCustomSince, setExportCustomSince] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return formatDateTimeLocal(date)
  })
  const [lastExportAt, setLastExportAt] = useState<string>('')
  const [loadingLastExportAt, setLoadingLastExportAt] = useState(false)

  const resourceOptions = useMemo(() => (
    resources.map((resource) => ({
      value: String(resource.id),
      label: resource.resource_type
        ? `${resource.resource_name} · ${resource.resource_type}`
        : resource.resource_name,
    }))
  ), [resources])

  const resourceTypeOptions = useMemo(() => {
    const values = Array.from(new Set(
      [
        ...resources.map((resource) => resource.resource_type?.trim()).filter(Boolean),
        ...resourceLinks
        .map((link) => link.resource_type?.trim())
        .filter(Boolean),
        ...(resourceTypeFilter ? [resourceTypeFilter] : []),
      ] as string[]
    ))
    return [{ value: '', label: '全部资源类型' }, ...values.map((item) => ({ value: item, label: item }))]
  }, [resourceLinks, resourceTypeFilter, resources])

  const driveTypeOptions = useMemo(() => {
    const values = Array.from(new Set([
      ...driveTypeSuggestions,
      ...resourceLinks.map((link) => getDriveTypeLabel(link.drive_type)),
      ...(driveFilter ? [driveFilter] : []),
    ]))
    return [{ value: '', label: '全部网盘' }, ...values.map((item) => ({ value: item, label: item }))]
  }, [driveFilter, resourceLinks])

  const selectedFormResource = resources.find((resource) => String(resource.id) === formData.resource_id) || null
  const selectedImportResource = resources.find((resource) => String(resource.id) === importResourceId) || null
  const exportUpdatedPresetLabel = exportUpdatedPresetOptions.find((option) => option.value === exportUpdatedPreset)?.label || '今天更新'
  const exportUpdatedSummary = exportUpdatedPreset === 'since_last'
    ? (
      loadingLastExportAt
        ? '正在读取上次导出时间...'
        : lastExportAt
          ? `导出 ${lastExportAt} 之后更新的资源`
          : '尚无上次导出记录，首次使用时会导出全部资源并记录本次导出时间'
    )
    : exportUpdatedPreset === 'custom'
      ? (exportCustomSince ? `${exportCustomSince.replace('T', ' ')} 之后更新的资源` : '请选择自定义更新时间')
      : `${exportUpdatedPresetLabel}的资源`

  const loadResources = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      const result = await getResources()
      if (result.success) {
        setResources(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载资源列表失败' })
    }
  }

  const loadResourceLinks = async (
    keyword = queryKeyword,
    driveType = driveFilter,
    resourceType = resourceTypeFilter
  ) => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getResourceLinks({
        keyword: keyword || undefined,
        drive_type: driveType || undefined,
        resource_type: resourceType || undefined,
      })
      if (result.success) {
        setResourceLinks(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载卡密失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadResources()
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadResourceLinks()
  }, [_hasHydrated, isAuthenticated, token, queryKeyword, driveFilter, resourceTypeFilter])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setQueryKeyword(searchInput.trim())
  }

  const ensureResourcesReady = () => {
    if (resources.length > 0) return true
    addToast({ type: 'warning', message: '请先到资源管理中创建资源' })
    return false
  }

  const openAddModal = () => {
    if (!ensureResourcesReady()) return
    setEditingLink(null)
    setEditingId(null)
    setFormData(initialFormData)
    setSubmitting(false)
    setActiveModal('add')
  }

  const openEditModal = (link: ResourceLinkData) => {
    const matchedResource = link.resource_id
      ? resources.find((resource) => resource.id === link.resource_id)
      : resources.find((resource) => resource.resource_name === link.resource_name)

    setEditingLink(link)
    setEditingId(link.id ?? null)
    setFormData({
      resource_id: matchedResource ? String(matchedResource.id) : '',
      drive_type: getDisplayDriveInputValue(link.drive_type),
      resource_url: link.resource_url,
    })
    setSubmitting(false)
    setActiveModal('edit')
  }

  const closeModal = () => {
    setActiveModal(null)
    setEditingLink(null)
    setEditingId(null)
    setFormData(initialFormData)
    setSubmitting(false)
  }

  const closeImportModal = () => {
    setImportModalOpen(false)
    setImportResourceId('')
    setImportContent('')
    setImportErrors([])
    setImporting(false)
  }

  const closeCsvImportModal = () => {
    setCsvImportModalOpen(false)
    setCsvImportFile(null)
    setCsvImportErrors([])
    setCsvImporting(false)
    setCsvInputKey((prev) => prev + 1)
  }

  const openImportModal = () => {
    if (!ensureResourcesReady()) return
    setImportModalOpen(true)
  }

  const openExportModal = async () => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    setExportMode('all')
    setExportUpdatedPreset('today')
    setExportCustomSince(formatDateTimeLocal(date))
    setLastExportAt('')
    setExportModalOpen(true)
    setLoadingLastExportAt(true)

    try {
      const result = await getUserSetting('resource_links_last_exported_at')
      setLastExportAt(result.success ? (result.value || '') : '')
    } catch {
      setLastExportAt('')
    } finally {
      setLoadingLastExportAt(false)
    }
  }

  const closeExportModal = () => {
    setExportModalOpen(false)
    setExportingDocument(false)
  }

  const buildDuplicateConfirmText = (duplicates: ResourceLinkImportDuplicate[], message: string) => {
    const preview = duplicates
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.resource_name} / ${item.drive_type_label}`)
      .join('\n')
    const suffix = duplicates.length > 5 ? `\n... 另有 ${duplicates.length - 5} 条重复卡密` : ''
    return `${message}\n\n${preview}${suffix}\n\n确认后会更新现有链接。`
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.resource_id) {
      addToast({ type: 'warning', message: '请选择关联资源' })
      return
    }
    if (!formData.drive_type.trim()) {
      addToast({ type: 'warning', message: '请输入网盘类型' })
      return
    }
    if (!formData.resource_url.trim()) {
      addToast({ type: 'warning', message: '请输入资源链接或分享口令' })
      return
    }

    const selectedResource = resources.find((resource) => String(resource.id) === formData.resource_id)
    if (!selectedResource) {
      addToast({ type: 'warning', message: '所选资源不存在，请重新选择' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        resource_id: Number(formData.resource_id),
        resource_name: selectedResource.resource_name,
        drive_type: formData.drive_type.trim(),
        resource_url: formData.resource_url.trim(),
      }

      if (editingId) {
        await updateResourceLink(String(editingId), payload)
        addToast({ type: 'success', message: '卡密已更新' })
      } else {
        await createResourceLink(payload)
        addToast({ type: 'success', message: '卡密已新增' })
      }

      closeModal()
      loadResourceLinks()
      loadResources()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存失败') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (link: ResourceLinkData) => {
    if (!confirm(`确定要删除卡密「${link.resource_name} / ${getDriveTypeLabel(link.drive_type)}」吗？`)) return

    try {
      await deleteResourceLink(String(link.id))
      addToast({ type: 'success', message: '删除成功' })
      loadResourceLinks()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '删除失败') })
    }
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      addToast({ type: 'success', message: '链接已复制' })
    } catch {
      addToast({ type: 'error', message: '复制失败，请手动复制' })
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true)
      const blob = await downloadResourceLinksTemplate()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'resource_links_template.csv'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '模板下载失败') })
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleExportDocument = async () => {
    try {
      setExportingDocument(true)
      let updatedAfter: string | undefined
      if (exportMode === 'updated') {
        if (exportUpdatedPreset === 'since_last') {
          updatedAfter = undefined
        } else if (exportUpdatedPreset === 'custom') {
          if (!exportCustomSince) {
            addToast({ type: 'warning', message: '请选择自定义更新时间' })
            return
          }
          updatedAfter = exportCustomSince
        } else {
          const date = new Date()
          if (exportUpdatedPreset === 'today') {
            date.setHours(0, 0, 0, 0)
          } else if (exportUpdatedPreset === '3d') {
            date.setDate(date.getDate() - 3)
          } else {
            date.setDate(date.getDate() - 7)
          }
          updatedAfter = formatDateTimeLocal(date)
        }
      }

      const blob = await exportResourceLinksDocument({
        export_mode: exportMode,
        updated_after: updatedAfter,
        updated_preset: exportMode === 'updated' ? exportUpdatedPreset : undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = '卡密资源文档.md'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      addToast({ type: 'success', message: exportMode === 'updated' ? '更新文档已开始下载' : '资源文档已开始下载' })
      closeExportModal()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '导出文档失败') })
    } finally {
      setExportingDocument(false)
    }
  }

  const handleImport = async () => {
    if (!selectedImportResource) {
      addToast({ type: 'warning', message: '请选择关联资源' })
      return
    }
    if (!importContent.trim()) {
      addToast({ type: 'warning', message: '请输入分享口令内容' })
      return
    }

    setImporting(true)
    setImportErrors([])

    try {
      const firstPass = await importResourceLinks({
        resource_name: selectedImportResource.resource_name,
        content: importContent.trim(),
        confirm_update: false,
      })

      if (!firstPass.success && firstPass.errors?.length) {
        setImportErrors(firstPass.errors)
        addToast({ type: 'error', message: firstPass.message || '导入失败' })
        return
      }

      if (!firstPass.success && firstPass.requires_confirmation) {
        const duplicates = firstPass.duplicates || []
        const confirmed = confirm(buildDuplicateConfirmText(duplicates, firstPass.message))

        if (!confirmed) {
          return
        }

        const secondPass = await importResourceLinks({
          resource_name: selectedImportResource.resource_name,
          content: importContent.trim(),
          confirm_update: true,
        })

        if (!secondPass.success) {
          setImportErrors(secondPass.errors || [])
          addToast({ type: 'error', message: secondPass.message || '导入失败' })
          return
        }

        addToast({ type: 'success', message: secondPass.message || '导入成功' })
        closeImportModal()
        loadResourceLinks()
        return
      }

      if (!firstPass.success) {
        addToast({ type: 'error', message: firstPass.message || '导入失败' })
        return
      }

      addToast({ type: 'success', message: firstPass.message || '导入成功' })
      closeImportModal()
      loadResourceLinks()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '导入失败') })
    } finally {
      setImporting(false)
    }
  }

  const handleCsvImport = async () => {
    if (!csvImportFile) {
      addToast({ type: 'warning', message: '请选择 CSV 文件' })
      return
    }

    const formData = new FormData()
    formData.append('file', csvImportFile)

    setCsvImporting(true)
    setCsvImportErrors([])

    try {
      const result = await importResourceLinksCsv(formData)

      if (!result.success && result.errors?.length) {
        setCsvImportErrors(result.errors)
        addToast({ type: 'error', message: result.message || 'CSV 导入失败' })
        return
      }

      if (!result.success) {
        addToast({ type: 'error', message: result.message || 'CSV 导入失败' })
        return
      }

      addToast({ type: 'success', message: result.message || 'CSV 导入成功' })
      closeCsvImportModal()
      loadResourceLinks()
      loadResources()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, 'CSV 导入失败') })
    } finally {
      setCsvImporting(false)
    }
  }

  const linkedResourceCount = new Set(
    resourceLinks
      .map((link) => link.resource_id || link.resource_name)
      .filter(Boolean)
  ).size

  const customDriveCount = resourceLinks.filter(
    (link) => !['quark', 'baidu'].includes((link.drive_type || '').toLowerCase())
  ).length

  if (loading && resourceLinks.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">卡密管理</h1>
          <p className="page-description">卡密与资源分离维护。这里仅管理资源关联的网盘链接，资源元数据与商品关联请到资源管理中操作。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openExportModal} disabled={exportingDocument} className="btn-ios-secondary">
            {exportingDocument ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            导出文档
          </button>
          <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} className="btn-ios-secondary">
            {downloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            下载模板
          </button>
          <button onClick={() => setCsvImportModalOpen(true)} className="btn-ios-secondary">
            <Upload className="w-4 h-4" />
            CSV导入
          </button>
          <button onClick={openImportModal} className="btn-ios-secondary">
            <Upload className="w-4 h-4" />
            口令导入
          </button>
          <button onClick={openAddModal} className="btn-ios-primary">
            <Plus className="w-4 h-4" />
            新增卡密
          </button>
          <button
            onClick={() => {
              loadResources()
              loadResourceLinks()
            }}
            className="btn-ios-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-blue-600">{resourceLinks.length}</div>
          <div className="text-sm text-slate-500">当前卡密数</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-cyan-600">{linkedResourceCount}</div>
          <div className="text-sm text-slate-500">已关联资源数</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-amber-600">{customDriveCount}</div>
          <div className="text-sm text-slate-500">自定义网盘</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="vben-card"
      >
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <Key className="w-4 h-4" />
            卡密列表
          </h2>
        </div>
        <div className="vben-card-body space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="input-label mb-1">资源名称</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索资源名称"
                  className="input-ios pl-9"
                />
              </div>
            </div>
            <div className="lg:col-span-3">
              <label className="input-label mb-1">资源类型</label>
              <Select
                value={resourceTypeFilter}
                onChange={setResourceTypeFilter}
                options={resourceTypeOptions}
                placeholder="全部资源类型"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="input-label mb-1">网盘类型</label>
              <Select
                value={driveFilter}
                onChange={setDriveFilter}
                options={driveTypeOptions}
                placeholder="全部网盘"
              />
            </div>
            <div className="lg:col-span-2 flex items-end gap-3">
              <button type="submit" className="btn-ios-primary flex-1">
                <Search className="w-4 h-4" />
                搜索
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setQueryKeyword('')
                  setResourceTypeFilter('')
                  setDriveFilter('')
                }}
                className="btn-ios-secondary"
              >
                重置
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <table className="table-ios min-w-full">
              <thead>
                <tr>
                  <th>资源名称</th>
                  <th>资源类型</th>
                  <th>网盘类型</th>
                  <th>资源链接</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {resourceLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Link2 className="w-12 h-12 text-slate-300" />
                        <p>暂无卡密</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  resourceLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="min-w-[220px] font-medium">
                        <div>{link.resource_name}</div>
                      </td>
                      <td>
                        <span className="badge-gray">
                          {link.resource_type || '-'}
                        </span>
                      </td>
                      <td>
                        <span className={driveTypeBadges[link.drive_type] || 'badge-gray'}>
                          {getDriveTypeLabel(link.drive_type)}
                        </span>
                      </td>
                      <td className="max-w-[420px]">
                        <a
                          href={link.resource_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate block text-blue-600 dark:text-blue-400 hover:underline"
                          title={link.resource_url}
                        >
                          {link.resource_url}
                        </a>
                      </td>
                      <td className="text-sm text-slate-500 whitespace-nowrap">{link.updated_at || link.created_at || '-'}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(link.resource_url)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="复制链接"
                          >
                            <Copy className="w-4 h-4 text-slate-500" />
                          </button>
                          <a
                            href={link.resource_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="打开链接"
                          >
                            <ExternalLink className="w-4 h-4 text-cyan-600" />
                          </a>
                          <button
                            onClick={() => openEditModal(link)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => link.id && handleDelete(link)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">导出文档</h3>
                <p className="text-sm text-slate-500 mt-1">支持导出全部资源，或仅导出某个时间点之后更新过的资源。</p>
              </div>
              <button onClick={closeExportModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <label className="input-label">导出范围</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {exportModeOptions.map((option) => {
                    const selected = exportMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExportMode(option.value as 'all' | 'updated')}
                        className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-base font-medium">{option.label}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {option.value === 'all' ? '导出当前账号下全部资源文档' : '仅导出指定时间之后有更新的资源'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {exportMode === 'updated' && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <label className="input-label mb-1">更新时间范围</label>
                    <Select
                      value={exportUpdatedPreset}
                      onChange={setExportUpdatedPreset}
                      options={exportUpdatedPresetOptions}
                      placeholder="请选择更新时间范围"
                    />
                  </div>

                  {exportUpdatedPreset === 'custom' && (
                    <div>
                      <label className="input-label mb-1">自定义起点</label>
                      <input
                        type="datetime-local"
                        value={exportCustomSince}
                        onChange={(e) => setExportCustomSince(e.target.value)}
                        className="input-ios"
                      />
                    </div>
                  )}

                  <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-600">
                    <p>本次将导出：{exportUpdatedSummary}</p>
                    <p className="mt-1 text-slate-500">如果同一资源名称下只有部分网盘链接被更新，导出时会自动补齐该资源的完整链接。</p>
                    {exportUpdatedPreset === 'since_last' && (
                      <p className="mt-1 text-slate-500">成功导出后，系统会自动把本次导出时间记为新的基线。</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeExportModal} className="btn-ios-secondary">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleExportDocument}
                  disabled={exportingDocument || (exportMode === 'updated' && exportUpdatedPreset === 'since_last' && loadingLastExportAt)}
                  className="btn-ios-primary min-w-[132px]"
                >
                  {exportingDocument ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  开始导出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {activeModal === 'add' ? '新增卡密' : '编辑卡密'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">先选择一个已存在的资源，再维护对应的网盘类型和资源链接。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-88px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="input-label mb-1">关联资源</label>
                  <Select
                    value={formData.resource_id}
                    onChange={(value) => setFormData((prev) => ({ ...prev, resource_id: value }))}
                    options={resourceOptions}
                    placeholder="请选择资源"
                  />
                  {editingLink && !selectedFormResource && (
                    <p className="text-xs text-amber-600 mt-2">当前卡密关联的资源不存在，请重新选择一个资源后再保存。</p>
                  )}
                </div>

                <div>
                  <label className="input-label mb-1">网盘类型</label>
                  <SuggestionInput
                    value={formData.drive_type}
                    onChange={(value) => setFormData((prev) => ({ ...prev, drive_type: value }))}
                    options={driveTypeSuggestions}
                    placeholder="例如：夸克、百度、阿里云盘"
                    listId="drive-type-form-options"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="input-label mb-1">资源链接或分享口令</label>
                  <textarea
                    value={formData.resource_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, resource_url: e.target.value }))}
                    rows={5}
                    placeholder="可直接填写网盘链接，也可粘贴完整分享口令，系统会自动提取链接。"
                    className="input-ios min-h-[132px] resize-y"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="text-sm font-medium text-slate-700">
                  {selectedFormResource ? `当前资源：${selectedFormResource.resource_name}` : '资源预览'}
                </div>
                {buildResourceSummaryLines(selectedFormResource).map((line, index) => (
                  <div key={`resource-preview-${index}`} className={index === 0 ? 'text-sm text-slate-700' : 'text-xs text-slate-500'}>
                    {line}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ios-secondary">
                  取消
                </button>
                <button type="submit" disabled={submitting} className="btn-ios-primary min-w-[120px]">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {activeModal === 'add' ? '保存卡密' : '更新卡密'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">口令导入</h3>
                <p className="text-sm text-slate-500 mt-1">选择一个已存在的资源，系统会从口令中识别网盘类型和链接。</p>
              </div>
              <button onClick={closeImportModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-88px)]">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-1">
                <p>请先在资源管理里创建资源，再把夸克或百度分享口令贴到这里。</p>
                <p>若“资源 + 网盘类型”已存在，会先提示确认，确认后执行更新。</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 space-y-4">
                  <div>
                    <label className="input-label mb-1">关联资源</label>
                    <Select
                      value={importResourceId}
                      onChange={setImportResourceId}
                      options={resourceOptions}
                      placeholder="请选择资源"
                    />
                  </div>

                  <div>
                    <label className="input-label mb-1">分享口令内容</label>
                    <textarea
                      value={importContent}
                      onChange={(e) => setImportContent(e.target.value)}
                      rows={12}
                      placeholder="把夸克或百度的分享口令粘贴到这里，每段口令之间请空一行。"
                      className="input-ios min-h-[280px] resize-y"
                    />
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="text-sm font-medium text-slate-700">
                      {selectedImportResource ? `当前资源：${selectedImportResource.resource_name}` : '资源预览'}
                    </div>
                    {buildResourceSummaryLines(selectedImportResource).map((line, index) => (
                      <div key={`import-resource-preview-${index}`} className={index === 0 ? 'text-sm text-slate-700' : 'text-xs text-slate-500'}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-red-700">以下内容解析失败：</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {importErrors.map((error) => (
                      <div key={`${error.index}-${error.preview}`} className="text-sm text-red-600">
                        第 {error.index} 段：{error.message}
                        <div className="text-xs text-red-500 mt-1 break-all">{error.preview || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeImportModal} className="btn-ios-secondary">
                  取消
                </button>
                <button type="button" onClick={handleImport} disabled={importing} className="btn-ios-primary min-w-[120px]">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  开始导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {csvImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">CSV 导入</h3>
                <p className="text-sm text-slate-500 mt-1">CSV 里填写资源名称、网盘类型和资源链接；如果存在重复卡密会直接更新链接。</p>
              </div>
              <button onClick={closeCsvImportModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                导入前请确保 CSV 中引用的资源名称已经在资源管理里创建完成。
              </div>

              <div>
                <label className="input-label mb-1">选择 CSV 文件</label>
                <input
                  key={csvInputKey}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvImportFile(e.target.files?.[0] || null)}
                  className="input-ios file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100"
                />
              </div>

              {csvImportErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-red-700">以下内容导入失败：</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {csvImportErrors.map((error) => (
                      <div key={`${error.index}-${error.preview}`} className="text-sm text-red-600">
                        第 {error.index} 行：{error.message}
                        <div className="text-xs text-red-500 mt-1 break-all">{error.preview || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeCsvImportModal} className="btn-ios-secondary">
                  取消
                </button>
                <button type="button" onClick={handleCsvImport} disabled={csvImporting} className="btn-ios-primary min-w-[120px]">
                  {csvImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  开始导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
