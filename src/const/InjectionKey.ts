import type {InjectionKey, Ref} from 'vue'
import {RssInfoItem} from "src/common/RssInfoItem";

export const TOGGLE_LAYOUT_LEFT_DRAWER_REF = Symbol() as InjectionKey<Ref<boolean>> // Layout控制左侧抽屉的ref变量
export const TOGGLE_LAYOUT_LEFT_DRAWER_FUNC = Symbol() as InjectionKey<() => void> // Layout控制左侧抽屉ref的方法
export const SUBSCRIBE_DIALOG_REF = Symbol() as InjectionKey<Ref<boolean>> // 是否显示增加订阅的弹窗
export const RSS_INFO_LIST_REF = Symbol() as InjectionKey<Ref<RssInfoItem[]>> // 左侧抽屉rss订阅源列表的数据

