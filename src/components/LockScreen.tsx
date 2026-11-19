import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./LockScreen.css";

/**
 * 开机锁屏：深灰底 + 磨砂玻璃 + 雨滴/涟漪 + sweetheart 淡入淡出，
 * 上滑弹出数字密码盘，输对密码才真的进入小手机。
 * 注意：密码写死在这里，改密码只需要改这一个常量（位数会自动跟着变）。
 */
const PASSWORD = "242628";
const FONT_HREF = "https://miaoda.feishu.cn/fonts/css2?family=Playfair+Display:ital,wght@1,400;1,500&display=swap";

const rand = (min: number, max: number) => min + Math.random() * (max - min);

type Drop = { key: string; className: string; style: CSSProperties };

function buildRain(): Drop[] {
  const drops: Drop[] = [];
  for (let i = 0; i < 14; i++) {
    const width = rand(1.6, 4.2);
    const duration = rand(5.5, 11);
    const left = rand(0, 100);
    drops.push({
      key: `d-${i}`,
      className: "sw-drip",
      style: {
        width: `${width}px`,
        height: `${width * rand(2.0, 2.6)}px`,
        left: `${left}%`,
        "--sw-o": rand(0.26, 0.5),
        "--sw-dur": `${duration}s`,
        "--sw-delay": `${-rand(0, duration)}s`,
      } as CSSProperties,
    });
    const size = rand(14, 30);
    drops.push({
      key: `r-${i}`,
      className: "sw-ripple",
      style: {
        width: `${size}px`,
        height: `${size * 0.42}px`,
        left: `${left}%`,
        "--sw-dur": `${duration}s`,
        "--sw-delay": `${-rand(0, duration)}s`,
      } as CSSProperties,
    });
  }
  for (let i = 0; i < 8; i++) {
    const width = rand(2.5, 6);
    const duration = rand(4.5, 9);
    drops.push({
      key: `h-${i}`,
      className: "sw-hang",
      style: {
        width: `${width}px`,
        height: `${width * rand(1.5, 2.1)}px`,
        left: `${rand(0, 100)}%`,
        top: `${rand(3, 88)}%`,
        "--sw-o": rand(0.32, 0.6),
        "--sw-dur": `${duration}s`,
        "--sw-delay": `${-rand(0, duration)}s`,
      } as CSSProperties,
    });
  }
  return drops;
}

const KEY_LAYOUT = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""];

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [padOpen, setPadOpen] = useState(false);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const drops = useMemo(buildRain, []);
  const startY = useRef<number | null>(null);
  const goneRef = useRef(false);

  /* 载入英文字体，并让状态栏跟着变深色 */
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
    /* 先撤掉 index.html 里的纯色遮罩，锁屏本身已经能盖住画面 */
    document.getElementById("boot-cover")?.remove();
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta) meta.content = "#191a1c";
    return () => {
      link.remove();
      if (meta && previous) meta.content = previous;
    };
  }, []);

  const unlock = () => {
    if (goneRef.current) return;
    goneRef.current = true;
    setLeaving(true);
    window.setTimeout(onUnlock, 620);
  };

  const press = (key: string) => {
    if (!padOpen || leaving) return;
    if (input.length >= PASSWORD.length) return;
    const next = input + key;
    setInput(next);
    if (next.length !== PASSWORD.length) return;
    if (next === PASSWORD) {
      unlock();
      return;
    }
    setWrong(true);
    window.setTimeout(() => {
      setWrong(false);
      setInput("");
    }, 620);
  };

  const openPad = () => {
    if (!leaving) setPadOpen(true);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    startY.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const end = event.changedTouches[0]?.clientY;
    if (startY.current !== null && end !== undefined && startY.current - end > 42) openPad();
    startY.current = null;
  };
  const onMouseDown = (event: React.MouseEvent) => {
    startY.current = event.clientY;
  };
  const onMouseUp = (event: React.MouseEvent) => {
    if (startY.current !== null && startY.current - event.clientY > 42) openPad();
    startY.current = null;
  };

  return (
    <div
      className={`sw-lock ${padOpen ? "pad-open" : ""} ${leaving ? "leaving" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div className="sw-wash" />
      <div className="sw-frost" />
      <div className="sw-rain">
        {drops.map((drop) => (
          <span key={drop.key} className={drop.className} style={drop.style} />
        ))}
      </div>
      <div className="sw-grain" />
      <div className="sw-vignette" />

      <div className="sw-brand" aria-label="sweetheart"><span className="sw-write">sweetheart</span><span className="sw-pen" /></div>
      <div className="sw-swipe" onClick={openPad} role="button" aria-label="上滑输入密码">上滑输入密码</div>

      <div className="sw-pad">
        <div className={`sw-dots ${wrong ? "wrong" : ""}`}>
          {Array.from({ length: PASSWORD.length }, (_, index) => (
            <i key={index} className={index < input.length ? "on" : ""} />
          ))}
        </div>
        <div className="sw-keys">
          {KEY_LAYOUT.map((key, index) =>
            key === "" ? (
              <span key={`blank-${index}`} className="sw-key blank" />
            ) : (
              <button key={key} type="button" className="sw-key" onClick={() => press(key)}>
                {key}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
