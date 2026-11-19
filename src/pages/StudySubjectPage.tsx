import { useEffect, useState } from "react";
import { Check, FileImage, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AppTopBar, Empty } from "../components/ui";
import { useStore } from "../core/store";
import {
  findStudySubject,
  loadStudy,
  persistStudy,
  studyTodayKey,
  todayTasksOf,
  type StudyData,
  type StudySubjectId
} from "../core/study";
import { now, uid } from "../core/types";
import "./StudyPage.css";

/* ============================================================
   单个科目专区
   - 主科 / 地理：任务清单 + 监督员选择（你学，角色监督）
   - 物理 / 化学 / 生物：只有角色在学，留给角色生成材料的空间
   ============================================================ */

export default function StudySubjectPage() {
  const nav = useNavigate();
  const { subject: subjectParam } = useParams();
  const meta = findStudySubject(subjectParam as StudySubjectId);
  const characters = useStore((state) => state.characters);
  const [data, setData] = useState<StudyData | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadStudy().then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!meta) {
    return (
      <div className="app-page study-page">
        <AppTopBar title="学习" backLabel="返回" onBack={() => nav("/study")} />
        <main className="study-scroll">
          <p className="study-note">没有这个科目，回学习首页看看。</p>
        </main>
      </div>
    );
  }

  const save = async (next: StudyData) => {
    setData(next);
    await persistStudy(next);
  };

  const subjectId = meta.id;
  const isCharacterOnly = meta.scope === "character";
  const today = studyTodayKey();
  const tasks = data ? todayTasksOf(data, subjectId, today) : [];
  const supervisorId = data?.supervisors?.[subjectId];
  const supervisorName = supervisorId ? characters.find((item) => item.id === supervisorId)?.name : "";
  const materials = data?.materials.filter((item) => item.subjectId === subjectId) ?? [];

  const addTask = async () => {
    const value = draft.trim();
    if (!data || !value) return;
    await save({
      ...data,
      tasks: [
        ...data.tasks,
        { id: uid(), subjectId, title: value, done: false, date: today, createdAt: now() }
      ]
    });
    setDraft("");
  };

  const toggleTask = async (id: string) => {
    if (!data) return;
    await save({
      ...data,
      tasks: data.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    });
  };

  const removeTask = async (id: string) => {
    if (!data) return;
    await save({ ...data, tasks: data.tasks.filter((task) => task.id !== id) });
  };

  const chooseSupervisor = async (characterId: string) => {
    if (!data) return;
    const supervisors = { ...data.supervisors };
    if (supervisors[subjectId] === characterId) {
      delete supervisors[subjectId];
    } else {
      supervisors[subjectId] = characterId;
    }
    await save({ ...data, supervisors });
  };

  return (
    <div className="app-page study-page">
      <AppTopBar title={meta.name} backLabel="返回学习" onBack={() => nav("/study")} />

      <main className="study-scroll">
        {isCharacterOnly ? (
          <>
            <p className="study-note">
              这一科<b>只有 {supervisorName || "角色"} 自己在学</b>，你不用学、也不用监督。
              这里只放角色学出来的东西：它写的卷子、手写笔记、错题整理，会以图片形式出现在下面。
            </p>

            {materials.length === 0 ? (
              <Empty
                icon={<FileImage />}
                title="还没有材料"
                text={`等 ${supervisorName || "角色"} 把 ${meta.name} 的卷子写出来，这里就有东西看了。`}
              />
            ) : (
              <div className="study-materials">
                {materials.map((item) => (
                  <div className="study-material" key={item.id}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : null}
                    <span>
                      <b>{item.title}</b>
                      {item.note ? <small>{item.note}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button type="button" className="study-disabled" disabled>
              <Plus size={14} />
              让角色出一份{meta.name}卷子（生成能力待接入）
            </button>

            <h3 className="study-section-title">谁在学这一科</h3>
            <div className="study-chips">
              {characters.length === 0 && <span className="study-card-hint">先去「角色」页建一个角色</span>}
              {characters.map((character) => (
                <button
                  type="button"
                  key={character.id}
                  className={supervisorId === character.id ? "active" : ""}
                  onClick={() => void chooseSupervisor(character.id)}
                >
                  {character.name}
                </button>
              ))}
            </div>
            <p className="study-note">
              选定之后，这一科就记为 TA 在学习；角色的学习进度、生成材料的能力后续再接。
            </p>
          </>
        ) : (
          <>
            <h3 className="study-section-title">今天的{meta.name}任务</h3>
            {data && tasks.length === 0 && (
              <p className="study-note">
                今天还没有安排。写一条就好，比如「背《岳阳楼记》第一段」这样能勾掉的短句。
              </p>
            )}
            <div>
              {tasks.map((task) => (
                <div className={`study-task ${task.done ? "done" : ""}`} key={task.id}>
                  <button type="button" className="check" aria-label="勾选完成" onClick={() => void toggleTask(task.id)}>
                    <Check />
                  </button>
                  <span className="title">{task.title}</span>
                  <button type="button" className="trash" aria-label="删除任务" onClick={() => void removeTask(task.id)}>
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>

            <div className="study-add">
              <input
                value={draft}
                maxLength={30}
                placeholder={`写一条${meta.name}任务`}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void addTask();
                }}
              />
              <button type="button" onClick={() => void addTask()}>
                添加
              </button>
            </div>

            <h3 className="study-section-title">谁来监督这一科</h3>
            <div className="study-chips">
              {characters.length === 0 && <span className="study-card-hint">先去「角色」页建一个角色</span>}
              {characters.map((character) => (
                <button
                  type="button"
                  key={character.id}
                  className={supervisorId === character.id ? "active" : ""}
                  onClick={() => void chooseSupervisor(character.id)}
                >
                  {character.name}
                </button>
              ))}
            </div>

            <p className="study-note">
              监督员已经选好就够了：任务清单、完成状态都会存下来。
              <b>真正让角色开口管你，需要把这份数据和提示词接起来</b>，按你的要求这一步先留着，内容先不注入。
            </p>
          </>
        )}
      </main>
    </div>
  );
}
