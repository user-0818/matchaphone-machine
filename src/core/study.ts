/* ============================================================
   学习 App 的骨架数据层
   —— 这一版只搭框架：科目、任务、监督员、角色学习材料的数据结构先立住，
      具体的知识内容与提示词注入暂时留空（按需求“内容先不注入”）。
   —— 数据仍然存在 settings 表（key: study），不新增数据库表，升级零风险。
   ============================================================ */

import { getSetting, setSetting } from "./db";

export type StudySubjectId = "chinese" | "math" | "english" | "geography" | "physics" | "chemistry" | "biology";

/** both = 你学、角色监督；character = 只有角色自己在学，你不需要管 */
export type StudyScope = "both" | "character";

export interface StudySubjectMeta {
  id: StudySubjectId;
  name: string;
  scope: StudyScope;
  group: "core" | "minor";
  /** 一句话说明，显示在卡片上 */
  hint: string;
}

/** 科目表：以后要加科目只改这里，页面会自动跟着长 */
export const STUDY_SUBJECTS: StudySubjectMeta[] = [
  { id: "chinese", name: "语文", scope: "both", group: "core", hint: "背书 · 阅读 · 作文" },
  { id: "math", name: "数学", scope: "both", group: "core", hint: "刷题 · 错题本" },
  { id: "english", name: "英语", scope: "both", group: "core", hint: "单词 · 听力 · 语法" },
  { id: "geography", name: "地理", scope: "both", group: "minor", hint: "地图 · 区域" },
  { id: "physics", name: "物理", scope: "character", group: "minor", hint: "只有角色在学" },
  { id: "chemistry", name: "化学", scope: "character", group: "minor", hint: "只有角色在学" },
  { id: "biology", name: "生物", scope: "character", group: "minor", hint: "只有角色在学" }
];

export const findStudySubject = (id?: string) => STUDY_SUBJECTS.find((item) => item.id === id);

/* ---------- 数据 ---------- */

/** 一条学习任务（你给自己排的） */
export interface StudyTask {
  id: string;
  subjectId: StudySubjectId;
  title: string;
  done: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

/** 角色自己学出来的材料：卷子手写图、笔记截图等 */
export interface StudyMaterial {
  id: string;
  subjectId: StudySubjectId;
  title: string;
  note?: string;
  imageUrl?: string;
  createdAt: number;
}

export interface StudyData {
  tasks: StudyTask[];
  /** 每科指定哪个角色来监督：subjectId -> characterId */
  supervisors: Partial<Record<StudySubjectId, string>>;
  materials: StudyMaterial[];
}

const STORE_KEY = "study";
const emptyStudy = (): StudyData => ({ tasks: [], supervisors: {}, materials: [] });

let cache: StudyData = emptyStudy();

export const studyCache = (): StudyData => cache;

export async function loadStudy(): Promise<StudyData> {
  const stored = await getSetting<StudyData>(STORE_KEY, emptyStudy());
  cache = {
    tasks: Array.isArray(stored?.tasks) ? stored.tasks : [],
    supervisors: stored?.supervisors && typeof stored.supervisors === "object" ? stored.supervisors : {},
    materials: Array.isArray(stored?.materials) ? stored.materials : []
  };
  return cache;
}

export async function persistStudy(next: StudyData): Promise<void> {
  cache = next;
  await setSetting(STORE_KEY, next);
}

/* ---------- 小工具 ---------- */

const pad2 = (value: number) => String(value).padStart(2, "0");

export const studyTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** 某科今天的任务 */
export const todayTasksOf = (data: StudyData, subjectId: StudySubjectId, today = studyTodayKey()) =>
  data.tasks.filter((task) => task.subjectId === subjectId && task.date === today);

/** 主科今天完成了几科（有任务且全部勾完才算完成） */
export const coreDoneCount = (data: StudyData, today = studyTodayKey()) =>
  STUDY_SUBJECTS.filter((subject) => subject.group === "core").filter((subject) => {
    const tasks = todayTasksOf(data, subject.id, today);
    return tasks.length > 0 && tasks.every((task) => task.done);
  }).length;

/* ============================================================
   给角色用的上下文 —— 预留位
   ------------------------------------------------------------
   这一版按需求“具体内容先不注入”，所以函数先留在这里、暂不接进
   context.ts。等学习内容/监督规则定下来，再在 context.ts 的 system 数组里
   加一行 studyContextBlock(studyCache(), ...) 即可，不用再动数据结构。
   ============================================================ */
export function studyContextBlock(_data: StudyData = cache, _today: string = studyTodayKey()): string {
  // TODO（下一版）：把「今天哪几科还没学完、监督员是谁、角色的学习进度」写成给角色看的句子。
  return "";
}
