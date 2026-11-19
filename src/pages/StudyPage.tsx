import { useEffect, useMemo, useState } from "react";
import { ChevronRight, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppTopBar } from "../components/ui";
import { useStore } from "../core/store";
import { STUDY_SUBJECTS, coreDoneCount, loadStudy, studyTodayKey, todayTasksOf, type StudyData } from "../core/study";
import "./StudyPage.css";

/* ============================================================
   学习 App 首页（科目总览）
   —— 主科：今日进度 + 监督员
   —— 副科：地理可排任务；物理 / 化学 / 生物 只作为入口，不加标注
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

  const todayText = `${new Date().getMonth() + 1}月${new Date().getDate()}日`;

  const subjectName = (id: string) => STUDY_SUBJECTS.find((item) => item.id === id)?.name ?? "";
  const recentInteractions = [...(data?.interactions ?? [])]
    .filter((item) => item.subjectId !== "biology")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      from: characters.find((c) => c.id === item.fromCharacterId)?.name ?? "角色",
      to: characters.find((c) => c.id === item.toCharacterId)?.name ?? "角色"
    }));

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
          <strong>{doneCount}/3</strong>
        </section>

        <h3 className="study-section-title">
          <GraduationCap size={13} />
          主科专区
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

        <h3 className="study-section-title">副科</h3>
        <div className="study-grid">
          {minorSubjects.map((subject) => {
            const isCharacterScope = subject.scope === "character";
            const tasks = data && !isCharacterScope ? todayTasksOf(data, subject.id) : [];
            const supervisor = isCharacterScope ? "" : supervisorName(subject.id);
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
                {isCharacterScope ? null : (
                  <>
                    <span className="study-card-hint">{subject.hint}</span>
                    <span className="study-card-foot">
                      <strong>
                        {tasks.filter((task) => task.done).length}/{tasks.length || 0}
                      </strong>
                      今日任务
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <h3 className="study-section-title">角色之间</h3>
        {recentInteractions.length === 0 ? (
          <p className="study-material-empty">角色会互相出题、互相答题批改，往来会记在这里。</p>
        ) : (
          <div className="study-materials">
            {recentInteractions.map((item) => (
              <div className="study-material" key={item.id}>
                <span>
                  <b>
                    {item.from} → {item.to}
                  </b>
                  <small>
                    {subjectName(item.subjectId)} · {item.title}
                  </small>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
