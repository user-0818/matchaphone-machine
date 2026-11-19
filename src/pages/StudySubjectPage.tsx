import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { AppTopBar } from "../components/ui";
import { useStore } from "../core/store";
import {
  STUDY_MATERIAL_KINDS,
  findStudySubject,
  interactionsOf,
  loadStudy,
  materialsOf,
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
   - 每科都能排今天的任务、指定谁来监督
   - 每科都能看到角色留下的三类东西：做过的卷子 / 学习痕迹 / 错题本
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
  const today = studyTodayKey();
  const tasks = data ? todayTasksOf(data, subjectId, today) : [];
  const supervisorId = data?.supervisors?.[subjectId];
  const supervisorName = supervisorId ? characters.find((item) => item.id === supervisorId)?.name : "";

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
        {meta.scope !== "character" && (
          <>
          <h3 className="study-section-title">今天的{meta.name}任务</h3>
          {data && tasks.length === 0 && (
            <p className="study-note">
              今天还没有安排。写一条就好，短到能勾掉就行。
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
          </>
        )}

        <h3 className="study-section-title">{meta.scope === "character" ? "谁在学这一科" : "谁来监督这一科"}</h3>
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

        <h3 className="study-section-title">
          {supervisorName ? `${supervisorName}留下的` : "角色留下的"}
        </h3>
        {STUDY_MATERIAL_KINDS.map((kind) => {
          const items = materialsOf(data, subjectId, kind.id);
          return (
            <section className="study-material-group" key={kind.id}>
              <h4>
                {kind.name}
                {items.length > 0 && <em>{items.length}</em>}
              </h4>
              {items.length === 0 ? (
                <p className="study-material-empty">{kind.empty}</p>
              ) : (
                <div className="study-materials">
                  {items.map((item) => (
                    <div className="study-material" key={item.id}>
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" /> : null}
                      <span>
                        <b>{item.title}</b>
                        {item.note ? <small>{item.note}</small> : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {subjectId !== "biology" && <h3 className="study-section-title">角色之间</h3>}
        {subjectId !== "biology" && (() => {
          const items = interactionsOf(data, subjectId);
          if (items.length === 0) {
            return (
              <p className="study-material-empty">
                角色会互相出题、互相答题批改，{meta.name}上的往来会记在这里。
              </p>
            );
          }
          return (
            <div className="study-materials">
              {items.map((item) => {
                const from = characters.find((c) => c.id === item.fromCharacterId)?.name ?? "角色";
                const to = characters.find((c) => c.id === item.toCharacterId)?.name ?? "角色";
                return (
                  <div className="study-material" key={item.id}>
                    <span>
                      <b>{from} → {to}</b>
                      <small>{item.title}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
