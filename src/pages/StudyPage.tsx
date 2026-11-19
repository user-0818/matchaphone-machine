import { useEffect, useMemo, useState } from "react";
import { ChevronRight, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppTopBar } from "../components/ui";
import { useStore } from "../core/store";
import { STUDY_SUBJECTS, coreDoneCount, loadStudy, studyTodayKey, todayTasksOf, type StudyData } from "../core/study";
import "./StudyPage.css";

/* ============================================================
   学习 App 首页（科目总览）
   —— 只搭框架：科目分区、今日进度、监督员入口；
      具体的学习内容、题库、提示词注入先留空。
   ============================================================ */

export default function StudyPage() {
  const nav = useNavigate();
  const characters = useStore((state) => state.characters);
  const [data, setData] = useState<StudyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStudy().then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const coreSubjects = useMemo(() => STUDY_SUBJECTS.filter((item) => item.group === "core"), []);
  const minorSubjects = useMemo(() => STUDY_SUBJECTS.filter((item) => item.group === "minor"), []);
  const doneCount = data ? coreDoneCount(data) : 0;

  const supervisorName = (subjectId: string) => {
    const id = data?.supervisors?.[subjectId as keyof StudyData["supervisors"]];
    if (!id) return "";
    return characters.find((item) => item.id === id)?.name ?? "";
  };

  const today = studyTodayKey();
  const todayText = `${new Date().getMonth() + 1}月${new Date().getDate()}日`;

  return (
    <div className="app-page study-page">
      <AppTopBar title="学习" backLabel="返回桌面" onBack={() => nav("/")} />

      <main className="study-scroll">
        <section className="study-today">
          <div>
            <b>今天 {todayText}</b>
            <small>
              {data && data.tasks.length
                ? "勾完一科的任务，就算这科今天完成了"
                : "还没有排任务，先给主科各写一条"}
            </small>
          </div>
          <strong>
            {doneCount}/3
          </strong>
        </section>

        <h3 className="study-section-title">
          <GraduationCap size={13} />
          主科专区 <em>你学，角色监督</em>
        </h3>
        <div className="study-grid core">
          {coreSubjects.map((subject) => {
            const tasks = data ? todayTasksOf(data, subject.id) : [];
            const finished = tasks.filter((task) => task.done).length;
            const supervisor = supervisorName(subject.id);
            return (
              <button
                type="button"
                key={subject.id}
                className="study-card"
                onClick={() => nav(`/study/${subject.id}`)}
              >
                <span className="study-card-head">
                  <b>{subject.name}</b>
                  {supervisor ? <span className="study-badge accent">{supervisor}监督</span> : null}
                  <ChevronRight size={15} style={{ marginLeft: "auto", opacity: 0.4 }} />
                </span>
                <span className="study-card-hint">{subject.hint}</span>
                <span className="study-card-foot">
                  <strong>
                    {finished}/{tasks.length || 0}
                  </strong>
                  今日任务
                </span>
              </button>
            );
          })}
        </div>

        <h3 className="study-section-title">
          副科 <em>地理你也能学，理化生只有角色在学</em>
        </h3>
        <div className="study-grid">
          {minorSubjects.map((subject) => {
            const isCharacterOnly = subject.scope === "character";
            const tasks = data && !isCharacterOnly ? todayTasksOf(data, subject.id) : [];
            return (
              <button
                type="button"
                key={subject.id}
                className={`study-card ${isCharacterOnly ? "character" : ""}`}
                onClick={() => nav(`/study/${subject.id}`)}
              >
                <span className="study-card-head">
                  <b>{subject.name}</b>
                  {isCharacterOnly && <span className="study-badge">仅角色</span>}
                </span>
                <span className="study-card-hint">{subject.hint}</span>
                {!isCharacterOnly && (
                  <span className="study-card-foot">
                    <strong>
                      {tasks.filter((task) => task.done).length}/{tasks.length || 0}
                    </strong>
                    今日任务
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="study-note">
          当前是<b>框架版</b>：科目分区、任务清单、监督员、角色学习材料位都已经留好，
          具体内容和提示词注入还没接（按你的要求先不注入）。今天日期基准：{today}。
        </p>
      </main>
    </div>
  );
}
