/**
 * 贾维斯配置管理区域
 * 支持导出和导入贾维斯配置包
 */

import { useState, useEffect } from 'react';
import { Download, Upload, Package, AlertCircle, CheckCircle } from 'lucide-react';
import type { JarvisMetadata, JarvisConfig, ImportOptions } from '../../../electron.d';

export function JarvisSection() {
  const [metadata, setMetadata] = useState<JarvisMetadata>({
    name: '我的贾维斯',
    description: '',
    version: '1.0.0',
    author: '',
    tags: [],
  });
  
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<JarvisConfig | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 自动清除提示
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  // 导出配置
  const handleExport = async () => {
    if (!metadata.name.trim()) {
      setError('请输入贾维斯名称');
      return;
    }
    
    setExporting(true);
    setError(null);
    
    try {
      const outputPath = await window.electron.saveJarvisDialog();
      if (!outputPath) {
        setExporting(false);
        return;
      }
      
      const result = await window.electron.exportJarvisConfig(metadata, outputPath);
      if (result.success) {
        setSuccess('导出成功！');
      } else {
        setError(`导出失败：${result.error}`);
      }
    } catch (err) {
      setError('导出失败');
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };
  
  // 选择并预览配置
  const handleSelectFile = async () => {
    setError(null);
    
    try {
      const filePath = await window.electron.openJarvisDialog();
      if (!filePath) return;
      
      setSelectedFilePath(filePath);
      
      const result = await window.electron.previewJarvisConfig(filePath);
      if (result.success && result.config) {
        setPreviewConfig(result.config);
      } else {
        setError(`预览失败：${result.error}`);
      }
    } catch (err) {
      setError('预览失败');
      console.error('Preview error:', err);
    }
  };
  
  // 导入配置
  const handleImport = async () => {
    if (!previewConfig || !selectedFilePath) return;
    
    setImporting(true);
    setError(null);
    
    try {
      // 检查是否有需要用户输入的字段
      const requiresInput: Record<string, Record<string, any>> = {};
      
      for (const [name, config] of Object.entries(previewConfig.mcpServers)) {
        if (config.requiresUserInput) {
          requiresInput[name] = config.requiresUserInput;
        }
      }
      
      // TODO: 如果有需要用户输入的字段，应该显示一个对话框让用户填写
      // 目前简化处理：跳过已存在的配置
      const options: ImportOptions = {
        skipExisting: true,
        overwrite: false,
        userInputs: {},
      };
      
      const result = await window.electron.importJarvisConfig(selectedFilePath, options);
      
      if (result.success) {
        const imported = result.imported.mcpServers.length + result.imported.skills.length;
        const skipped = result.skipped.mcpServers.length + result.skipped.skills.length;
        
        let message = `导入成功！\n`;
        if (imported > 0) {
          message += `- 已导入：${result.imported.mcpServers.length} 个 MCP 服务器，${result.imported.skills.length} 个技能\n`;
        }
        if (skipped > 0) {
          message += `- 已跳过：${result.skipped.mcpServers.length} 个 MCP 服务器，${result.skipped.skills.length} 个技能（已存在）\n`;
        }
        const errs = result.errors ?? [];
        if (errs.length > 0) {
          message += `- 错误：${errs.length} 个`;
        }
        
        setSuccess(message);
        setPreviewConfig(null);
        setSelectedFilePath(null);
      } else {
        setError(`导入失败：${(result.errors ?? []).join('\n')}`);
      }
    } catch (err) {
      setError('导入失败');
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };
  
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">贾维斯配置</h1>
        <p className="mt-2 text-sm text-muted">
          导出和分享你的 AI 助手配置，或导入他人的配置快速开始
        </p>
      </header>
      
      {/* 提示信息 */}
      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-800 whitespace-pre-line">{success}</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800 whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}
      
      {/* 导出区域 */}
      <div className="p-6 rounded-lg border border-ink-900/10 bg-surface">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-ink-900">导出配置</h3>
        </div>
        
        <p className="text-sm text-muted mb-4">
          将当前的 MCP 服务器和 Skills 打包导出为 .jarvis 文件，方便分享给他人
        </p>
        
        {/* 元信息表单 */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1">
              贾维斯名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={metadata.name}
              onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
              className="w-full px-3 py-2 border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="例如：前端开发专家"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1">
              描述
            </label>
            <textarea
              value={metadata.description}
              onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
              className="w-full px-3 py-2 border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
              rows={3}
              placeholder="简要描述这个贾维斯的功能和特点..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1">
                版本
              </label>
              <input
                type="text"
                value={metadata.version}
                onChange={(e) => setMetadata({ ...metadata, version: e.target.value })}
                className="w-full px-3 py-2 border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="1.0.0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1">
                作者
              </label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                className="w-full px-3 py-2 border border-ink-900/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="你的名字"
              />
            </div>
          </div>
        </div>
        
        <button
          onClick={handleExport}
          disabled={exporting || !metadata.name.trim()}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? '导出中...' : '导出为 .jarvis 文件'}
        </button>
      </div>
      
      {/* 导入区域 */}
      <div className="p-6 rounded-lg border border-ink-900/10 bg-surface">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-ink-900">导入配置</h3>
        </div>
        
        <p className="text-sm text-muted mb-4">
          从 .jarvis 文件导入他人分享的配置，快速复刻一个贾维斯
        </p>
        
        {!previewConfig ? (
          <button
            onClick={handleSelectFile}
            className="px-4 py-2 bg-surface-tertiary text-ink-900 rounded-lg hover:bg-surface-secondary flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            选择 .jarvis 文件
          </button>
        ) : (
          <div className="space-y-4">
            {/* 预览信息 */}
            <div className="p-4 rounded-xl bg-info-light border border-info/20">
              <h4 className="font-semibold text-ink-900 mb-2">
                {previewConfig.jarvis.name}
              </h4>
              <p className="text-sm text-ink-700 mb-3">
                {previewConfig.jarvis.description}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-ink-600">
                <div>📦 MCP 服务器: {previewConfig.statistics.mcpServersCount}</div>
                <div>⚡ Skills: {previewConfig.statistics.skillsCount}</div>
                <div>👤 作者: {previewConfig.jarvis.author}</div>
                <div>🏷️ 版本: {previewConfig.jarvis.version}</div>
              </div>
              
              {/* 显示包含的内容 */}
              <div className="mt-4 pt-4 border-t border-info/20">
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-ink-900 hover:text-ink-700">
                    查看详细内容
                  </summary>
                  <div className="mt-2 space-y-2">
                    {Object.keys(previewConfig.mcpServers).length > 0 && (
                      <div>
                        <p className="font-medium text-ink-900">MCP 服务器：</p>
                        <ul className="list-disc list-inside text-ink-600 ml-2">
                          {Object.entries(previewConfig.mcpServers).map(([name, config]) => (
                            <li key={name}>
                              {name} {config.description && `- ${config.description}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {previewConfig.skills.length > 0 && (
                      <div>
                        <p className="font-medium text-ink-900">Skills：</p>
                        <ul className="list-disc list-inside text-ink-600 ml-2">
                          {previewConfig.skills.map((skill) => (
                            <li key={skill}>{skill}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? '导入中...' : '确认导入'}
              </button>
              <button
                onClick={() => {
                  setPreviewConfig(null);
                  setSelectedFilePath(null);
                }}
                disabled={importing}
                className="px-4 py-2 bg-surface-tertiary text-ink-900 rounded-lg hover:bg-surface-secondary disabled:opacity-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 说明文档 */}
      <div className="p-4 rounded-xl bg-info-light border border-info/20">
        <h4 className="font-semibold text-ink-900 mb-2">💡 使用说明</h4>
        <ul className="text-sm text-ink-700 space-y-1">
          <li>• 导出的 .jarvis 文件包含当前所有的 MCP 服务器配置和 Skills</li>
          <li>• 敏感信息（如 API Token）会被标记为需要导入时填写</li>
          <li>• 导入时会自动跳过已存在的同名配置，避免覆盖</li>
          <li>• 导入后需要重启会话才能生效</li>
        </ul>
      </div>
    </section>
  );
}
