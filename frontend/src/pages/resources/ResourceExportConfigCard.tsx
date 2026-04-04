import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, Loader2 } from 'lucide-react'
import { getUserSetting, updateUserSetting } from '@/api/settings'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

const DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL = 'https://www.kdocs.cn/l/ckxE5KFSxNov'
const RESOURCE_COPYWRITING_FOOTER_URL_SETTING_KEY = 'resources_copywriting_footer_url'
const DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL = 'https://i.cetsteam.com/imgs/2026/04/03/e19ab387d2f87791.jpeg'
const RESOURCE_DOCUMENT_HEADER_IMAGE_URL_SETTING_KEY = 'resources_document_header_image_url'
const IMAGE_BED_MANAGE_URL = 'https://img.cetsteam.com/vip/manage/mypic'

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

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export function ResourceExportConfigCard() {
  const { addToast } = useUIStore()
  const { isAuthenticated, token, _hasHydrated } = useAuthStore()
  const [copywritingFooterUrl, setCopywritingFooterUrl] = useState(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
  const [copywritingFooterUrlDraft, setCopywritingFooterUrlDraft] = useState(DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL)
  const [loadingCopywritingFooterUrl, setLoadingCopywritingFooterUrl] = useState(false)
  const [savingCopywritingFooterUrl, setSavingCopywritingFooterUrl] = useState(false)
  const [documentHeaderImageUrl, setDocumentHeaderImageUrl] = useState(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
  const [documentHeaderImageUrlDraft, setDocumentHeaderImageUrlDraft] = useState(DEFAULT_RESOURCE_DOCUMENT_HEADER_IMAGE_URL)
  const [loadingDocumentHeaderImageUrl, setLoadingDocumentHeaderImageUrl] = useState(false)
  const [savingDocumentHeaderImageUrl, setSavingDocumentHeaderImageUrl] = useState(false)

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token) return

    const loadCopywritingFooterUrl = async () => {
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

    const loadDocumentHeaderImageUrl = async () => {
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

    loadCopywritingFooterUrl()
    loadDocumentHeaderImageUrl()
  }, [_hasHydrated, isAuthenticated, token])

  const handleSaveCopywritingFooterUrl = async () => {
    const normalizedUrl = copywritingFooterUrlDraft.trim() || DEFAULT_RESOURCE_COPYWRITING_FOOTER_URL
    if (!isValidHttpUrl(normalizedUrl)) {
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
    if (!isValidHttpUrl(normalizedUrl)) {
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

  const hasCopywritingFooterUrlChanges = copywritingFooterUrlDraft.trim() !== copywritingFooterUrl
  const hasDocumentHeaderImageUrlChanges = documentHeaderImageUrlDraft.trim() !== documentHeaderImageUrl

  return (
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
  )
}
