import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppTopBar, Empty, Modal } from "../components/ui";
import {
  anniversaryDateText,
  anniversaryDaysTo,
  anniversaryWhenText,
  anniversarySummary,
  loadAnniversaries,
  persistAnniversaries,
  todayKey,
  type AnniversaryItem,
  type AnniversaryMode,
  type AnniversaryRepeat
} from "../core/anniversary";
import { now, uid } from "../core/types";
import "./AnniversaryPage.css";

/* ============================================================
   纪念日倒数 —— 二改新增的 App
   数据在 core/anniversary.ts 里统一读写，页面只负责展示和编辑。
   这样角色聊天时也能拿到同一份数据（走内存缓存，同步可读）。
   ============================================================ */

interface FormState {
  id: string | null; // null 表示新建
  title: string;
  date: string;
  mode: AnniversaryMode;
  repeat: AnniversaryRepeat;
  note: string;
}

export default function AnniversaryPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<AnniversaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");

  /* 进入页面时从本地库读取 */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadAnniversaries();
      if (cancelled) return;
      setItems(stored);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (next: AnniversaryItem[]) => {
    setItems(next);
    await persistAnniversaries(next);
  };

  /* 越接近今天的排在越前面 */
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => anniversaryDaysTo(a) - anniversaryDaysTo(b));
  }, [items]);

  const openCreate = () => {
    setError("");
    setForm({ id: null, title: "", date: todayKey(), mode: "countdown", repeat: "none", note: "" });
  };

  const openEdit = (item: AnniversaryItem) => {
    setError("");
    setForm({
      id: item.id,
      title: item.title,
      date: item.date,
      mode: item.mode,
      repeat: item.repeat ?? "none",
      note: item.note ?? ""
    });
  };

  const submit = async () => {
    if (!form) return;
    const title = form.title.trim();
    if (!title) {
      setError("先给这个日子起个名字");
      return;
    }
    const trimmedNote = form.note.trim();
    let next: AnniversaryItem[];
    if (form.id) {
      next = items.map((item) =>
        item.id === form.id
          ? {
              ...item,
              title,
              date: form.date,
              mode: form.mode,
              repeat: form.mode === "countdown" ? form.repeat : "none",
              note: trimmedNote || undefined
            }
          : item
      );
    } else {
      next = [
        ...items,
        {
          id: uid(),
          title,
          date: form.date,
          mode: form.mode,
          repeat: form.mode === "countdown" ? form.repeat : "none",
          note: trimmedNote || undefined,
          createdAt: now()
        }
      ];
    }
    await persist(next);
    setForm(null);
    setError("");
  };

  const remove = async (id: string) => {
    await persist(items.filter((item) => item.id !== id));
    setForm(null);
  };

  return (
    <div className="app-page anniversary-page">
      <AppTopBar
        title="纪念日"
        backLabel="返回桌面"
        onBack={() => nav("/")}
        actions={
          <button type="button" className="anniv-add" aria-label="添加纪念日" onClick={openCreate}>
            <Plus />
          </button>
        }
      />

      <main className="anniv-scroll">
        <p className="anniv-today">今天是 {anniversaryDateText(todayKey())}</p>

        {loaded && sorted.length === 0 && (
          <Empty
            icon={<CalendarHeart />}
            title="还没有纪念日"
            text="点右上角的加号，记下第一个想倒数的日子。"
          />
        )}

        <div className="anniv-list">
          {sorted.map((item) => {
            const { number, caption } = anniversarySummary(item);
            const isToday = anniversaryDaysTo(item) === 0;
            return (
              <button
                type="button"
                key={item.id}
                className={`anniv-card ${item.mode} ${isToday ? "today" : ""}`}
                onClick={() => openEdit(item)}
              >
                <span className="anniv-card-main">
                  <b>{item.title}</b>
                  <small>
                    {anniversaryWhenText(item)} · {item.mode === "countdown" ? "倒数" : "纪念"}
                    {item.repeat === "yearly" ? " · 每年" : item.repeat === "monthly" ? " · 每月" : ""}
                  </small>
                  {item.note && <em>{item.note}</em>}
                </span>
                <span className="anniv-card-count">
                  <strong>{number}</strong>
                  <small>{caption}</small>
                </span>
              </button>
            );
          })}
        </div>
      </main>

      {form && (
        <Modal onClose={() => setForm(null)}>
          <div className="anniv-form">
            <h2>{form.id ? "编辑纪念日" : "新的纪念日"}</h2>

            <label>
              名字
              <input
                autoFocus
                maxLength={20}
                value={form.title}
                placeholder="例如：在一起的第 1000 天"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>

            <label>
              日期
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>

            <div className="anniv-mode">
              <button
                type="button"
                className={form.mode === "countdown" ? "active" : ""}
                onClick={() => setForm({ ...form, mode: "countdown" })}
              >
                倒数
                <small>还有几天到</small>
              </button>
              <button
                type="button"
                className={form.mode === "since" ? "active" : ""}
                onClick={() => setForm({ ...form, mode: "since" })}
              >
                纪念
                <small>已经过了几天</small>
              </button>
            </div>

            {form.mode === "countdown" && (
              <div className="anniv-repeat">
                <span>要不要重复</span>
                <div className="anniv-repeat-options">
                  {(
                    [
                      { value: "none", label: "只这一次" },
                      { value: "yearly", label: "每年" },
                      { value: "monthly", label: "每月" }
                    ] as { value: AnniversaryRepeat; label: string }[]
                  ).map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={form.repeat === option.value ? "active" : ""}
                      onClick={() => setForm({ ...form, repeat: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <small>
                  选了每年/每月，日期过了会自动滚到下一次，不用年年手动改。
                </small>
              </div>
            )}

            <label>
              备注（可留空）
              <input
                maxLength={40}
                value={form.note}
                placeholder="想写的一句话"
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </label>

            {error && <p className="anniv-error">{error}</p>}

            <div className="anniv-actions">
              {form.id && (
                <button type="button" className="danger" onClick={() => void remove(form.id!)}>
                  <Trash2 />
                  删除
                </button>
              )}
              <button type="button" className="cancel" onClick={() => setForm(null)}>
                取消
              </button>
              <button type="button" className="ok" onClick={() => void submit()}>
                {form.id ? <Pencil /> : <Plus />}
                保存
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
