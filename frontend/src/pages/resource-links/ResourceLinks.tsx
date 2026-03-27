import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckSquare, Copy, Download, Edit2, ExternalLink, Key, Link2, Loader2, Package, Plus, RefreshCw, Search, Square, Trash2, Upload, X } from 'lucide-react'
import { getAccounts } from '@/api/accounts'
import {
  createResourceLink,
  deleteResourceLink,
  downloadResourceLinksTemplate,
  getResourceLinks,
  getResourceLinkItemAssociations,
  importResourceLinks,
  importResourceLinksCsv,
  updateResourceLinkItemAssociations,
  updateResourceLink,
  type ResourceLinkData,
  type ResourceLinkAssociationItem,
  type ResourceLinkImportDuplicate,
  type ResourceLinkImportError,
} from '@/api/resourceLinks'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import type { Account } from '@/types'

type ModalType = 'add' | 'edit' | null

const driveTypeOptions = [
  { value: '', label: '全部网盘' },
  { value: 'quark', label: '夸克' },
  { value: 'baidu', label: '百度' },
]

const formDriveTypeOptions = driveTypeOptions.filter(option => option.value)

const driveTypeLabels: Record<string, string> = {
  quark: '夸克',
  baidu: '百度',
}

const driveTypeBadges: Record<string, string> = {
  quark: 'badge-primary',
  baidu: 'badge-warning',
}

const associationStatusOptions = [
  { value: 'all', label: '显示全部商品' },
  { value: 'linked', label: '仅看已关联商品' },
  { value: 'unlinked', label: '仅看未关联商品' },
]

const initialFormData = {
  resource_name: '',
  drive_type: '',
  resource_url: '',
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

export function ResourceLinks() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [resourceLinks, setResourceLinks] = useState<ResourceLinkData[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [queryKeyword, setQueryKeyword] = useState('')
  const [driveFilter, setDriveFilter] = useState('')
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [editingLink, setEditingLink] = useState<ResourceLinkData | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importResourceName, setImportResourceName] = useState('')
  const [importContent, setImportContent] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<ResourceLinkImportError[]>([])
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false)
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null)
  const [csvImportErrors, setCsvImportErrors] = useState<ResourceLinkImportError[]>([])
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvInputKey, setCsvInputKey] = useState(0)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [associationModalOpen, setAssociationModalOpen] = useState(false)
  const [associationLoading, setAssociationLoading] = useState(false)
  const [associationSaving, setAssociationSaving] = useState(false)
  const [associationResource, setAssociationResource] = useState<ResourceLinkData | null>(null)
  const [associationItems, setAssociationItems] = useState<ResourceLinkAssociationItem[]>([])
  const [selectedAssociationItemId, setSelectedAssociationItemId] = useState<number | null>(null)
  const [associationSearch, setAssociationSearch] = useState('')
  const [associationAccountFilter, setAssociationAccountFilter] = useState('')
  const [associationStatusFilter, setAssociationStatusFilter] = useState('all')

  const loadResourceLinks = async (keyword = queryKeyword, driveType = driveFilter) => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getResourceLinks({
        keyword: keyword || undefined,
        drive_type: driveType || undefined,
      })
      if (result.success) {
        setResourceLinks(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载卡密资源失败' })
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
    loadResourceLinks()
  }, [_hasHydrated, isAuthenticated, token, queryKeyword, driveFilter])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setQueryKeyword(searchInput.trim())
  }

  const openAddModal = () => {
    setEditingLink(null)
    setEditingId(null)
    setFormData(initialFormData)
    setSubmitting(false)
    setActiveModal('add')
  }

  const openEditModal = (link: ResourceLinkData) => {
    setEditingLink(link)
    setEditingId(link.id ?? null)
    setFormData({
      resource_name: link.resource_name,
      drive_type: link.drive_type,
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
    setImportResourceName('')
    setImportContent('')
    setImportErrors([])
    setImporting(false)
  }

  const closeCsvImportModal = () => {
    setCsvImportModalOpen(false)
    setCsvImportFile(null)
    setCsvImportErrors([])
    setCsvImporting(false)
    setCsvInputKey(prev => prev + 1)
  }

  const handleDelete = async (link: ResourceLinkData) => {
    const associationCount = link.association_count || 0
    const message = associationCount > 0
      ? `确定要删除这条卡密资源吗？\n\n删除后会同时解除 ${associationCount} 个商品的关联关系。`
      : '确定要删除这条卡密资源吗？'
    if (!confirm(message)) return
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

  const buildDuplicateConfirmText = (duplicates: ResourceLinkImportDuplicate[], message: string) => {
    const preview = duplicates
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.resource_name} / ${item.drive_type_label}`)
      .join('\n')
    const suffix = duplicates.length > 5 ? `\n... 另有 ${duplicates.length - 5} 条重复资源` : ''
    return `${message}\n\n${preview}${suffix}\n\n确认后会更新现有链接。`
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

  const openAssociationModal = async (link: ResourceLinkData) => {
    if (!link.id) return
    setAssociationModalOpen(true)
    setAssociationLoading(true)
    setAssociationSaving(false)
    setAssociationSearch('')
    setAssociationAccountFilter('')
    setAssociationStatusFilter('all')

    try {
      const result = await getResourceLinkItemAssociations(String(link.id))
      setAssociationResource(result.resource)
      setAssociationItems(result.items)
      setSelectedAssociationItemId(result.items.find(item => item.association_status === 'current')?.id ?? null)
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formData.resource_name.trim()) {
      addToast({ type: 'warning', message: '请输入资源名称' })
      return
    }
    if (!formData.drive_type) {
      addToast({ type: 'warning', message: '请选择网盘类型' })
      return
    }
    if (!formData.resource_url.trim()) {
      addToast({ type: 'warning', message: '请输入资源链接或分享口令' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        resource_name: formData.resource_name.trim(),
        drive_type: formData.drive_type as 'quark' | 'baidu',
        resource_url: formData.resource_url.trim(),
      }

      if (editingId) {
        await updateResourceLink(String(editingId), payload)
        addToast({ type: 'success', message: '资源已更新' })
      } else {
        await createResourceLink(payload)
        addToast({ type: 'success', message: '资源已新增' })
      }

      closeModal()
      loadResourceLinks()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存失败') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleImport = async () => {
    if (!importResourceName.trim()) {
      addToast({ type: 'warning', message: '请输入资源名称' })
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
        resource_name: importResourceName.trim(),
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
          resource_name: importResourceName.trim(),
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
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, 'CSV 导入失败') })
    } finally {
      setCsvImporting(false)
    }
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
  const hasAssociationChanges = addedAssociationCount > 0 || replacedAssociationCount > 0 || removedAssociationCount > 0

  const handleSaveAssociations = async () => {
    if (!associationResource?.id) return

    if (
      replacedAssociationCount > 0 &&
      !confirm(`本次会替换 ${replacedAssociationCount} 个商品当前同类型资源的关联，确定继续吗？`)
    ) {
      return
    }

    setAssociationSaving(true)
    try {
      const result = await updateResourceLinkItemAssociations(
        String(associationResource.id),
        selectedAssociationItemId ? [selectedAssociationItemId] : []
      )
      addToast({ type: 'success', message: result.message || '关联已更新' })
      closeAssociationModal()
      loadResourceLinks()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存关联失败') })
    } finally {
      setAssociationSaving(false)
    }
  }

  if (loading && resourceLinks.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">卡密管理</h1>
          <p className="page-description">保存资源名称、网盘类型和网盘链接，支持分享口令导入和 CSV 批量导入</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} className="btn-ios-secondary">
            {downloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            下载模板
          </button>
          <button onClick={() => setCsvImportModalOpen(true)} className="btn-ios-secondary">
            <Upload className="w-4 h-4" />
            CSV导入
          </button>
          <button onClick={() => setImportModalOpen(true)} className="btn-ios-secondary">
            <Upload className="w-4 h-4" />
            口令导入
          </button>
          <button onClick={openAddModal} className="btn-ios-primary">
            <Plus className="w-4 h-4" />
            新增资源
          </button>
          <button onClick={() => loadResourceLinks()} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-blue-600">{resourceLinks.length}</div>
          <div className="text-sm text-slate-500">当前资源数</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-cyan-600">
            {resourceLinks.filter(link => link.drive_type === 'quark').length}
          </div>
          <div className="text-sm text-slate-500">夸克资源</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-amber-600">
            {resourceLinks.filter(link => link.drive_type === 'baidu').length}
          </div>
          <div className="text-sm text-slate-500">百度资源</div>
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
                  placeholder="搜索电视名称、动漫名称"
                  className="input-ios pl-9"
                />
              </div>
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
            <div className="lg:col-span-3 flex items-end gap-3">
              <button type="submit" className="btn-ios-primary flex-1">
                <Search className="w-4 h-4" />
                搜索
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setQueryKeyword('')
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
                  <th>网盘类型</th>
                  <th>资源链接</th>
                  <th>关联商品</th>
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
                        <p>暂无卡密资源</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  resourceLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="font-medium">{link.resource_name}</td>
                      <td>
                        <span className={driveTypeBadges[link.drive_type] || 'badge-gray'}>
                          {driveTypeLabels[link.drive_type] || link.drive_type}
                        </span>
                      </td>
                      <td className="max-w-[360px]">
                        <div className="flex items-center gap-2">
                          <a
                            href={link.resource_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-blue-600 dark:text-blue-400 hover:underline"
                            title={link.resource_url}
                          >
                            {link.resource_url}
                          </a>
                        </div>
                      </td>
                      <td className="min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => openAssociationModal(link)}
                          className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={(link.association_count || 0) > 0 ? 'badge-primary' : 'badge-gray'}>
                              已关联 {link.association_count || 0} 个
                            </span>
                            <span className="text-xs text-blue-600 dark:text-blue-400">管理关联</span>
                          </div>
                          {(link.associated_items?.length || 0) > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {link.associated_items?.slice(0, 2).map((item) => (
                                <span
                                  key={`${link.id}-${item.item_info_id}`}
                                  className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-600 dark:text-slate-300"
                                  title={item.item_title}
                                >
                                  {item.item_title}
                                </span>
                              ))}
                              {(link.association_count || 0) > (link.associated_items?.length || 0) && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">
                                  +{(link.association_count || 0) - (link.associated_items?.length || 0)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-slate-400">未关联商品</div>
                          )}
                        </button>
                      </td>
                      <td className="text-sm text-slate-500">{link.updated_at || link.created_at || '-'}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAssociationModal(link)}
                            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            title="关联商品"
                          >
                            <Link2 className="w-4 h-4 text-violet-500" />
                          </button>
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

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {activeModal === 'add' ? '新增卡密资源' : '编辑卡密资源'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">同一资源名称下，同一网盘类型只允许保存一条记录。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="input-label mb-1">资源名称</label>
                <input
                  value={formData.resource_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, resource_name: e.target.value }))}
                  placeholder="例如：真相捕捉3"
                  className="input-ios"
                />
              </div>

              <div>
                <label className="input-label mb-1">网盘类型</label>
                <Select
                  value={formData.drive_type}
                  onChange={(value) => setFormData(prev => ({ ...prev, drive_type: value }))}
                  options={formDriveTypeOptions}
                  placeholder="选择网盘类型"
                  disabled={Boolean(editingLink && (editingLink.association_count || 0) > 0)}
                />
                {editingLink && (editingLink.association_count || 0) > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    已关联商品的资源暂不支持修改网盘类型，请先解除关联后再修改。
                  </p>
                )}
              </div>

              <div>
                <label className="input-label mb-1">资源链接或分享口令</label>
                <textarea
                  value={formData.resource_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, resource_url: e.target.value }))}
                  rows={5}
                  placeholder="可直接填写网盘链接，也可粘贴完整分享口令，系统会自动提取链接。"
                  className="input-ios min-h-[132px] resize-y"
                />
              </div>

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

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">口令导入</h3>
                <p className="text-sm text-slate-500 mt-1">每段分享口令之间空一行，系统会自动识别网盘类型和链接。</p>
              </div>
              <button onClick={closeImportModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <p>资源名称由你手动填写，系统只从口令里识别夸克/百度和对应链接。</p>
                <p>若“资源名称 + 网盘类型”已存在，会先提示确认，确认后执行更新。</p>
              </div>

              <div>
                <label className="input-label mb-1">资源名称</label>
                <input
                  value={importResourceName}
                  onChange={(e) => setImportResourceName(e.target.value)}
                  placeholder="例如：真相捕捉3"
                  className="input-ios"
                />
              </div>

              <textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                rows={12}
                placeholder="把夸克或百度的分享口令粘贴到这里，每段口令之间请空一行。"
                className="input-ios min-h-[280px] resize-y"
              />

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
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="text-sm text-slate-500">当前资源</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {associationResource.resource_name}
                        </div>
                        <div>
                          <span className={driveTypeBadges[associationResource.drive_type] || 'badge-gray'}>
                            {driveTypeLabels[associationResource.drive_type] || associationResource.drive_type}
                          </span>
                        </div>
                      </div>
                      <a
                        href={associationResource.resource_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all max-w-[360px] text-right"
                      >
                        {associationResource.resource_url}
                      </a>
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
                  <p>每个资源只能关联 1 个商品；每个商品同一类型的网盘资源也只能关联 1 个。若本次选择了已绑定其他同类型资源的商品，保存时会自动替换为当前资源。</p>
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
                            <th>当前同类型关联状态</th>
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
                                  className={
                                    `cursor-pointer ${
                                      isReplacement
                                      ? 'bg-amber-50 dark:bg-amber-900/10'
                                      : isSelected
                                        ? 'bg-blue-50 dark:bg-blue-900/20'
                                        : ''
                                    }`
                                  }
                                >
                                  <td>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        toggleAssociationItem(item.id)
                                      }}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                                      title={isSelected ? '取消选择' : '选择该商品'}
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="text-sm text-blue-600 dark:text-blue-400">{item.cookie_id}</td>
                                  <td className="text-sm text-slate-500">{item.item_id}</td>
                                  <td className="max-w-[320px]">
                                    <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                                      {item.display_title}
                                    </div>
                                    {isSelected && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">本次将绑定该商品</div>
                                    )}
                                  </td>
                                  <td>
                                    {item.association_status === 'current' ? (
                                      <span className="badge-success">已关联当前资源</span>
                                    ) : item.association_status === 'other' ? (
                                      <div className="space-y-1">
                                        <span className="badge-warning">已关联其他同类型资源</span>
                                        <div className="text-xs text-amber-600">
                                          {item.associated_resource_name || '其他资源'}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-slate-400">未关联</span>
                                    )}
                                  </td>
                                  <td className="text-xs text-slate-500">{item.updated_at || '-'}</td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    本次将新增 <span className="font-semibold text-emerald-600">{addedAssociationCount}</span> 个，
                    替换 <span className="font-semibold text-amber-600">{replacedAssociationCount}</span> 个，
                    解除 <span className="font-semibold text-rose-600">{removedAssociationCount}</span> 个
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={closeAssociationModal} className="btn-ios-secondary">
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAssociations}
                      disabled={associationSaving || !hasAssociationChanges}
                      className="btn-ios-primary min-w-[150px]"
                    >
                      {associationSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      {!hasAssociationChanges ? '已是最新' : replacedAssociationCount > 0 ? `保存并替换 ${replacedAssociationCount} 个` : '保存关联'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {csvImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">CSV 批量导入</h3>
                <p className="text-sm text-slate-500 mt-1">请先下载模板，按模板列名填写后再上传。</p>
              </div>
              <button onClick={closeCsvImportModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <p>模板列为：`资源名称`、`网盘类型`、`资源链接`。</p>
                <p>网盘类型支持：夸克、百度、quark、baidu。</p>
                <p>如果 CSV 中出现重复资源，系统会直接更新现有链接，不再二次确认。</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} className="btn-ios-secondary">
                  {downloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  下载模板
                </button>
              </div>

              <div>
                <label className="input-label mb-1">CSV 文件</label>
                <input
                  key={csvInputKey}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    setCsvImportErrors([])
                    setCsvImportFile(e.target.files?.[0] || null)
                  }}
                  className="input-ios file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:text-blue-600 hover:file:bg-blue-100"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {csvImportFile ? `已选择：${csvImportFile.name}` : '请选择 CSV 文件'}
                </p>
              </div>

              {csvImportErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="text-sm font-medium text-red-700">以下 CSV 行解析失败：</p>
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
