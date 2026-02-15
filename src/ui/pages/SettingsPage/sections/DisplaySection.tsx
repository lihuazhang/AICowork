/**
 * 显示设置区域
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../../store/useAppStore";
import { Sun, Moon, Monitor } from "lucide-react";

type ThemePreference = "system" | "dark" | "light";

/**
 * 主题预览缩略图 — 纯 CSS 画的界面色块
 */
function ThemePreview({ variant }: { variant: "light" | "dark" | "split" }) {
  const lightBg = "#FAF9F6";
  const lightSidebar = "#EFEEE9";
  const lightText = "#1A1915";
  const lightMuted = "#9B9B96";

  const darkBg = "#1A1915";
  const darkSidebar = "#242320";
  const darkText = "#F5F4F1";
  const darkMuted = "#555450";

  const renderHalf = (bg: string, sidebar: string, text: string, muted: string) => (
    <>
      {/* 侧边栏 */}
      <div className="absolute left-0 top-0 bottom-0 w-[30%] rounded-l-md" style={{ background: sidebar }} />
      {/* 主区域 */}
      <div className="absolute left-[30%] top-0 right-0 bottom-0 rounded-r-md p-1.5" style={{ background: bg }}>
        {/* 文字条 */}
        <div className="h-1 w-[70%] rounded-full mb-1" style={{ background: text, opacity: 0.7 }} />
        <div className="h-1 w-[50%] rounded-full mb-1" style={{ background: muted, opacity: 0.5 }} />
        <div className="h-1 w-[60%] rounded-full" style={{ background: muted, opacity: 0.3 }} />
      </div>
    </>
  );

  if (variant === "light") {
    return (
      <div className="relative w-full h-10 rounded-md overflow-hidden border border-ink-900/10">
        {renderHalf(lightBg, lightSidebar, lightText, lightMuted)}
      </div>
    );
  }

  if (variant === "dark") {
    return (
      <div className="relative w-full h-10 rounded-md overflow-hidden border border-ink-900/10">
        {renderHalf(darkBg, darkSidebar, darkText, darkMuted)}
      </div>
    );
  }

  // split: 左亮右暗
  return (
    <div className="relative w-full h-10 rounded-md overflow-hidden border border-ink-900/10">
      <div className="absolute left-0 top-0 bottom-0 w-1/2 overflow-hidden">
        <div className="relative w-[200%] h-full">
          {renderHalf(lightBg, lightSidebar, lightText, lightMuted)}
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden">
        <div className="relative w-[200%] h-full" style={{ marginLeft: "-100%" }}>
          {renderHalf(darkBg, darkSidebar, darkText, darkMuted)}
        </div>
      </div>
    </div>
  );
}

export function DisplaySection() {
  const { t } = useTranslation();
  const showTokenUsage = useAppStore((state) => state.showTokenUsage);
  const showSystemMessage = useAppStore((state) => state.showSystemMessage);
  const setShowTokenUsage = useAppStore((state) => state.setShowTokenUsage);
  const setShowSystemMessage = useAppStore((state) => state.setShowSystemMessage);

  const [theme, setTheme] = useState<ThemePreference>("system");

  // 启动时读取已保存的主题偏好
  useEffect(() => {
    (window as any).electron?.getTheme?.().then((saved: ThemePreference) => {
      if (saved) setTheme(saved);
    }).catch(() => {});
  }, []);

  const handleThemeChange = async (newTheme: ThemePreference) => {
    setTheme(newTheme);
    try {
      await (window as any).electron?.setTheme?.(newTheme);
    } catch (error) {
      console.error("Failed to set theme:", error);
    }
  };

  const themeOptions: { id: ThemePreference; icon: typeof Sun; preview: "light" | "dark" | "split" }[] = [
    { id: "light", icon: Sun, preview: "light" },
    { id: "dark", icon: Moon, preview: "dark" },
    { id: "system", icon: Monitor, preview: "split" },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">{t('display.title')}</h1>
        <p className="mt-2 text-sm text-muted">
          {t('display.description')}
        </p>
      </header>

      {/* 主题选择器 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-ink-900">{t('display.theme.title')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ id, icon: Icon, preview }) => {
            const isActive = theme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeChange(id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'border-accent bg-accent-subtle'
                    : 'border-ink-900/10 hover:border-ink-900/20 bg-surface'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-ink-600'}`} strokeWidth={2} />
                <ThemePreview variant={preview} />
                <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-ink-700'}`}>
                  {t(`display.theme.${id}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {/* Token 耗时信息开关 */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-ink-900/10 bg-surface">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ink-900">{t('display.tokenUsage.title')}</h3>
            <p className="mt-1 text-xs text-muted">{t('display.tokenUsage.description')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showTokenUsage}
            onClick={() => setShowTokenUsage(!showTokenUsage)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
              showTokenUsage 
                ? 'bg-accent border-accent' 
                : 'bg-ink-400 border-ink-400'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out ${
                showTokenUsage 
                  ? 'translate-x-5 bg-white' 
                  : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>

        {/* 系统环境消息开关 */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-ink-900/10 bg-surface">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-ink-900">{t('display.systemMessage.title')}</h3>
            <p className="mt-1 text-xs text-muted">{t('display.systemMessage.description')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showSystemMessage}
            onClick={() => setShowSystemMessage(!showSystemMessage)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
              showSystemMessage 
                ? 'bg-accent border-accent' 
                : 'bg-ink-400 border-ink-400'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out ${
                showSystemMessage 
                  ? 'translate-x-5 bg-white' 
                  : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>
      </div>

      <aside className="p-4 rounded-xl bg-surface-secondary border border-ink-900/5">
        <p className="text-xs text-muted">
          <strong>{t('display.hint.label')}：</strong>{t('display.hint.text')}
        </p>
      </aside>
    </section>
  );
}
