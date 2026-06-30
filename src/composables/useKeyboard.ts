/**
 * useKeyboard — 键盘快捷键管理
 */
import { ref, computed, type Ref } from "vue";

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
	const shortcuts: Ref<KeyboardShortcut[]> = ref([]);
	const isEnabled = ref(true);
	const enabledShortcuts = computed(() =>
		shortcuts.value.filter((s) => isEnabled.value),
	);

	const register = (s: KeyboardShortcut) => {
		if (!shortcuts.value.some((x) => x.id === s.id)) shortcuts.value.push(s);
	};
	const unregister = (id: string) => {
		const i = shortcuts.value.findIndex((s) => s.id === id);
		if (i > -1) shortcuts.value.splice(i, 1);
	};

	const execute = (event: KeyboardEvent) => {
		if (!isEnabled.value) return;
		const target = event.target as HTMLElement;
		if (
			(target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.contentEditable === "true") &&
			!(event.ctrlKey && event.key === "f")
		)
			return;
		const keys: string[] = [];
		if (event.ctrlKey || event.metaKey) keys.push("ctrl");
		if (event.altKey) keys.push("alt");
		if (event.shiftKey) keys.push("shift");
		keys.push(event.key.toLowerCase());
		const matched = shortcuts.value.find(
			(s) =>
				s.keys.every((k) => keys.includes(k)) && s.keys.length === keys.length,
		);
		if (matched) {
			event.preventDefault();
			event.stopPropagation();
			matched.action();
		}
	};

	const registerShortcut = register;
	const registerShortcuts = (list: KeyboardShortcut[]) => {
		for (const s of list) register(s);
	};
	const getHelp = () =>
		shortcuts.value.map((s) => ({
			label: s.label,
			keys: s.keys.join("+").toUpperCase(),
			description: s.description,
		}));
	const clearAll = () => {
		shortcuts.value = [];
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
