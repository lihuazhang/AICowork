/**
 * Skills 管理区域 - 基于 SDK 原生支持
 * 只支持导入和删除功能，SDK 会自动扫描 ~/.qwen/skills/ 目录
 */

import { useState, useEffect } from "react";
import { FolderOpen, Trash2, ExternalLink } from "lucide-react";
import type { SkillConfig } from "../../../electron.d";

export function SkillsSection() {
  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 加载技能列表
  const loadSkills = async () => {
    setLoading(true);
    try {
      const skillsList = await window.electron.getSkillsList();
      setSkills(skillsList);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  // 自动清除提示
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // 导入技能
  const handleImportSkill = async () => {
    setImporting(true);
    setError(null);
    
    try {
      // 打开目录选择对话框
      const sourcePath = await window.electron.selectDirectory();
      if (!sourcePath) {
        setImporting(false);
        return;
      }

      // 导入技能
      const result = await window.electron.importSkill(sourcePath);
      
      if (result.success) {
        setSuccess('技能导入成功！SDK 会自动识别和加载。');
        await loadSkills();
      } else {
        setError(result.error || '导入技能失败');
      }
    } catch (err) {
      setError('导入技能失败');
      console.error('Import skill error:', err);
    } finally {
      setImporting(false);
    }
  };

  // 删除技能
  const handleDeleteSkill = async (skillName: string) => {
    if (!confirm(`确定要删除技能 "${skillName}" 吗？`)) {
      return;
    }

    try {
      const result = await window.electron.deleteSkill(skillName);
      if (result.success) {
        await loadSkills();
      } else {
        setError(result.error || '删除技能失败');
      }
    } catch (err) {
      setError('删除技能失败');
    }
  };

  // 打开技能目录
  const handleOpenDirectory = async () => {
    try {
      const result = await window.electron.openSkillsDirectory();
      if (!result.success) {
        console.error('Failed to open skills directory:', result.error);
      }
    } catch (error) {
      console.error('Error opening skills directory:', error);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Skills 技能管理</h1>
        <p className="mt-2 text-sm text-muted">
          从本地目录导入技能到 ~/.qwen/skills/，SDK 会自动识别和加载技能
        </p>
      </header>

      {/* 提示信息 */}
      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleImportSkill}
          disabled={importing}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          {importing ? '导入中...' : '+ 导入技能'}
        </button>

        <button
          onClick={handleOpenDirectory}
          className="px-4 py-2 bg-surface-tertiary text-ink-900 rounded-lg hover:bg-surface-secondary flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          打开技能目录
        </button>
      </div>

      {/* 技能列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted">加载中...</div>
        ) : skills.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p>暂无技能</p>
            <p className="text-sm mt-2">点击"导入技能"按钮从本地目录导入</p>
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.name}
              className="p-4 rounded-lg border border-ink-900/10 bg-surface hover:border-ink-900/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-ink-900">{skill.name}</h3>
                  <p className="text-sm text-muted mt-1">{skill.description}</p>
                  {skill.script && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs bg-accent/10 text-accent rounded">
                      {skill.script.type === 'javascript' ? 'JavaScript' : 'Python'} 脚本
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSkill(skill.name)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除技能"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 说明文档 */}
      <div className="p-4 rounded-xl bg-info-light border border-info/20">
        <h4 className="font-semibold text-ink-900 mb-2">💡 使用说明</h4>
        <ul className="text-sm text-ink-700 space-y-1">
          <li>• 技能目录必须包含 SKILL.md 文件</li>
          <li>• SDK 会自动扫描 ~/.qwen/skills/ 目录并加载所有技能</li>
          <li>• 技能可以通过 Agent 配置的 skills 数组引用</li>
          <li>• 导入后需要重启会话才能生效</li>
        </ul>
      </div>
    </section>
  );
}
