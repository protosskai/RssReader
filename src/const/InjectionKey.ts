import type {InjectionKey, Ref} from 'vue'

export const TOGGLE_LAYOUT_LEFT_DRAWER_REF = Symbol() as InjectionKey<Ref<boolean>> // Layout控制左侧抽屉的ref变量
export const TOGGLE_LAYOUT_LEFT_DRAWER_FUNC = Symbol() as InjectionKey<() => void> // Layout控制左侧抽屉ref的方法
export const SUBSCRIBE_DIALOG_REF = Symbol() as InjectionKey<Ref<boolean>> // 是否显示增加订阅的弹窗

