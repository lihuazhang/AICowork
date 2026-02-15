/**
 * 记忆设置区域
 * 管理记忆种类与记忆条目，与设计图一致
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';
import type { MemoryKind, MemoryEntry } from '../../../electron.d';

type KindFormMode = 'add' | 'edit' | null;
type EntryFormMode = 'add' | 'edit' | null;

function formatRelativeTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (7 * 86400000))} 周前`;
  return d.toLocaleDateString();
}

export function MemorySection() {
  const { t } = useTranslation();
  const [kinds, setKinds] = useState<MemoryKind[]>([]);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [kindFormMode, setKindFormMode] = useState<KindFormMode>(null);
  const [editingKind, setEditingKind] = useState<MemoryKind | null>(null);
  const [kindName, setKindName] = useState('');
  const [kindDescription, setKindDescription] = useState('');

  const [entryFormMode, setEntryFormMode] = useState<EntryFormMode>(null);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [entryKindId, setEntryKindId] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [entrySummary, setEntrySummary] = useState('');
  const [entryImportance, setEntryImportance] = useState<MemoryEntry['importance']>('medium');

  const [entryFilterKindId, setEntryFilterKindId] = useState<string>('');
  const [entrySearchQuery, setEntrySearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const loadKinds = useCallback(async () => {
    try {
      const list = await window.electron.getMemoryKinds();
      setKinds(list);
    } catch (e) {
      console.error('Failed to load kinds:', e);
      setError(t('memory.errors.saveFailed'));
    }
  }, [t]);

  const loadEntries = useCallback(async () => {
    try {
      const params: { kindId?: string; query?: string; limit?: number } = { limit: 100 };
      if (entryFilterKindId) params.kindId = entryFilterKindId;
      if (entrySearchQuery.trim()) params.query = entrySearchQuery.trim();
      const list = await window.electron.searchMemoryEntries(params);
      setEntries(list);
    } catch (e) {
      console.error('Failed to load entries:', e);
      setError(t('memory.errors.saveFailed'));
    }
  }, [entryFilterKindId, entrySearchQuery, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([window.electron.getMemoryKinds(), window.electron.searchMemoryEntries({ limit: 100 })])
      .then(([kList, eList]) => {
        if (!cancelled) {
          setKinds(kList);
          setEntries(eList);
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('memory.errors.saveFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    if (kindFormMode === null && entryFormMode === null) return;
    loadKinds();
    loadEntries();
  }, [kindFormMode, entryFormMode, loadKinds, loadEntries]);

  useEffect(() => {
    loadEntries();
  }, [entryFilterKindId, entrySearchQuery, loadEntries]);

  const openAddKind = () => {
    setEditingKind(null);
    setKindName('');
    setKindDescription('');
    setKindFormMode('add');
    setError(null);
  };

  const openEditKind = (k: MemoryKind) => {
    setEditingKind(k);
    setKindName(k.name);
    setKindDescription(k.description ?? '');
    setKindFormMode('edit');
    setError(null);
  };

  const saveKind = async () => {
    const name = kindName.trim();
    if (!name) {
      setError(t('memory.errors.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kindFormMode === 'add') {
        await window.electron.createMemoryKind({ name, description: kindDescription.trim() || undefined });
        setSuccess(true);
      } else if (editingKind) {
        await window.electron.updateMemoryKind(editingKind.id, { name, description: kindDescription.trim() || undefined });
        setSuccess(true);
      }
      setTimeout(() => setSuccess(false), 2000);
      setKindFormMode(null);
      setEditingKind(null);
      await loadKinds();
    } catch (e: any) {
      setError(e?.message ?? t('memory.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteKind = async (k: MemoryKind) => {
    if (!confirm(t('memory.confirmDeleteKind', { name: k.name }))) return;
    try {
      await window.electron.deleteMemoryKind(k.id);
      await loadKinds();
      await loadEntries();
    } catch (e: any) {
      setError(e?.message ?? t('memory.errors.deleteFailed'));
    }
  };

  const openAddEntry = () => {
    setEditingEntry(null);
    setEntryKindId(kinds[0]?.id ?? '');
    setEntryContent('');
    setEntrySummary('');
    setEntryImportance('medium');
    setEntryFormMode('add');
    setError(null);
  };

  const openEditEntry = (e: MemoryEntry) => {
    setEditingEntry(e);
    setEntryKindId(e.kindId);
    setEntryContent(e.content);
    setEntrySummary(e.summary ?? '');
    setEntryImportance(e.importance ?? 'medium');
    setEntryFormMode('edit');
    setError(null);
  };

  const saveEntry = async () => {
    const content = entryContent.trim();
    const summary = entrySummary.trim();
    if (!content) {
      setError(t('memory.errors.contentRequired'));
      return;
    }
    if (!entryKindId) {
      setError(t('memory.errors.kindRequired'));
      return;
    }
    if (!summary) {
      setError(t('memory.errors.summaryRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (entryFormMode === 'add') {
        await window.electron.createMemoryEntry({
          kindId: entryKindId,
          content,
          summary,
          importance: entryImportance,
        });
        setSuccess(true);
      } else if (editingEntry) {
        await window.electron.updateMemoryEntry(editingEntry.id, {
          kindId: entryKindId,
          content,
          summary,
          importance: entryImportance,
        });
        setSuccess(true);
      }
      setTimeout(() => setSuccess(false), 2000);
      setEntryFormMode(null);
      setEditingEntry(null);
      await loadEntries();
    } catch (e: any) {
      setError(e?.message ?? t('memory.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (e: MemoryEntry) => {
    if (!confirm(t('memory.confirmDeleteEntry'))) return;
    try {
      await window.electron.deleteMemoryEntry(e.id, true);
      await loadEntries();
    } catch (err: any) {
      setError(err?.message ?? t('memory.errors.deleteFailed'));
    }
  };

  const getKindById = (id: string) => kinds.find((k) => k.id === id);
  const getEntryCountByKindId = (kindId: string) => entries.filter((e) => e.kindId === kindId).length;

  if (loading) {
    return (
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900">{t('memory.title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('memory.description')}</p>
        </header>
        <div className="text-center py-8 text-muted">{t('common.loading')}</div>
      </section>
    );
  }

  return (
    <TooltipProvider>
      <section className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900">{t('memory.title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('memory.description')}</p>
        </header>

        {/* 记忆种类 */}
        <div>
          <h2 className="text-sm font-semibold text-ink-700 mb-2">{t('memory.kinds.title')}</h2>
          <button
            type="button"
            className="w-full rounded-xl border-2 border-dashed border-ink-900/20 bg-surface-secondary px-4 py-3 text-sm font-medium text-accent hover:border-accent/50 hover:bg-accent/5 transition-colors"
            onClick={openAddKind}
          >
            <Plus className="w-4 h-4 inline-block mr-2 align-middle" strokeWidth={2} />
            {t('memory.kinds.addKind')}
          </button>

          {kinds.length === 0 ? (
            <div className="mt-3 text-center py-6 text-muted text-sm rounded-xl border border-ink-900/10 bg-surface">
              {t('memory.kinds.noKinds')}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {kinds.map((k) => (
                <div
                  key={k.id}
                  className="rounded-xl border border-ink-900/10 bg-surface p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-ink-900">{k.name}</h3>
                    {k.description && (
                      <p className="text-xs text-muted mt-0.5 truncate">{k.description}</p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {t('memory.kinds.entriesCount', { count: getEntryCountByKindId(k.id) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => openEditKind(k)}
                          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-surface-tertiary"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-tooltip-bg text-tooltip-fg text-xs px-2 py-1 rounded-md">
                        {t('memory.kinds.edit')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => deleteKind(k)}
                          className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error-light"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-tooltip-bg text-tooltip-fg text-xs px-2 py-1 rounded-md">
                        {t('memory.kinds.delete')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 种类 添加/编辑 表单 */}
          {(kindFormMode === 'add' || kindFormMode === 'edit') && (
            <div className="mt-4 rounded-xl border border-ink-900/10 bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-900">
                  {kindFormMode === 'add' ? t('memory.kinds.addKind') : t('memory.kinds.edit')}
                </h3>
                <button
                  type="button"
                  onClick={() => { setKindFormMode(null); setEditingKind(null); }}
                  className="p-1 rounded-full text-muted hover:bg-surface-tertiary"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.kinds.name')}</span>
                <input
                  type="text"
                  value={kindName}
                  onChange={(e) => setKindName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                  placeholder={t('memory.kinds.name')}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.kinds.description')}</span>
                <input
                  type="text"
                  value={kindDescription}
                  onChange={(e) => setKindDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                  placeholder={t('memory.kinds.description')}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setKindFormMode(null); setEditingKind(null); }}
                  className="px-3 py-2 rounded-lg border border-ink-900/10 text-sm text-ink-700"
                >
                  {t('memory.actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={saveKind}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? t('memory.actions.saving') : t('memory.actions.save')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 记忆条目 */}
        <div>
          <h2 className="text-sm font-semibold text-ink-700 mb-2">{t('memory.entries.title')}</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={entrySearchQuery}
              onChange={(e) => setEntrySearchQuery(e.target.value)}
              placeholder={t('memory.entries.searchPlaceholder')}
              className="flex-1 min-w-[120px] rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
            />
            <select
              value={entryFilterKindId}
              onChange={(e) => setEntryFilterKindId(e.target.value)}
              className="rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
            >
              <option value="">{t('memory.entries.allKinds')}</option>
              {kinds.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={openAddEntry}
              disabled={kinds.length === 0}
              className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2 text-sm font-medium text-accent hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 inline-block mr-1 align-middle" strokeWidth={2} />
              {t('memory.entries.addEntry')}
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm rounded-xl border border-ink-900/10 bg-surface">
              {t('memory.entries.noEntries')}
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((ent) => {
                const kind = getKindById(ent.kindId);
                const displayContent = (ent.summary || ent.content).slice(0, 80);
                return (
                  <div
                    key={ent.id}
                    className="rounded-lg border border-ink-900/10 bg-surface p-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900">{displayContent}{displayContent.length >= 80 ? '…' : ''}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {kind && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            {kind.name}
                          </span>
                        )}
                        <span className="text-xs text-muted">
                          {formatRelativeTime(ent.updatedAt ?? ent.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => openEditEntry(ent)}
                            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-surface-tertiary"
                          >
                            <Pencil className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-tooltip-bg text-tooltip-fg text-xs px-2 py-1 rounded-md">
                          {t('memory.kinds.edit')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => deleteEntry(ent)}
                            className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error-light"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-tooltip-bg text-tooltip-fg text-xs px-2 py-1 rounded-md">
                          {t('memory.actions.delete')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 条目 添加/编辑 表单 */}
          {(entryFormMode === 'add' || entryFormMode === 'edit') && (
            <div className="mt-4 rounded-xl border border-ink-900/10 bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-900">
                  {entryFormMode === 'add' ? t('memory.entries.addEntry') : t('memory.kinds.edit')}
                </h3>
                <button
                  type="button"
                  onClick={() => { setEntryFormMode(null); setEditingEntry(null); }}
                  className="p-1 rounded-full text-muted hover:bg-surface-tertiary"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.entries.kind')}</span>
                <select
                  value={entryKindId}
                  onChange={(e) => setEntryKindId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                >
                  {kinds.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.entries.content')}</span>
                <textarea
                  value={entryContent}
                  onChange={(e) => setEntryContent(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                  placeholder={t('memory.entries.content')}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.entries.summaryLabel')} <span className="text-error">*</span></span>
                <input
                  type="text"
                  value={entrySummary}
                  onChange={(e) => setEntrySummary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                  placeholder={t('memory.entries.summaryPlaceholder')}
                />
                <p className="mt-0.5 text-[10px] text-muted">{t('memory.entries.summaryHint')}</p>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted">{t('memory.entries.importance')}</span>
                <select
                  value={entryImportance}
                  onChange={(e) => setEntryImportance(e.target.value as MemoryEntry['importance'])}
                  className="mt-1 w-full rounded-lg border border-ink-900/10 bg-surface-secondary px-3 py-2 text-sm text-ink-800"
                >
                  <option value="low">{t('memory.entries.importanceLow')}</option>
                  <option value="medium">{t('memory.entries.importanceMedium')}</option>
                  <option value="high">{t('memory.entries.importanceHigh')}</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setEntryFormMode(null); setEditingEntry(null); }}
                  className="px-3 py-2 rounded-lg border border-ink-900/10 text-sm text-ink-700"
                >
                  {t('memory.actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={saveEntry}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? t('memory.actions.saving') : t('memory.actions.save')}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-error/20 bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-success/20 bg-success-light px-3 py-2 text-sm text-success">
            {t('memory.success')}
          </div>
        )}

        <aside className="p-4 rounded-xl bg-surface-secondary border border-ink-900/5">
          <p className="text-xs text-muted">{t('memory.hint')}</p>
        </aside>
      </section>
    </TooltipProvider>
  );
}
