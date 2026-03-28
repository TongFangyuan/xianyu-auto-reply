import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  Edit2,
  FileText,
  Link2,
  Loader2,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { getDeliveryRules, deleteDeliveryRule, updateDeliveryRule, addDeliveryRule } from '@/api/delivery'
import { getCards, type CardData } from '@/api/cards'
import { getDeliveryDocumentTypes, updateDeliveryDocumentTypes } from '@/api/settings'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { PageLoading } from '@/components/common/Loading'
import { Select } from '@/components/common/Select'
import type { DeliveryDocumentType, DeliveryRule } from '@/types'

const cardDeliveryModeOption = { value: 'card', label: '卡券发货' }
const legacyResourceLinkModeOption = { value: 'resource_link', label: '商品关联卡密（兼容旧配置）' }

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

const createEmptyDocumentTypeForm = () => ({
  id: '',
  name: '',
  url: '',
  enabled: true,
  description: '',
  sort_order: 0,
})

const normalizeDocumentTypes = (documentTypes: DeliveryDocumentType[]) => {
  return [...documentTypes].sort((left, right) => {
    const leftSort = Number(left.sort_order ?? 0)
    const rightSort = Number(right.sort_order ?? 0)
    if (leftSort !== rightSort) return leftSort - rightSort
    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

export function Delivery() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<DeliveryRule[]>([])
  const [cards, setCards] = useState<CardData[]>([])
  const [documentTypes, setDocumentTypes] = useState<DeliveryDocumentType[]>([])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<DeliveryRule | null>(null)
  const [formKeyword, setFormKeyword] = useState('')
  const [formDeliveryMode, setFormDeliveryMode] = useState<'card' | 'resource_link'>('card')
  const [formCardId, setFormCardId] = useState('')
  const [formDocumentTypeId, setFormDocumentTypeId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const [documentModalOpen, setDocumentModalOpen] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [editingDocumentTypeId, setEditingDocumentTypeId] = useState<string | null>(null)
  const [documentForm, setDocumentForm] = useState(createEmptyDocumentTypeForm())

  const loadRules = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      setLoading(true)
      const result = await getDeliveryRules()
      if (result.success) {
        setRules(result.data || [])
      }
    } catch {
      addToast({ type: 'error', message: '加载发货规则失败' })
    } finally {
      setLoading(false)
    }
  }

  const loadReferenceData = async () => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    try {
      const [cardsResult, documentTypesResult] = await Promise.all([
        getCards(),
        getDeliveryDocumentTypes(),
      ])
      if (cardsResult.success) {
        setCards(cardsResult.data || [])
      }
      if (documentTypesResult.success) {
        setDocumentTypes(normalizeDocumentTypes(documentTypesResult.data || []))
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return
    loadReferenceData()
    loadRules()
  }, [_hasHydrated, isAuthenticated, token])

  const cardOptions = useMemo(() => ([
    { value: '', label: '请选择卡券' },
    ...cards.map((card) => ({
      value: String(card.id),
      label: card.is_multi_spec
        ? `${card.name} [${card.spec_name}: ${card.spec_value}]`
        : card.name || card.text_content?.substring(0, 20) || `卡券 ${card.id}`,
    })),
  ]), [cards])

  const documentTypeOptions = useMemo(() => ([
    { value: '', label: '请选择文档类型' },
    ...documentTypes
      .filter((item) => item.enabled)
      .map((item) => ({
        value: item.id,
        label: item.name,
      })),
  ]), [documentTypes])

  const deliveryModeOptions = useMemo(() => {
    if (editingRule?.delivery_mode === 'resource_link') {
      return [cardDeliveryModeOption, legacyResourceLinkModeOption]
    }
    return [cardDeliveryModeOption]
  }, [editingRule])

  const handleToggleEnabled = async (rule: DeliveryRule) => {
    try {
      await updateDeliveryRule(String(rule.id), { enabled: !rule.enabled })
      addToast({ type: 'success', message: rule.enabled ? '规则已禁用' : '规则已启用' })
      loadRules()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '操作失败') })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条规则吗？')) return
    try {
      await deleteDeliveryRule(String(id))
      addToast({ type: 'success', message: '删除成功' })
      loadRules()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '删除失败') })
    }
  }

  const openAddModal = () => {
    setEditingRule(null)
    setFormKeyword('')
    setFormDeliveryMode('card')
    setFormCardId('')
    setFormDocumentTypeId('')
    setFormDescription('')
    setFormEnabled(true)
    setIsModalOpen(true)
  }

  const openEditModal = (rule: DeliveryRule) => {
    setEditingRule(rule)
    setFormKeyword(rule.keyword)
    setFormDeliveryMode((rule.delivery_mode || 'card') as 'card' | 'resource_link')
    setFormCardId(rule.card_id ? String(rule.card_id) : '')
    setFormDocumentTypeId(rule.document_type_id || '')
    setFormDescription(rule.description || '')
    setFormEnabled(rule.enabled)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingRule(null)
    setFormKeyword('')
    setFormDeliveryMode('card')
    setFormCardId('')
    setFormDocumentTypeId('')
    setFormDescription('')
    setFormEnabled(true)
    setSaving(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formKeyword.trim()) {
      addToast({ type: 'warning', message: '请输入触发关键词' })
      return
    }
    if (formDeliveryMode === 'card' && !formCardId) {
      addToast({ type: 'warning', message: '请选择卡券' })
      return
    }
    if (formDeliveryMode === 'resource_link' && !formDocumentTypeId) {
      addToast({ type: 'warning', message: '请选择文档类型' })
      return
    }

    setSaving(true)
    try {
      const data: Partial<DeliveryRule> = {
        keyword: formKeyword.trim(),
        delivery_mode: formDeliveryMode,
        card_id: formDeliveryMode === 'card' ? Number(formCardId) : undefined,
        document_type_id: formDeliveryMode === 'resource_link' ? formDocumentTypeId : undefined,
        delivery_count: 1,
        description: formDescription.trim() || undefined,
        enabled: formEnabled,
      }

      if (editingRule) {
        await updateDeliveryRule(String(editingRule.id), data)
        addToast({ type: 'success', message: '规则已更新' })
      } else {
        await addDeliveryRule(data)
        addToast({ type: 'success', message: '规则已添加' })
      }

      closeModal()
      loadRules()
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存失败') })
    } finally {
      setSaving(false)
    }
  }

  const openDocumentTypeModal = () => {
    setDocumentModalOpen(true)
    setEditingDocumentTypeId(null)
    setDocumentForm(createEmptyDocumentTypeForm())
  }

  const closeDocumentTypeModal = () => {
    setDocumentModalOpen(false)
    setEditingDocumentTypeId(null)
    setDocumentForm(createEmptyDocumentTypeForm())
    setDocumentSaving(false)
  }

  const startEditDocumentType = (documentType: DeliveryDocumentType) => {
    setEditingDocumentTypeId(documentType.id)
    setDocumentForm({
      id: documentType.id,
      name: documentType.name,
      url: documentType.url,
      enabled: documentType.enabled,
      description: documentType.description || '',
      sort_order: Number(documentType.sort_order ?? 0),
    })
  }

  const saveDocumentTypes = async (nextDocumentTypes: DeliveryDocumentType[], successMessage: string) => {
    try {
      setDocumentSaving(true)
      const normalized = normalizeDocumentTypes(nextDocumentTypes)
      const result = await updateDeliveryDocumentTypes(normalized)
      if (!result.success) {
        addToast({ type: 'error', message: result.message || '保存文档类型失败' })
        return false
      }
      setDocumentTypes(normalized)
      addToast({ type: 'success', message: successMessage })
      return true
    } catch (error) {
      addToast({ type: 'error', message: getErrorMessage(error, '保存文档类型失败') })
      return false
    } finally {
      setDocumentSaving(false)
    }
  }

  const handleDocumentTypeSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!documentForm.name.trim()) {
      addToast({ type: 'warning', message: '请输入文档类型名称' })
      return
    }
    if (!documentForm.url.trim()) {
      addToast({ type: 'warning', message: '请输入文档链接' })
      return
    }

    const documentTypeId = editingDocumentTypeId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const nextDocumentType: DeliveryDocumentType = {
      id: documentTypeId,
      name: documentForm.name.trim(),
      url: documentForm.url.trim(),
      enabled: documentForm.enabled,
      description: documentForm.description.trim(),
      sort_order: Number(documentForm.sort_order || 0),
    }

    const nextDocumentTypes = editingDocumentTypeId
      ? documentTypes.map((item) => (item.id === editingDocumentTypeId ? nextDocumentType : item))
      : [...documentTypes, nextDocumentType]

    const success = await saveDocumentTypes(
      nextDocumentTypes,
      editingDocumentTypeId ? '文档类型已更新' : '文档类型已新增'
    )
    if (success) {
      setEditingDocumentTypeId(null)
      setDocumentForm(createEmptyDocumentTypeForm())
    }
  }

  const handleDeleteDocumentType = async (documentType: DeliveryDocumentType) => {
    const usedRule = rules.find((rule) => rule.delivery_mode === 'resource_link' && rule.document_type_id === documentType.id)
    if (usedRule) {
      addToast({ type: 'warning', message: `文档类型已被规则“${usedRule.keyword}”使用，请先修改规则` })
      return
    }

    if (!confirm(`确定要删除文档类型“${documentType.name}”吗？`)) return
    await saveDocumentTypes(
      documentTypes.filter((item) => item.id !== documentType.id),
      '文档类型已删除'
    )

    if (editingDocumentTypeId === documentType.id) {
      setEditingDocumentTypeId(null)
      setDocumentForm(createEmptyDocumentTypeForm())
    }
  }

  if (loading && rules.length === 0) {
    return <PageLoading />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">自动发货</h1>
          <p className="page-description">商品只要关联了卡密资源，就会直接自动发货；这里的规则主要用于传统卡券发货</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={openDocumentTypeModal} className="btn-ios-secondary">
            <BookOpen className="w-4 h-4" />
            文档类型
          </button>
          <button onClick={openAddModal} className="btn-ios-primary">
            <Plus className="w-4 h-4" />
            添加卡券规则
          </button>
          <button onClick={() => { loadReferenceData(); loadRules() }} className="btn-ios-secondary">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        商品已关联卡密资源时，无需再手动添加发货规则或选择发货方式，系统会直接按关联资源自动发货。
        文档结尾会使用“文档类型”里已启用且排序最靠前的一项。
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-blue-600">{rules.length}</div>
          <div className="text-sm text-slate-500">发货规则数</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-cyan-600">
            {rules.filter((rule) => (rule.delivery_mode || 'card') === 'card').length}
          </div>
          <div className="text-sm text-slate-500">卡券发货规则</div>
        </div>
        <div className="vben-card p-4">
          <div className="text-2xl font-bold text-emerald-600">
            {rules.filter((rule) => (rule.delivery_mode || 'card') === 'resource_link').length}
          </div>
          <div className="text-sm text-slate-500">旧关联规则</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="vben-card"
      >
        <div className="vben-card-header flex items-center justify-between">
          <h2 className="vben-card-title">
            <Truck className="w-4 h-4" />
            卡券发货规则
          </h2>
          <span className="badge-primary">{rules.length} 条规则</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-ios min-w-[980px]">
            <thead>
              <tr>
                <th>触发关键词</th>
                <th>发货方式</th>
                <th>发货目标</th>
                <th>规格</th>
                <th>已发次数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="w-12 h-12 text-gray-300" />
                      <p>暂无发货规则</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const relatedCard = cards.find((card) => card.id === rule.card_id)
                  const isResourceLinkMode = (rule.delivery_mode || 'card') === 'resource_link'
                  return (
                    <tr key={rule.id}>
                      <td className="font-medium text-blue-600 dark:text-blue-400">{rule.keyword}</td>
                      <td>
                        {isResourceLinkMode ? (
                          <span className="badge-success">旧关联规则</span>
                        ) : (
                          <span className="badge-primary">卡券发货</span>
                        )}
                      </td>
                      <td className="max-w-[280px]">
                        {isResourceLinkMode ? (
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900 dark:text-slate-100">兼容旧的商品关联规则</div>
                            <div className="text-xs text-slate-500">
                              文档类型：{rule.document_type_name || '未配置'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {rule.card_name || `卡券ID: ${rule.card_id}`}
                            </div>
                            <div className="text-xs text-slate-500">{rule.card_type || '-'}</div>
                          </div>
                        )}
                      </td>
                      <td>
                        {relatedCard?.is_multi_spec ? (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {relatedCard.spec_name}: {relatedCard.spec_value}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-center text-slate-500">{rule.delivery_times || 0}</td>
                      <td>
                        {rule.enabled ? (
                          <span className="badge-success">启用</span>
                        ) : (
                          <span className="badge-danger">禁用</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleEnabled(rule)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title={rule.enabled ? '禁用' : '启用'}
                          >
                            {rule.enabled ? (
                              <PowerOff className="w-4 h-4 text-amber-500" />
                            ) : (
                              <Power className="w-4 h-4 text-emerald-500" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(rule)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl">
            <div className="modal-header flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingRule ? '编辑卡券规则' : '添加卡券规则'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label">触发关键词 *</label>
                  <input
                    type="text"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    className="input-ios"
                    placeholder="输入触发自动发货的关键词"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    建议填写商品标题里的连续关键词，避免匹配到多条规则。
                  </p>
                </div>

                <div className="input-group">
                  <label className="input-label">发货方式 *</label>
                  <Select
                    value={formDeliveryMode}
                    onChange={(value) => setFormDeliveryMode((value || 'card') as 'card' | 'resource_link')}
                    options={deliveryModeOptions}
                    placeholder="请选择发货方式"
                  />
                  {!editingRule && (
                    <p className="text-xs text-emerald-600 mt-2">
                      商品关联卡密已改为自动发货，不需要在这里额外配置规则。
                    </p>
                  )}
                  {editingRule?.delivery_mode === 'resource_link' && formDeliveryMode === 'resource_link' && (
                    <p className="text-xs text-amber-600 mt-2">
                      这是旧版兼容配置。现在新商品只要关联卡密资源，就会自动发货。
                    </p>
                  )}
                </div>

                {formDeliveryMode === 'card' ? (
                  <div className="input-group">
                    <label className="input-label">关联卡券 *</label>
                    <Select
                      value={formCardId}
                      onChange={setFormCardId}
                      options={cardOptions}
                      placeholder="请选择卡券"
                    />
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      命中规则后，系统会自动读取当前商品已关联的百度/夸克卡密，并按固定模板组装发货内容。
                    </div>
                    <div className="input-group">
                      <label className="input-label">文档类型 *</label>
                      <Select
                        value={formDocumentTypeId}
                        onChange={setFormDocumentTypeId}
                        options={documentTypeOptions}
                        placeholder="请选择文档类型"
                      />
                      {documentTypes.filter((item) => item.enabled).length === 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          还没有可用的文档类型，请先点击页面右上角“文档类型”进行配置。
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="input-label">描述（可选）</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="input-ios h-20 resize-none"
                    placeholder="规则备注，方便识别"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">启用此规则</span>
                  <button
                    type="button"
                    onClick={() => setFormEnabled(!formEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-ios-secondary" disabled={saving}>
                  取消
                </button>
                <button type="submit" className="btn-ios-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {documentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-4xl">
            <div className="modal-header flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">文档类型配置</h2>
                <p className="text-sm text-slate-500 mt-1">配置自动发货文案末尾要附带的文档入口。系统会优先使用已启用且排序最靠前的一项。</p>
              </div>
              <button onClick={closeDocumentTypeModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">已配置文档类型</div>
                    <span className="badge-primary">{documentTypes.length} 个</span>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {documentTypes.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p>暂无文档类型</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {documentTypes.map((item) => (
                          <div key={item.id} className="px-4 py-4 flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{item.name}</span>
                                {item.enabled ? (
                                  <span className="badge-success">启用</span>
                                ) : (
                                  <span className="badge-danger">停用</span>
                                )}
                                <span className="text-xs text-slate-400">排序 {item.sort_order || 0}</span>
                              </div>
                              <div className="text-xs text-blue-600 break-all">{item.url}</div>
                              <div className="text-xs text-slate-500">{item.description || '无备注'}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditDocumentType(item)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDocumentType(item)}
                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleDocumentTypeSubmit} className="xl:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {editingDocumentTypeId ? '编辑文档类型' : '新增文档类型'}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">用于商品关联卡密发货模式。</p>
                    </div>
                    {editingDocumentTypeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDocumentTypeId(null)
                          setDocumentForm(createEmptyDocumentTypeForm())
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        新建一个
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="input-label mb-1">名称 *</label>
                    <input
                      value={documentForm.name}
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="input-ios"
                      placeholder="例如：热门剧"
                    />
                  </div>

                  <div>
                    <label className="input-label mb-1">文档链接 *</label>
                    <textarea
                      value={documentForm.url}
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, url: e.target.value }))}
                      className="input-ios min-h-[96px] resize-y"
                      placeholder="例如：https://..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label mb-1">排序</label>
                      <input
                        type="number"
                        value={documentForm.sort_order}
                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, sort_order: Number(e.target.value || 0) }))}
                        className="input-ios"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="switch-ios">
                        <input
                          type="checkbox"
                          checked={documentForm.enabled}
                          onChange={(e) => setDocumentForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                        />
                        <span className="switch-slider"></span>
                      </label>
                      <span className="ml-3 text-sm text-slate-600 dark:text-slate-300">启用</span>
                    </div>
                  </div>

                  <div>
                    <label className="input-label mb-1">备注</label>
                    <textarea
                      value={documentForm.description}
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="input-ios h-24 resize-none"
                      placeholder="可选备注"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 space-y-1">
                    <p>发货时会自动拼成类似：</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      全网{documentForm.name.trim() || '热门剧'}文档复制去浏览qi打开 👇👇 【夸克链接失效这里找新的】{documentForm.url.trim() || '文档链接'}
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button type="submit" className="btn-ios-primary min-w-[120px]" disabled={documentSaving}>
                      {documentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      {editingDocumentTypeId ? '更新类型' : '保存类型'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
