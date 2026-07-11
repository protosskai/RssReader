/**
 * useKeyboard — 键盘快捷键管理
 */
import { ref, computed, type Ref } from "vue";
import { useKeyboardStore } from '../stores/keyboardStore';

export interface KeyboardShortcut {
	id: string;
	label: string;
	keys: string[];
	description: string;
	action: () => void;
	global?: boolean;
}

/** Predefined shortcut key combinations */
export const SHORTCUT_KEYS = {
	HELP: ["ctrl", "shift", "?"],
	SYNC: ["ctrl", "s"],
	SEARCH: ["ctrl", "f"],
	SETTINGS: ["ctrl", ","],
	NEW_SUBSCRIPTION: ["ctrl", "n"],
	TOGGLE_DARK_MODE: ["ctrl", "d"],
	REFRESH: ["ctrl", "r"],
} as const;

export interface ShortcutActions {
	onSync?: () => void;
	onSearch?: () => void;
	onSettings?: () => void;
	onNewSubscription?: () => void;
	onToggleDarkMode?: () => void;
	onRefresh?: () => void;
}

/** Create default shortcuts from action callbacks (all optional) */
export function createDefaultShortcuts(
	actions: ShortcutActions,
): KeyboardShortcut[] {
	const s: KeyboardShortcut[] = [];
	if (actions.onSync)
		s.push({
			id: "sync",
			label: "同步",
			keys: [...SHORTCUT_KEYS.SYNC],
			description: "同步所有RSS源",
			action: actions.onSync,
		});
	if (actions.onSearch)
		s.push({
			id: "search",
			label: "搜索",
			keys: [...SHORTCUT_KEYS.SEARCH],
			description: "搜索文章",
			action: actions.onSearch,
		});
	if (actions.onSettings)
		s.push({
			id: "settings",
			label: "设置",
			keys: [...SHORTCUT_KEYS.SETTINGS],
			description: "打开设置",
			action: actions.onSettings,
		});
	if (actions.onNewSubscription)
		s.push({
			id: "new",
			label: "新建订阅",
			keys: [...SHORTCUT_KEYS.NEW_SUBSCRIPTION],
			description: "添加新订阅源",
			action: actions.onNewSubscription,
		});
	if (actions.onToggleDarkMode)
		s.push({
			id: "dark",
			label: "暗色模式",
			keys: [...SHORTCUT_KEYS.TOGGLE_DARK_MODE],
			description: "切换暗色/亮色模式",
			action: actions.onToggleDarkMode,
		});
	if (actions.onRefresh)
		s.push({
			id: "refresh",
			label: "刷新",
			keys: [...SHORTCUT_KEYS.REFRESH],
			description: "刷新当前页面",
			action: actions.onRefresh,
		});
	return s;
}

export function useKeyboard() {
	const store = useKeyboardStore();

	const shortcuts = computed(() => store.shortcuts);
	const isEnabled = computed({
		get: () => store.isEnabled,
		set: (val) => { store.isEnabled = val; }
	});
	const enabledShortcuts = computed(() => store.enabledShortcuts);

	const register = (s: KeyboardShortcut) => {
		store.registerShortcut(s);
	};
	const unregister = (id: string) => {
		store.unregisterShortcut(id);
	};

	const execute = (event: KeyboardEvent) => {
		store.executeShortcut(event);
	};

	const registerShortcut = register;
	const registerShortcuts = (list: KeyboardShortcut[]) => {
		for (const s of list) store.registerShortcut(s);
	};
	const getHelp = () => store.getShortcutHelp();
	const clearAll = () => {
		store.clearAllShortcuts();
	};

	return {
		shortcuts,
		isEnabled,
		enabledShortcuts,
		register,
		registerShortcut,
		registerShortcuts,
		unregister,
		execute,
		getHelp,
		clearAll,
	};
}
