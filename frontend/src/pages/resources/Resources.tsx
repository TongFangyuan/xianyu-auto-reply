import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  Edit2,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { getAccounts } from '@/api/accounts'
import {
  createResource,
  deleteResource,
  exportResourcesCopywriting,
  exportResourcesDocument,
  getResourceItemAssociations,
  getResources,
  updateResource,
  updateResourceItemAssociations,
  type ResourceAssociationItem,
  type ResourceData,
} from '@/api/resources'
import { getUserSetting, updateUserSetting } from '@/api/settings'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import type { Account } from '@/types'
import { formatServerDateTime } from '@/utils/datetime'

type ModalType = 'add' | 'edit' | null
type ResourceUpdateMode = '' | 'daily' | 'weekly' | 'interval'
type ResourceCopyExportRange = 'all' | 'since_last' | 'duration'
type ResourceCopyDurationUnit = 'minutes' | 'hours' | 'days'

type ResourceFormData = {
  resource_name: string
  resource_type: string
  recommend_level: string
  update_mode: ResourceUpdateMode
  update_weekdays: number[]
  daily_episode_count: string
  interval_days: string
  latest_episode: string
  is_completed: boolean
  remark: string
}

const resourceTypeSuggestions = ['电视剧', '动漫', '短剧', '电影', '综艺']

const recommendLevelOptions = [
  { value: '0', label: '未评分' },
  { value: '5', label: '🌟🌟🌟🌟🌟' },
  { value: '4', label: '🌟🌟🌟🌟' },
  { value: '3', label: '🌟🌟🌟' },
  { value: '2', label: '🌟🌟' },
  { value: '1', label: '🌟' },
]

const updateModeOptions = [
  { value: '', label: '未设置' },
  { value: 'weekly', label: '周更' },
  { value: 'daily', label: '日更' },
  { value: 'interval', label: '固定几天更新' },
]

const weekdayOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

const associationStatusOptions = [
  { value: 'all', label: '显示全部商品' },
  { value: 'linked', label: '仅看已关联商品' },
  { value: 'unlinked', label: '仅看未关联商品' },
]

const resourceCopyExportOptions = [
  { value: 'since_last', label: '上次导出该文案至当前时间' },
  { value: 'duration', label: '自定义时间范围' },
  { value: 'all', label: '全部资源' },
]

const resourceCopyDurationUnitOptions = [
  { value: 'minutes', label: '分钟' },
  { value: 'hours', label: '小时' },
  { value: 'days', label: '天' },
]

const resourceCopyDurationPresets: Array<{
  label: string
  value: string
  unit: ResourceCopyDurationUnit
}> = [
  { label: '近10分钟', value: '10', unit: 'minutes' },
  { label: '近30分钟', value: '30', unit: 'minutes' },
  { label: '近1小时', value: '1', unit: 'hours' },
  { label: '近1天', value: '1', unit: 'days' },
]

const DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL = 'https://www.kdocs.cn/l/ckxE5KFSxNov'
const RESOURCE_COPYWRITING_FOOTER_URL_SETTING_KEY = 'resources_copywriting_footer_url'
const DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL = 'https://i.cetsteam.com/imgs/2026/04/03/e19ab387d2f87791.jpeg'
const RESOURCE_DOCUMENT_HEADER_IMAGE_URL_SETTING_KEY = 'resources_document_header_image_url'
const IMAGE_BED_MANAGE_URL = 'https://img.cetsteam.com/vip/manage/mypic'

const initialFormData: ResourceFormData = {
  resource_name: '',
  resource_type: '',
  recommend_level: '0',
  update_mode: '',
  update_weekdays: [],
  daily_episode_count: '',
  interval_days: '',
  latest_episode: '',
  is_completed: false,
  remark: '',
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

const formatExportFileTimestamp = (date: Date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}`
}

const getDurationUnitLabel = (unit: ResourceCopyDurationUnit) => (
  resourceCopyDurationUnitOptions.find((option) => option.value === unit)?.label || unit
)

const formatWeekdayShortLabels = (weekdays: number[]) =>
  weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((weekday) => weekdayOptions.find((option) => option.value === weekday)?.label.replace('周', '') || String(weekday))
    .join('、')

const buildResourceUpdateSummary = (resource: Partial<ResourceData>) => {
  const updateMode = (resource.update_mode || '') as ResourceUpdateMode
  const weekdays = resource.update_weekdays || []
  const latestEpisode = Number(resource.latest_episode || 0)
  const lines: string[] = []

  if (updateMode === 'weekly' && weekdays.length > 0) {
    lines.push(`每周${formatWeekdayShortLabels(weekdays)}更1集`)
  } else if (updateMode === 'daily') {
    lines.push(`日更${resource.daily_episode_count || 0}集`)
  } else if (updateMode === 'interval' && Number(resource.interval_days || 0) > 0) {
    lines.push(`每${resource.interval_days}天更1集`)
  } else {
    lines.push('更新频率未设置')
  }

  if (latestEpisode > 0) {
    lines.push(`更至${latestEpisode}集`)
  }

  if (resource.is_completed) {
    lines.push('已完结')
  }

  if (resource.remark) {
    lines.push(String(resource.remark))
  }

  return lines
}

const mapResourceToFormData = (resource: ResourceData): ResourceFormData => ({
  resource_name: resource.resource_name,
  resource_type: resource.resource_type || '',
  recommend_level: String(resource.recommend_level ?? 0),
  update_mode: (resource.update_mode || '') as ResourceUpdateMode,
  update_weekdays: (resource.update_weekdays || [])
    .map((weekday) => Number(weekday))
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 1 && weekday <= 7),
  daily_episode_count: resource.daily_episode_count ? String(resource.daily_episode_count) : '',
  interval_days: resource.interval_days ? String(resource.interval_days) : '',
  latest_episode: resource.latest_episode ? String(resource.latest_episode) : '',
  is_completed: Boolean(resource.is_completed),
  remark: resource.remark || '',
})

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

function ResourceMetadataFields({
  value,
  onChange,
}: {
  value: ResourceFormData
  onChange: (updater: (prev: ResourceFormData) => ResourceFormData) => void
}) {
  const toggleWeekday = (weekday: number) => {
    onChange((prev) => {
      const nextWeekdays = prev.update_weekdays.includes(weekday)
        ? prev.update_weekdays.filter((item) => item !== weekday)
        : [...prev.update_weekdays, weekday].sort((a, b) => a - b)
      return {
        ...prev,
        update_weekdays: nextWeekdays,
      }
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="input-label mb-1">推荐星级</label>
          <Select
            value={value.recommend_level}
            onChange={(nextValue) => onChange((prev) => ({ ...prev, recommend_level: nextValue || '0' }))}
            options={recommendLevelOptions}
            placeholder="选择推荐星级"
          />
        </div>
        <div>
          <label className="input-label mb-1">更新频率</label>
          <Select
            value={value.update_mode}
            onChange={(nextValue) => onChange((prev) => ({
              ...prev,
              update_mode: (nextValue || '') as ResourceUpdateMode,
              update_weekdays: nextValue === 'weekly' ? prev.update_weekdays : [],
              daily_episode_count: nextValue === 'daily' ? prev.daily_episode_count : '',
              interval_days: nextValue === 'interval' ? prev.interval_days : '',
            }))}
            options={updateModeOptions}
            placeholder="选择更新频率"
          />
        </div>
      </div>

      {value.update_mode === 'weekly' && (
        <div>
          <label className="input-label mb-2">每周几更新</label>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((weekday) => {
              const selected = value.update_weekdays.includes(weekday.value)
              return (
                <button
                  key={weekday.value}
                  type="button"
                  onClick={() => toggleWeekday(weekday.value)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {weekday.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {value.update_mode === 'daily' && (
        <div>
          <label className="input-label mb-1">每天更新几集</label>
          <div className="flex items-center gap-3">
            <input
              value={value.daily_episode_count}
              onChange={(e) => onChange((prev) => ({ ...prev, daily_episode_count: e.target.value.replace(/[^\d]/g, '') }))}
              placeholder="例如：1"
              className="input-ios max-w-[200px]"
              inputMode="numeric"
            />
            <span className="text-sm text-slate-500">集/天</span>
          </div>
        </div>
      )}

      {value.update_mode === 'interval' && (
        <div>
          <label className="input-label mb-1">每隔几天更新</label>
          <div className="flex items-center gap-3">
            <input
              value={value.interval_days}
              onChange={(e) => onChange((prev) => ({ ...prev, interval_days: e.target.value.replace(/[^\d]/g, '') }))}
              placeholder="例如：3"
              className="input-ios max-w-[200px]"
              inputMode="numeric"
            />
            <span className="text-sm text-slate-500">天</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="input-label mb-1">更新到第几集</label>
          <div className="flex items-center gap-3">
            <input
              value={value.latest_episode}
              onChange={(e) => onChange((prev) => ({ ...prev, latest_episode: e.target.value.replace(/[^\d]/g, '') }))}
              placeholder="例如：24"
              className="input-ios"
              inputMode="numeric"
            />
            <span className="text-sm text-slate-500 whitespace-nowrap">集</span>
          </div>
        </div>
        <div>
          <label className="input-label mb-1">是否完结</label>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, is_completed: !prev.is_completed }))}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm transition-colors ${
              value.is_completed
                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300'
            }`}
          >
            {value.is_completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {value.is_completed ? '已完结' : '未完结'}
          </button>
        </div>
      </div>

      <div>
        <label className="input-label mb-1">备注</label>
        <textarea
          value={value.remark}
          onChange={(e) => onChange((prev) => ({ ...prev, remark: e.target.value }))}
          rows={3}
          placeholder="可记录更新时间说明、推荐原因、补档备注等。"
          className="input-ios min-h-[96px] resize-y"
        />
      </div>
    </div>
  )
}

export function Resources() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [resources, setResources] = useState<ResourceData[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [queryKeyword, setQueryKeyword] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<ResourceFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [exportingDocument, setExportingDocument] = useState(false)
  const [exportDocumentModalOpen, setExportDocumentModalOpen] = useState(false)
  const [selectedExportDocumentTypes, setSelectedExportDocumentTypes] = useState<string[]>([])
  const [exportCopyModalOpen, setExportCopyModalOpen] = useState(false)
  const [exportCopyRange, setExportCopyRange] = useState<ResourceCopyExportRange>('since_last')
  const [exportCopyDurationValue, setExportCopyDurationValue] = useState('10')
  const [exportCopyDurationUnit, setExportCopyDurationUnit] = useState<ResourceCopyDurationUnit>('minutes')
  const [exportingCopywriting, setExportingCopywriting] = useState(false)
  const [copywritingLastExportAt, setCopywritingLastExportAt] = useState('')
  const [loadingCopywritingLastExportAt, setLoadingCopywritingLastExportAt] = useState(false)
  const [copywritingFooterUrl, setCopywritingFooterUrl] = useState(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
  const [copywritingFooterUrlDraft, setCopywritingFooterUrlDraft] = useState(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
  const [loadingCopywritingFooterUrl, setLoadingCopywritingFooterUrl] = useState(false)
  const [savingCopywritingFooterUrl, setSavingCopywritingFooterUrl] = useState(false)
  const [documentHeaderImageUrl, setDocumentHeaderImageUrl] = useState(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
  const [documentHeaderImageUrlDraft, setDocumentHeaderImageUrlDraft] = useState(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
  const [loadingDocumentHeaderImageUrl, setLoadingDocumentHeaderImageUrl] = useState(false)
  const [savingDocumentHeaderImageUrl, setSavingDocumentHeaderImageUrl] = useState(false)
  const [associationModalOpen, setAssociationModalOpen] = useState(false)
  const [associationLoading, setAssociationLoading] = useState(false)
  const [associationSaving, setAssociationSaving] = useState(false)
  const [associationResource, setAssociationResource] = useState<ResourceData | null>(null)
  const [associationItems, setAssociationItems] = useState<ResourceAssociationItem[]>([])
  const [selectedAssociationItemId, setSelectedAssociationItemId] = useState<number | null>(null)
  const [associationSearch, setAssociationSearch] = useState('')
  const [associationAccountFilter, setAssociationAccountFilter] = useState('')
  const [associationStatusFilter, setAssociationStatusFilter] = useState('all')

  const allResourceTypes = useMemo(() => {
    return Array.from(new Set([
      ...resourceTypeSuggestions,
      ...resources
      .map((resource) => resource.resource_type?.trim())
      .filter(Boolean) as string[],
    ]))
  }, [resources])

  const resourceTypeOptions = useMemo(() => {
    const options = Array.from(new Set([
      ...allResourceTypes,
      ...(resourceTypeFilter ? [resourceTypeFilter] : []),
    ]))
    return [{ value: '', label: '全部资源类型' }, ...options.map((item) => ({ value: item, label: item }))]
  }, [allResourceTypes, resourceTypeFilter])

  const resourceTypeInputOptions = useMemo(() => {
    return Array.from(new Set([
      ...allResourceTypes,
      ...(formData.resource_type.trim() ? [formData.resource_type.trim()] : []),
    ]))
  }, [allResourceTypes, formData.resource_type])

  const exportDocumentTypeOptions = useMemo(() => {
    return Array.from(new Set(
      resources
        .map((resource) => resource.resource_type?.trim())
        .filter(Boolean) as string[]
    ))
  }, [resources])

  const loadResources = async (
    keyword = queryKeyword,
    resourceType = resourceTypeFilter
  ) => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getResources({
        keyword: keyword || undefined,
        resource_type: resourceType || undefined,
      })
      if (result.success) {
        setResources(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载资源失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    getAccounts()
      .then(setAccounts)
      .catch(() => {
        // ignore
      })
  }, [_hasHydrated, isAuthenticated, token])

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadResources()
  }, [_hasHydrated, isAuthenticated, token, queryKeyword, resourceTypeFilter])

  const loadCopywritingFooterUrl = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoadingCopywritingFooterUrl(true)
      const result = await getUserSetting(RESOURCE_COPYWRITING_FOOTER_URL_SETTING_KEY)
      const nextValue = result.success && (result.value || '').trim()
        ? (result.value || '').trim()
        : DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL
      setCopywritingFooterUrl(nextValue)
      setCopywritingFooterUrlDraft(nextValue)
    } catch {
      setCopywritingFooterUrl(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
      setCopywritingFooterUrlDraft(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
    } finally {
      setLoadingCopywritingFooterUrl(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadCopywritingFooterUrl()
  }, [_hasHydrated, isAuthenticated, token])

  const loadDocumentHeaderImageUrl = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoadingDocumentHeaderImageUrl(true)
      const result = await getUserSetting(RESOURCE_DOCUMENT_HEADER_IMAGE_URL_SETTING_KEY)
      const nextValue = result.success && (result.value || '').trim()
        ? (result.value || '').trim()
        : DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL
      setDocumentHeaderImageUrl(nextValue)
      setDocumentHeaderImageUrlDraft(nextValue)
    } catch {
      setDocumentHeaderImageUrl(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
      setDocumentHeaderImageUrlDraft(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
    } finally {
      setLoadingDocumentHeaderImageUrl(false)
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadDocumentHeaderImageUrl()
  }, [_hasHydrated, isAuthenticated, token])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setQueryKeyword(searchInput.trim())
  }

  const openAddModal = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setSubmitting(false)
    setActiveModal('add')
  }

  const openEditModal = (resource: ResourceData) => {
    setEditingId(resource.id ?? null)
    setFormData(mapResourceToFormData(resource))
    setSubmitting(false)
    setActiveModal('edit')
  }

  const closeModal = () => {
    setActiveModal(null)
    setEditingId(null)
    setFormData(initialFormData)
    setSubmitting(false)
  }

  const buildPayload = (value: ResourceFormData) => ({
    resource_name: value.resource_name.trim(),
    resource_type: value.resource_type.trim(),
    recommend_level: Number(value.recommend_level || 0),
    update_mode: value.update_mode,
    update_weekdays: value.update_weekdays,
    daily_episode_count: Number(value.daily_episode_count || 0),
    interval_days: Number(value.interval_days || 0),
    latest_episode: Number(value.latest_episode || 0),
    is_completed: value.is_completed,
    remark: value.remark.trim(),
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.resource_name.trim()) {
      addToast({ type: 'warning', message: '请输入资源名称' })
      return
    }
    if (!formData.resource_type.trim()) {
      addToast({ type: 'warning', message: '请输入资源类型' })
      return
    }
    if (formData.update_mode === 'weekly' && formData.update_weekdays.length === 0) {
      addToast({ type: 'warning', message: '请选择每周几更新' })
      return
    }
    if (formData.update_mode === 'daily' && !formData.daily_episode_count) {
      addToast({ type: 'warning', message: '请填写每天更新几集' })
      return
    }
    if (formData.update_mode === 'interval' && !formData.interval_days) {
      addToast({ type: 'warning', message: '请填写每隔几天更新' })
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload(formData)
      if (editingId) {
        await updateResource(String(editingId), payload)
        addToast({ type: 'success', message: '资源已更新' })
      } else {
        await createResource(payload)
        addToast({ type: 'success', message: '资源已新增' })
      }
      closeModal()
      loadResources()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存失败') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (resource: ResourceData) => {
    const associationCount = resource.association_count || 0
    const message = associationCount > 0
      ? `确定要删除资源「${resource.resource_name}」吗？\n\n删除后会同步解除 ${associationCount} 个商品关联，并删除该资源下的全部卡密链接。`
      : `确定要删除资源「${resource.resource_name}」吗？\n\n删除后会同步删除该资源下的全部卡密链接。`

    if (!confirm(message)) return

    try {
      await deleteResource(String(resource.id))
      addToast({ type: 'success', message: '资源已删除' })
      loadResources()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '删除失败') })
    }
  }

  const openExportDocumentModal = () => {
    setSelectedExportDocumentTypes(exportDocumentTypeOptions)
    setExportDocumentModalOpen(true)
  }

  const closeExportDocumentModal = () => {
    setExportDocumentModalOpen(false)
  }

  const toggleExportDocumentType = (resourceType: string) => {
    setSelectedExportDocumentTypes((prev) => (
      prev.includes(resourceType)
        ? prev.filter((item) => item !== resourceType)
        : [...prev, resourceType]
    ))
  }

  const handleExportDocument = async () => {
    const normalizedSelectedTypes = Array.from(new Set(
      selectedExportDocumentTypes
        .map((resourceType) => resourceType.trim())
        .filter(Boolean)
    ))
    const isExportingAllTypes = (
      exportDocumentTypeOptions.length === 0
      || normalizedSelectedTypes.length === exportDocumentTypeOptions.length
    )

    if (!isExportingAllTypes && normalizedSelectedTypes.length === 0) {
      addToast({ type: 'warning', message: '请至少选择一种资源类型' })
      return
    }

    try {
      setExportingDocument(true)
      const blob = await exportResourcesDocument({
        resource_types: isExportingAllTypes ? undefined : normalizedSelectedTypes,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `资源文档_${formatExportFileTimestamp()}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      closeExportDocumentModal()
      addToast({ type: 'success', message: '资源文档已开始下载' })
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '导出文档失败') })
    } finally {
      setExportingDocument(false)
    }
  }

  const openExportCopyModal = async () => {
    setExportCopyRange('since_last')
    setExportCopyDurationValue('10')
    setExportCopyDurationUnit('minutes')
    setCopywritingLastExportAt('')
    setExportCopyModalOpen(true)
    setLoadingCopywritingLastExportAt(true)

    try {
      const result = await getUserSetting('resources_copywriting_last_exported_at')
      setCopywritingLastExportAt(result.success ? (result.value || '') : '')
    } catch {
      setCopywritingLastExportAt('')
    } finally {
      setLoadingCopywritingLastExportAt(false)
    }
  }

  const closeExportCopyModal = () => {
    setExportCopyModalOpen(false)
    setExportingCopywriting(false)
  }

  const handleExportCopywriting = async () => {
    try {
      setExportingCopywriting(true)
      const durationValue = Number(exportCopyDurationValue || 0)

      if (exportCopyRange === 'duration' && (!Number.isInteger(durationValue) || durationValue <= 0)) {
        addToast({ type: 'warning', message: '请输入正确的时间范围' })
        return
      }

      const blob = await exportResourcesCopywriting({
        export_range: exportCopyRange,
        duration_value: exportCopyRange === 'duration' ? durationValue : undefined,
        duration_unit: exportCopyRange === 'duration' ? exportCopyDurationUnit : undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `资源导出文案_${formatExportFileTimestamp()}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      addToast({
        type: 'success',
        message: exportCopyRange === 'all' ? '资源文案已开始下载' : '更新文案已开始下载',
      })
      closeExportCopyModal()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '导出文案失败') })
    } finally {
      setExportingCopywriting(false)
    }
  }

  const handleSaveCopywritingFooterUrl = async () => {
    const normalizedUrl = copywritingFooterUrlDraft.trim() || DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL

    try {
      const parsed = new URL(normalizedUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported')
      }
    } catch {
      addToast({ type: 'warning', message: '请输入正确的链接地址' })
      return
    }

    try {
      setSavingCopywritingFooterUrl(true)
      const result = await updateUserSetting(
        RESOURCE_COPYWRITING_FOOTER_URL_SETTING_KEY,
        normalizedUrl,
        '资源导出文案末尾群公告链接'
      )
      if (!result.success) {
        addToast({ type: 'error', message: result.message || '保存链接失败' })
        return
      }
      setCopywritingFooterUrl(normalizedUrl)
      setCopywritingFooterUrlDraft(normalizedUrl)
      addToast({ type: 'success', message: '导出尾部链接已保存' })
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存链接失败') })
    } finally {
      setSavingCopywritingFooterUrl(false)
    }
  }

  const handleSaveDocumentHeaderImageUrl = async () => {
    const normalizedUrl = documentHeaderImageUrlDraft.trim() || DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL

    try {
      const parsed = new URL(normalizedUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('unsupported')
      }
    } catch {
      addToast({ type: 'warning', message: '请输入正确的图片链接地址' })
      return
    }

    try {
      setSavingDocumentHeaderImageUrl(true)
      const result = await updateUserSetting(
        RESOURCE_DOCUMENT_HEADER_IMAGE_URL_SETTING_KEY,
        normalizedUrl,
        '资源导出文档顶部引导图片链接'
      )
      if (!result.success) {
        addToast({ type: 'error', message: result.message || '保存图片链接失败' })
        return
      }
      setDocumentHeaderImageUrl(normalizedUrl)
      setDocumentHeaderImageUrlDraft(normalizedUrl)
      addToast({ type: 'success', message: '导出文档头图链接已保存' })
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存图片链接失败') })
    } finally {
      setSavingDocumentHeaderImageUrl(false)
    }
  }

  const closeAssociationModal = () => {
    setAssociationModalOpen(false)
    setAssociationLoading(false)
    setAssociationSaving(false)
    setAssociationResource(null)
    setAssociationItems([])
    setSelectedAssociationItemId(null)
    setAssociationSearch('')
    setAssociationAccountFilter('')
    setAssociationStatusFilter('all')
  }

  const openAssociationModal = async (resource: ResourceData) => {
    if (!resource.id) return
    setAssociationModalOpen(true)
    setAssociationLoading(true)
    setAssociationSaving(false)
    setAssociationSearch('')
    setAssociationAccountFilter('')
    setAssociationStatusFilter('all')

    try {
      const result = await getResourceItemAssociations(String(resource.id))
      setAssociationResource(result.resource)
      setAssociationItems(result.items)
      setSelectedAssociationItemId(result.items.find((item) => item.association_status === 'current')?.id ?? null)
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '加载关联商品失败') })
      closeAssociationModal()
    } finally {
      setAssociationLoading(false)
    }
  }

  const toggleAssociationItem = (itemId: number) => {
    setSelectedAssociationItemId((prev) => (prev === itemId ? null : itemId))
  }

  const filteredAssociationItems = associationItems.filter((item) => {
    const matchesAccount = !associationAccountFilter || item.cookie_id === associationAccountFilter
    const matchesKeyword = !associationSearch.trim()
      || item.display_title.toLowerCase().includes(associationSearch.trim().toLowerCase())
      || item.item_id.toLowerCase().includes(associationSearch.trim().toLowerCase())
    const matchesStatus = associationStatusFilter === 'all'
      || (associationStatusFilter === 'linked' && item.association_status !== 'none')
      || (associationStatusFilter === 'unlinked' && item.association_status === 'none')
    return matchesAccount && matchesKeyword && matchesStatus
  })

  const currentAssociationItem = associationItems.find((item) => item.association_status === 'current') || null
  const selectedAssociationItem = associationItems.find((item) => item.id === selectedAssociationItemId) || null
  const addedAssociationCount = selectedAssociationItem?.association_status === 'none' ? 1 : 0
  const replacedAssociationCount = selectedAssociationItem?.association_status === 'other' ? 1 : 0
  const removedAssociationCount = currentAssociationItem && currentAssociationItem.id !== selectedAssociationItemId ? 1 : 0

  const handleSaveAssociations = async () => {
    if (!associationResource?.id) return

    if (
      replacedAssociationCount > 0 &&
      !confirm(`本次会替换 ${replacedAssociationCount} 个商品当前已关联的资源，确定继续吗？`)
    ) {
      return
    }

    setAssociationSaving(true)
    try {
      const result = await updateResourceItemAssociations(
        String(associationResource.id),
        selectedAssociationItemId ? [selectedAssociationItemId] : []
      )
      addToast({ type: 'success', message: result.message || '关联已更新' })
      closeAssociationModal()
      loadResources()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存关联失败') })
    } finally {
      setAssociationSaving(false)
    }
  }

  const linkedResourceCount = resources.filter((resource) => (resource.association_count || 0) > 0).length
  const completedResourceCount = resources.filter((resource) => resource.is_completed).length
  const hasCopywritingFooterUrlChanges = copywritingFooterUrlDraft.trim() !== copywritingFooterUrl
  const hasDocumentHeaderImageUrlChanges = documentHeaderImageUrlDraft.trim() !== documentHeaderImageUrl
  const selectedExportDocumentTypeCount = selectedExportDocumentTypes.length
  const isAllExportDocumentTypesSelected = (
    exportDocumentTypeOptions.length === 0
    || selectedExportDocumentTypeCount === exportDocumentTypeOptions.length
  )

  if (loading && resources.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">资源管理</h1>
          <p className="page-description">管理资源名称、资源类型、推荐星级和追更信息，商品关联也在这里维护。卡密链接请到卡密管理中维护。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openExportCopyModal} disabled={exportingCopywriting} className="btn-ios-secondary">
            {exportingCopywriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            导出文案
          </button>
          <button onClick={openExportDocumentModal} disabled={exportingDocument} className="btn-ios-secondary">
            {exportingDocument ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            导出文档
          </button>
          <button onClick={openAddModal} className="btn-ios-primary">
            <Plus className="w-4 h-4" />
            新增资源
          </button>
          <button onClick={() => loadResources()} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-blue-600">{resources.length}</div>
          <div className="text-sm text-slate-500">当前资源数</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-cyan-600">{linkedResourceCount}</div>
          <div className="text-sm text-slate-500">已关联商品</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-emerald-600">{completedResourceCount}</div>
          <div className="text-sm text-slate-500">已完结资源</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="vben-card"
      >
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <Link2 className="w-4 h-4" />
            导出配置
          </h2>
        </div>
        <div className="vben-card-body space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-9">
              <label className="input-label mb-1">导出文案末尾链接</label>
              <input
                value={copywritingFooterUrlDraft}
                onChange={(e) => setCopywritingFooterUrlDraft(e.target.value)}
                placeholder={DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL}
                className="input-ios"
                disabled={loadingCopywritingFooterUrl || savingCopywritingFooterUrl}
              />
              <p className="mt-2 text-sm text-slate-500">
                导出文案末尾会固定追加群公告文案和这里配置的链接；未自定义时默认使用当前 KDocs 链接。
              </p>
              <a
                href={copywritingFooterUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full text-sm text-blue-600 hover:text-blue-700 break-all"
              >
                当前生效链接：{copywritingFooterUrl}
              </a>
            </div>
            <div className="lg:col-span-3 flex items-end gap-3">
              <button
                type="button"
                onClick={() => setCopywritingFooterUrlDraft(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)}
                className="btn-ios-secondary"
                disabled={savingCopywritingFooterUrl}
              >
                恢复默认
              </button>
              <button
                type="button"
                onClick={handleSaveCopywritingFooterUrl}
                className="btn-ios-primary flex-1"
                disabled={loadingCopywritingFooterUrl || savingCopywritingFooterUrl || !hasCopywritingFooterUrlChanges}
              >
                {savingCopywritingFooterUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                保存链接
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 border-t border-slate-200 pt-5">
            <div className="lg:col-span-9">
              <label className="input-label mb-1">导出文档顶部图片链接</label>
              <input
                value={documentHeaderImageUrlDraft}
                onChange={(e) => setDocumentHeaderImageUrlDraft(e.target.value)}
                placeholder={DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL}
                className="input-ios"
                disabled={loadingDocumentHeaderImageUrl || savingDocumentHeaderImageUrl}
              />
              <p className="mt-2 text-sm text-slate-500">
                导出文档顶部会固定插入引导图片、追剧提示文案和分隔线；这里只配置图片地址，未自定义时使用默认图片。
              </p>
              <a
                href={documentHeaderImageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex max-w-full text-sm text-blue-600 hover:text-blue-700 break-all"
              >
                当前生效图片：{documentHeaderImageUrl}
              </a>
            </div>
            <div className="lg:col-span-3 flex items-end gap-3">
              <a
                href={IMAGE_BED_MANAGE_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-ios-secondary"
              >
                图床网站
              </a>
              <button
                type="button"
                onClick={() => setDocumentHeaderImageUrlDraft(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)}
                className="btn-ios-secondary"
                disabled={savingDocumentHeaderImageUrl}
              >
                恢复默认
              </button>
              <button
                type="button"
                onClick={handleSaveDocumentHeaderImageUrl}
                className="btn-ios-primary flex-1"
                disabled={loadingDocumentHeaderImageUrl || savingDocumentHeaderImageUrl || !hasDocumentHeaderImageUrlChanges}
              >
                {savingDocumentHeaderImageUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                保存图片
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="vben-card"
      >
        <div className="vben-card-header">
          <h2 className="vben-card-title">
            <FolderKanban className="w-4 h-4" />
            资源列表
          </h2>
        </div>
        <div className="vben-card-body space-y-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-6">
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
            <div className="lg:col-span-4">
              <label className="input-label mb-1">资源类型</label>
              <Select
                value={resourceTypeFilter}
                onChange={setResourceTypeFilter}
                options={resourceTypeOptions}
                placeholder="全部资源类型"
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
                  <th>推荐星级</th>
                  <th>更新信息</th>
                  <th>备注</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {resources.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <FolderKanban className="w-12 h-12 text-slate-300" />
                        <p>暂无资源</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  resources.map((resource) => (
                    <tr key={resource.id}>
                      <td className="min-w-[220px]">
                        <div className="font-medium text-slate-900">{resource.resource_name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          已关联 {resource.association_count || 0} 个商品
                        </div>
                      </td>
                      <td>
                        <span className="badge-gray">{resource.resource_type || '-'}</span>
                      </td>
                      <td className="min-w-[120px]">
                        {Number(resource.recommend_level || 0) > 0 ? (
                          <div className="text-amber-500 text-sm tracking-[0.15em]">
                            {'🌟'.repeat(Number(resource.recommend_level || 0))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">未评分</span>
                        )}
                      </td>
                      <td className="min-w-[220px]">
                        <div className="space-y-1">
                          {buildResourceUpdateSummary(resource).map((line, index) => (
                            <div
                              key={`${resource.id}-update-${index}`}
                              className={index === 0 ? 'text-sm font-medium text-slate-700' : 'text-xs text-slate-500'}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-[260px]">
                        <div className="truncate text-sm text-slate-500" title={resource.remark || '-'}>
                          {resource.remark || '-'}
                        </div>
                      </td>
                      <td className="text-sm text-slate-500 whitespace-nowrap">
                        {formatServerDateTime(resource.updated_at || resource.created_at)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAssociationModal(resource)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="关联商品"
                          >
                            <Link2 className="w-4 h-4 text-violet-500" />
                          </button>
                          <button
                            onClick={() => openEditModal(resource)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => resource.id && handleDelete(resource)}
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

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {activeModal === 'add' ? '新增资源' : '编辑资源'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">资源元数据和追更信息在这里维护，卡密链接请到卡密管理中录入。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-88px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="input-label mb-1">资源名称</label>
                  <input
                    value={formData.resource_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, resource_name: e.target.value }))}
                    placeholder="例如：真相捕捉3"
                    className="input-ios"
                  />
                </div>

                <div>
                  <label className="input-label mb-1">资源类型</label>
                  <SuggestionInput
                    value={formData.resource_type}
                    onChange={(value) => setFormData((prev) => ({ ...prev, resource_type: value }))}
                    options={resourceTypeInputOptions}
                    placeholder="例如：电视剧"
                    listId="resource-type-form-options"
                  />
                </div>
              </div>

              <ResourceMetadataFields
                value={formData}
                onChange={(updater) => setFormData((prev) => updater(prev))}
              />

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-ios-secondary">
                  取消
                </button>
                <button type="submit" disabled={submitting} className="btn-ios-primary min-w-[120px]">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {activeModal === 'add' ? '保存资源' : '更新资源'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {associationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">关联商品</h3>
                <p className="text-sm text-slate-500 mt-1">为当前资源选择 1 个要绑定的商品。</p>
              </div>
              <button onClick={closeAssociationModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {associationLoading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : associationResource ? (
              <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-88px)]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="vben-card p-4 lg:col-span-2">
                    <div className="space-y-2">
                      <div className="text-sm text-slate-500">当前资源</div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {associationResource.resource_name}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge-gray">
                          {associationResource.resource_type || '未分类'}
                        </span>
                        {Number(associationResource.recommend_level || 0) > 0 && (
                          <span className="text-sm text-amber-500">
                            {'🌟'.repeat(Number(associationResource.recommend_level || 0))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="vben-card p-4">
                    <div className="text-sm text-slate-500">当前已关联</div>
                    <div className="text-2xl font-bold text-blue-600 mt-1">
                      {currentAssociationItem ? 1 : 0}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">资源最多绑定 1 个商品</div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>每个资源只能关联 1 个商品；如果本次选择的商品已绑定其他资源，保存时会自动替换为当前资源。</p>
                </div>

                <div className="vben-card">
                  <div className="vben-card-body space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                      <div className="lg:col-span-4">
                        <label className="input-label mb-1">搜索商品</label>
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            value={associationSearch}
                            onChange={(e) => setAssociationSearch(e.target.value)}
                            placeholder="搜索商品标题或商品ID"
                            className="input-ios pl-9"
                          />
                        </div>
                      </div>
                      <div className="lg:col-span-3">
                        <label className="input-label mb-1">账号筛选</label>
                        <Select
                          value={associationAccountFilter}
                          onChange={setAssociationAccountFilter}
                          options={[
                            { value: '', label: '全部账号' },
                            ...accounts.map((account) => ({
                              value: account.id,
                              label: account.id,
                            })),
                          ]}
                          placeholder="全部账号"
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <label className="input-label mb-1">关联状态</label>
                        <Select
                          value={associationStatusFilter}
                          onChange={setAssociationStatusFilter}
                          options={associationStatusOptions}
                          placeholder="显示全部商品"
                        />
                      </div>
                      <div className="lg:col-span-2 flex items-end">
                        <div className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-center">
                          <div className="text-xs text-slate-500">筛选结果</div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{filteredAssociationItems.length}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                      <table className="table-ios min-w-[980px]">
                        <thead>
                          <tr>
                            <th className="w-12">选择</th>
                            <th>账号ID</th>
                            <th>商品ID</th>
                            <th>商品标题</th>
                            <th>当前关联状态</th>
                            <th>更新时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAssociationItems.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-10 text-slate-500">
                                <div className="flex flex-col items-center gap-2">
                                  <Package className="w-12 h-12 text-slate-300" />
                                  <p>暂无可选商品</p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredAssociationItems.map((item) => {
                              const isSelected = selectedAssociationItemId === item.id
                              const isReplacement = isSelected && item.association_status === 'other'
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => toggleAssociationItem(item.id)}
                                  className={`cursor-pointer ${
                                    isReplacement
                                      ? 'bg-amber-50 dark:bg-amber-900/10'
                                      : isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : ''
                                  }`}
                                >
                                  <td>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        toggleAssociationItem(item.id)
                                      }}
                                      className="p-1 rounded-md hover:bg-white/80"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-blue-500" />
                                      ) : (
                                        <Square className="w-5 h-5 text-slate-400" />
                                      )}
                                    </button>
                                  </td>
                                  <td>{item.cookie_id}</td>
                                  <td>{item.item_id}</td>
                                  <td className="min-w-[260px]">
                                    <div className="font-medium text-slate-700">{item.display_title}</div>
                                    {item.item_price ? (
                                      <div className="text-xs text-slate-500 mt-1">价格：{item.item_price}</div>
                                    ) : null}
                                  </td>
                                  <td className="min-w-[240px]">
                                    {item.association_status === 'none' ? (
                                      <span className="text-sm text-slate-400">未关联</span>
                                    ) : item.association_status === 'current' ? (
                                      <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                                        已关联当前资源
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                        已关联其他资源：{item.associated_resource_name || '未命名资源'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-sm text-slate-500 whitespace-nowrap">
                                    {formatServerDateTime(item.updated_at)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  本次将新增 {addedAssociationCount} 个，替换 {replacedAssociationCount} 个，解除 {removedAssociationCount} 个。
                </div>

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeAssociationModal} className="btn-ios-secondary">
                    取消
                  </button>
                  <button type="button" onClick={handleSaveAssociations} disabled={associationSaving} className="btn-ios-primary min-w-[160px]">
                    {associationSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    {replacedAssociationCount > 0 ? `保存并替换 ${replacedAssociationCount} 个` : '保存关联'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {exportDocumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">导出文档</h3>
                <p className="text-sm text-slate-500 mt-1">支持按资源类型多选导出，默认导出全部资源类型。</p>
              </div>
              <button onClick={closeExportDocumentModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="input-label">资源类型</label>
                  <button
                    type="button"
                    onClick={() => setSelectedExportDocumentTypes(exportDocumentTypeOptions)}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                    disabled={isAllExportDocumentTypesSelected}
                  >
                    全选
                  </button>
                </div>

                {exportDocumentTypeOptions.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    当前暂无可选资源类型，将按全部资源导出。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {exportDocumentTypeOptions.map((resourceType) => {
                      const selected = selectedExportDocumentTypes.includes(resourceType)
                      return (
                        <button
                          key={resourceType}
                          type="button"
                          onClick={() => toggleExportDocumentType(resourceType)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                            selected
                              ? 'border-blue-500 bg-blue-50 text-blue-600'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                          }`}
                        >
                          <span className="truncate text-base font-medium">{resourceType}</span>
                          {selected ? (
                            <CheckSquare className="w-5 h-5 flex-shrink-0 text-blue-500" />
                          ) : (
                            <Square className="w-5 h-5 flex-shrink-0 text-slate-400" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                {exportDocumentTypeOptions.length === 0 ? (
                  <p>本次将导出当前账号下全部已配置卡密链接的资源文档。</p>
                ) : isAllExportDocumentTypesSelected ? (
                  <p>本次将导出全部资源类型的资源文档。</p>
                ) : (
                  <p>本次将导出 {selectedExportDocumentTypeCount} 种资源类型的资源文档。</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeExportDocumentModal} className="btn-ios-secondary">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleExportDocument}
                  disabled={exportingDocument}
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

      {exportCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">导出文案</h3>
                <p className="text-sm text-slate-500 mt-1">导出纯文本资源文案，包含资源名称、备注、更至集数、完结状态和各网盘链接。</p>
              </div>
              <button onClick={closeExportCopyModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <label className="input-label">日期范围</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {resourceCopyExportOptions.map((option) => {
                    const selected = exportCopyRange === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setExportCopyRange(option.value as ResourceCopyExportRange)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-base font-medium">{option.label}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {option.value === 'since_last'
                            ? '导出上次导出文案之后有变化的资源，并在末尾追加群公告链接'
                            : option.value === 'duration'
                              ? '按最近一段时间筛选变化资源，支持分钟、小时、天，末尾同样追加群公告链接'
                            : '导出当前账号下全部已配置卡密链接的资源，并在末尾追加群公告链接'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {exportCopyRange === 'duration' && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <label className="input-label">快捷选择</label>
                    <div className="flex flex-wrap gap-2">
                      {resourceCopyDurationPresets.map((preset) => {
                        const selected = exportCopyDurationValue === preset.value && exportCopyDurationUnit === preset.unit
                        return (
                          <button
                            key={`${preset.value}-${preset.unit}`}
                            type="button"
                            onClick={() => {
                              setExportCopyDurationValue(preset.value)
                              setExportCopyDurationUnit(preset.unit)
                            }}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                              selected
                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                            }`}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="input-label mb-1">时间值</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={exportCopyDurationValue}
                        onChange={(e) => setExportCopyDurationValue(e.target.value)}
                        className="input-ios"
                        placeholder="例如 10"
                      />
                    </div>
                    <div>
                      <label className="input-label mb-1">时间单位</label>
                      <Select
                        value={exportCopyDurationUnit}
                        onChange={(value) => setExportCopyDurationUnit((value || 'minutes') as ResourceCopyDurationUnit)}
                        options={resourceCopyDurationUnitOptions}
                        placeholder="请选择时间单位"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                {exportCopyRange === 'since_last' ? (
                  <>
                    <p>
                      本次将导出：
                      {loadingCopywritingLastExportAt
                        ? ' 正在读取上次导出时间...'
                        : copywritingLastExportAt
                          ? ` ${copywritingLastExportAt} 至当前时间更新的资源文案`
                          : ' 首次使用将导出全部已配置卡密链接的资源，并记录本次导出时间'}
                    </p>
                    <p className="mt-1 text-slate-500">导出成功后，系统会自动把本次导出时间记为新的基线；导出文案末尾会统一追加群公告引导和 KDocs 链接。</p>
                  </>
                ) : exportCopyRange === 'duration' ? (
                  <>
                    <p>本次将导出：近 {exportCopyDurationValue || '0'} {getDurationUnitLabel(exportCopyDurationUnit)}内更新的资源文案。</p>
                    <p className="mt-1 text-slate-500">这种方式不会更新“上次导出该文案”的基线时间，适合临时补导最近 10 分钟、30 分钟、1 小时、1 天等区间；导出末尾同样会追加群公告引导和 KDocs 链接。</p>
                  </>
                ) : (
                  <>
                    <p>本次将导出当前账号下全部已配置卡密链接的资源文案。</p>
                    <p className="mt-1 text-slate-500">导出末尾会统一追加群公告引导和 KDocs 链接。</p>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeExportCopyModal} className="btn-ios-secondary">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleExportCopywriting}
                  disabled={exportingCopywriting || (exportCopyRange === 'since_last' && loadingCopywritingLastExportAt)}
                  className="btn-ios-primary min-w-[132px]"
                >
                  {exportingCopywriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  开始导出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
