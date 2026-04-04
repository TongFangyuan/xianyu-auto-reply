import { ResourceExportConfigCard } from '@/pages/resources/ResourceExportConfigCard'

export function ResourceExportConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">导出配置</h1>
        <p className="page-description">管理资源导出文案尾链、导出文档头图和相关跳转入口。</p>
      </div>

      <ResourceExportConfigCard />
    </div>
  )
}
