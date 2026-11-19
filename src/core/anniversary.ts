import { getSetting, setSetting } from "./db";

/* ============================================================
   纪念日：数据层 + 给角色用的上下文文案
   数据存在 settings 表（key: anniversaries），同时维护一份内存缓存，
   这样上下文构建（同步函数）也能拿到，不用改成异步。
   ============================================================ */

export type AnniversaryMode = "countdown" | "since";

/** none=只算这一次；yearly=每年同月同日；monthly=每月同一日 */
export type AnniversaryRepeat = "none" | "yearly" | "monthly";

export interface AnniversaryItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  mode: AnniversaryMode;
  repeat?: AnniversaryRepeat;
  note?: string;
  createdAt: number;
}

const STORE_KEY = "anniversaries";

/** 内存缓存：store.reload 时从库里灌一次 */
let cache: AnniversaryItem[] = [];

export const anniversaryCache = (): AnniversaryItem[] => cache;

/* ---------- 日期换算 ---------- */
const pad2 = (value: number) => String(value).padStart(2, "0");

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const parseAnniversaryDate = (value: string): Date | null => {
  const parts = value.split("-").map((item) => Number(item));
  if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 目标日期相对今天的天数差：未来为正，过去为负 */
export const anniversaryDayDiff = (value: string, today: Date = new Date()) => {
  const target = parseAnniversaryDate(value);
  if (!target) return 0;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86400000);
};

const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * 这一次/下一次「到点」的日期。
 * - 不重复：就是原始日期
 * - 每年：今年同月同日；今年已过就顺到明年（2/29 落在平年时收到 2/28）
 * - 每月：本月同一日；本月已过就顺到下个月（31 号落在小月时收到当月最后一天）
 */
export const anniversaryNextDate = (item: AnniversaryItem, today: Date = new Date()): Date | null => {
  const base = parseAnniversaryDate(item.date);
  if (!base) return null;
  const repeat = item.repeat ?? "none";
  if (repeat === "none") return base;

  const now = startOfDay(today);
  if (repeat === "yearly") {
    const month = base.getMonth();
    const day = base.getDate();
    for (let year = today.getFullYear(); year <= today.getFullYear() + 4; year += 1) {
      const candidate = new Date(year, month, Math.min(day, daysInMonth(year, month)));
      if (candidate.getTime() >= now.getTime()) return candidate;
    }
    return base;
  }
  // monthly
  const day = base.getDate();
  for (let offset = 0; offset < 14; offset += 1) {
    const probe = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const candidate = new Date(probe.getFullYear(), probe.getMonth(), Math.min(day, daysInMonth(probe.getFullYear(), probe.getMonth())));
    if (candidate.getTime() >= now.getTime()) return candidate;
  }
  return base;
};

/** 距离「下一次」还有几天（0 = 今天，负数不会出现，循环类日子永远向前滚） */
export const anniversaryDaysTo = (item: AnniversaryItem, today: Date = new Date()) => {
  const next = anniversaryNextDate(item, today);
  if (!next) return 0;
  return Math.round((next.getTime() - startOfDay(today).getTime()) / 86400000);
};

export const anniversaryDateText = (value: string) => {
  const date = parseAnniversaryDate(value);
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` : value;
};

/** 卡片上显示的大字和小字 */
export const anniversarySummary = (item: AnniversaryItem, today: Date = new Date()) => {
  const repeat = item.repeat ?? "none";
  // 循环类日子（每年/每月）只算「下一次还有几天」，永远向前滚
  if (repeat !== "none" && item.mode === "countdown") {
    const diff = anniversaryDaysTo(item, today);
    if (diff === 0) return { number: "今天", caption: "就是这一天" };
    return { number: String(diff), caption: `天后 · ${repeat === "yearly" ? "每年" : "每月"}` };
  }
  const diff = anniversaryDayDiff(item.date, today);
  if (item.mode === "countdown") {
    if (diff > 0) return { number: String(diff), caption: "天后" };
    if (diff === 0) return { number: "今天", caption: "就是这一天" };
    return { number: String(-diff), caption: "天前已过去" };
  }
  if (diff > 0) return { number: String(diff), caption: "天后开始" };
  return { number: String(-diff + 1), caption: `第 ${-diff + 1} 天` };
};

/** 卡片上显示的那一行日期文字（循环类显示下一次的具体日期） */
export const anniversaryWhenText = (item: AnniversaryItem, today: Date = new Date()) => {
  const repeat = item.repeat ?? "none";
  if (repeat === "none" || item.mode !== "countdown") return anniversaryDateText(item.date);
  const next = anniversaryNextDate(item, today);
  if (!next) return anniversaryDateText(item.date);
  return `${next.getFullYear()}年${next.getMonth() + 1}月${next.getDate()}日`;
};

/* ---------- 读写 ---------- */
export async function loadAnniversaries(): Promise<AnniversaryItem[]> {
  const stored = await getSetting<AnniversaryItem[]>(STORE_KEY, []);
  cache = Array.isArray(stored) ? stored : [];
  return cache;
}

export async function persistAnniversaries(items: AnniversaryItem[]): Promise<void> {
  cache = items;
  await setSetting(STORE_KEY, items);
}

/* ---------- 给角色的上下文 ---------- */
/**
 * 这些文字会拼进角色的系统提示里，让角色能自然地引用纪念日。
 * 只给最近的几条，避免上下文膨胀。
 */
export function anniversaryContextBlock(items: AnniversaryItem[], today: Date = new Date(), limit = 6): string {
  if (!items.length) return "";
  const sorted = [...items].sort(
    (a, b) => Math.abs(anniversaryDayDiff(a.date, today)) - Math.abs(anniversaryDayDiff(b.date, today))
  );
  const lines = sorted.slice(0, limit).map((item) => {
    const diff = (item.repeat ?? "none") !== "none" && item.mode === "countdown"
      ? anniversaryDaysTo(item, today)
      : anniversaryDayDiff(item.date, today);
    const when = anniversaryWhenText(item, today);
    const tone =
      item.mode === "countdown"
        ? diff > 0
          ? `还有 ${diff} 天`
          : diff === 0
            ? "就是今天"
            : `已经过去 ${-diff} 天`
        : diff >= 0
          ? `已经第 ${-diff + 1} 天`
          : `还有 ${diff} 天开始`;
    const repeatText = item.repeat === "yearly" ? "，每年" : item.repeat === "monthly" ? "，每月" : "";
    return `- ${item.title}：${when}，${tone}${repeatText}${item.note ? `（${item.note}）` : ""}`;
  });
  return [
    "纪念日（用户在手机上记下的日子，属于你和用户之间的关系背景）：",
    ...lines,
    "使用规则：可以在合适的时候自然带一句，像真的记得这些日子；不要机械罗列，不要说明这是系统或应用里的数据，也不要假装能替用户修改它们。"
  ].join("\n");
}
