/**
 * 主题偏好持久化存储
 * 保存和读取用户的主题选择（system / dark / light）
 */

import { app } from "electron";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { log } from "../logger.js";

export type ThemePreference = "system" | "dark" | "light";

const THEME_FILE_NAME = "theme-preference.json";

function getThemePath(): string {
    return join(app.getPath("userData"), THEME_FILE_NAME);
}

/**
 * 读取保存的主题偏好
 * 默认返回 "system"
 */
export function loadThemePreference(): ThemePreference {
    try {
        const themePath = getThemePath();
        if (!existsSync(themePath)) {
            return "system";
        }
        const raw = readFileSync(themePath, "utf8");
        const data = JSON.parse(raw);
        if (data.theme === "dark" || data.theme === "light" || data.theme === "system") {
            return data.theme;
        }
        return "system";
    } catch (error) {
        log.error("[theme-store] Failed to load theme preference:", error);
        return "system";
    }
}

/**
 * 保存主题偏好
 */
export function saveThemePreference(theme: ThemePreference): void {
    try {
        const themePath = getThemePath();
        writeFileSync(themePath, JSON.stringify({ theme }, null, 2), "utf8");
        log.info(`[theme-store] Theme preference saved: ${theme}`);
    } catch (error) {
        log.error("[theme-store] Failed to save theme preference:", error);
    }
}
