import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckSquare,
  ChevronDown,
  Edit2,
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
  getResourceItemAssociations,
  getResources,
  updateResource,
  updateResourceItemAssociations,
  type ResourceAssociationItem,
  type ResourceData,
} from '@/api/resources'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import type { Account } from '@/types'

type ModalType = 'add' | 'edit' | null
type ResourceUpdateMode = '' | 'daily' | 'weekly' | 'interval'

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
  { value: '5', label: '5 星推荐' },
  { value: '4', label: '4 星推荐' },
  { value: '3', label: '3 星推荐' },
  { value: '2', label: '2 星推荐' },
  { value: '1', label: '1 星推荐' },
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

const formatWeekdayLabels = (weekdays: number[]) =>
  weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((weekday) => weekdayOptions.find((option) => option.value === weekday)?.label || `周${weekday}`)
    .join(' / ')

const buildResourceUpdateSummary = (resource: Partial<ResourceData>) => {
  const updateMode = (resource.update_mode || '') as ResourceUpdateMode
  const weekdays = resource.update_weekdays || []
  const latestEpisode = Number(resource.latest_episode || 0)
  const lines: string[] = []

  if (updateMode === 'weekly' && weekdays.length > 0) {
    lines.push(`周更 · ${formatWeekdayLabels(weekdays)}`)
  } else if (updateMode === 'daily') {
    lines.push(`日更 · 每天 ${resource.daily_episode_count || 0} 集`)
  } else if (updateMode === 'interval' && Number(resource.interval_days || 0) > 0) {
    lines.push(`固定更新 · 每 ${resource.interval_days} 天`)
  } else {
    lines.push('更新频率未设置')
  }

  if (latestEpisode > 0) {
    lines.push(`更新至 ${latestEpisode} 集`)
  }

  lines.push(resource.is_completed ? '已完结' : '连载中')

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
  update_weekdays: [...(resource.update_weekdays || [])],
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
            {value.is_completed ? '已完结' : '连载中'}
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
  const [associationModalOpen, setAssociationModalOpen] = useState(false)
  const [associationLoading, setAssociationLoading] = useState(false)
  const [associationSaving, setAssociationSaving] = useState(false)
  const [associationResource, setAssociationResource] = useState<ResourceData | null>(null)
  const [associationItems, setAssociationItems] = useState<ResourceAssociationItem[]>([])
  const [selectedAssociationItemId, setSelectedAssociationItemId] = useState<number | null>(null)
  const [associationSearch, setAssociationSearch] = useState('')
  const [associationAccountFilter, setAssociationAccountFilter] = useState('')
  const [associationStatusFilter, setAssociationStatusFilter] = useState('all')

  const resourceTypeOptions = useMemo(() => {
    const dynamicTypes = resources
      .map((resource) => resource.resource_type?.trim())
      .filter(Boolean) as string[]
    const options = Array.from(new Set([
      ...resourceTypeSuggestions,
      ...dynamicTypes,
      ...(resourceTypeFilter ? [resourceTypeFilter] : []),
    ]))
    return [{ value: '', label: '全部资源类型' }, ...options.map((item) => ({ value: item, label: item }))]
  }, [resourceTypeFilter, resources])

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
                          <div className="space-y-1">
                            <div className="text-amber-500 text-sm tracking-[0.2em]">
                              {'★'.repeat(Number(resource.recommend_level || 0))}
                            </div>
                            <div className="text-xs text-slate-500">{resource.recommend_level} 星推荐</div>
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
                      <td className="text-sm text-slate-500 whitespace-nowrap">{resource.updated_at || resource.created_at || '-'}</td>
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
                    options={resourceTypeSuggestions}
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
                            {'★'.repeat(Number(associationResource.recommend_level || 0))}
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
                                  <td className="text-sm text-slate-500 whitespace-nowrap">{item.updated_at || '-'}</td>
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
    </div>
  )
}
