"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [breakpointPx]);

  return isMobile;
}

/** То, что нам нужно для UI карточки */
type TradeUI = {
  traderName: string;
  traderUrl: string;
  market: string;
  side: "BUY" | "SELL";
  sizeUsd: number;
  ts: number;
  txHash?: string;
};

/** Trade shape, который отдаёт твой FastAPI SSE (данные из Data-API /trades) */
type BackendTrade = {
  timestamp: number;
  side: "BUY" | "SELL";
  price: number;
  size: number;

  conditionId?: string;
  title?: string;
  slug?: string;
  icon?: string;
  outcome?: string;

  transactionHash?: string;
  proxyWallet?: string;
};

type WhaleInstance = {
  id: string;
  layer: 0 | 1 | 2;
  leftPx: number;
  zIndex: number;
  surfaceYPx: number;
  driftXPx: number;
  durationSec: number;
  bobDelaySec: number;
  dir: -1 | 1;
  trade: TradeUI;
  spawnedAtMs: number;
  isLoading?: boolean;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type CSSVars = React.CSSProperties & {
  ["--surfaceY"]: string;
  ["--driftX"]: string;
  ["--startY"]: string;
  ["--waveY"]?: string;
  ["--waveRot"]?: string;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function shortAddr(a: string) {
  if (!a) return "unknown";
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function calcUsdFromBackend(t: BackendTrade): number {
  const size = Number(t.size ?? 0);
  const price = Number(t.price ?? 0);
  const v = size * price;
  if (Number.isFinite(v) && v > 0) return v;
  return Number.isFinite(size) ? size : 0;
}

function toTradeUI(t: BackendTrade): TradeUI | null {
  const ts = Number(t.timestamp ?? 0);
  const title = (t.title ?? "").trim();
  const side = (t.side ?? "").toUpperCase() as "BUY" | "SELL";
  if (!ts || !title || (side !== "BUY" && side !== "SELL")) return null;

  const wallet = (t.proxyWallet ?? "").trim();
  const traderName = wallet ? shortAddr(wallet) : "unknown";
  const traderUrl = wallet
    ? `https://polymarket.com/profile/${wallet}?tab=activity&via=inside`
    : `https://polymarket.com/@Alexparker?tab=activity&via=inside`;

  const market = t.outcome ? `${title} • ${t.outcome}` : title;
  const usd = calcUsdFromBackend(t);

  return {
    traderName,
    traderUrl,
    market,
    side,
    sizeUsd: Math.round(usd * 100) / 100,
    ts,
    txHash: t.transactionHash,
  };
}

export default function WhaleSystem() {
  const isMobile = useIsMobile(640);

  const [whales, setWhales] = useState<WhaleInstance[]>([]);
  const whalesRef = useRef<WhaleInstance[]>([]);
  useEffect(() => {
    whalesRef.current = whales;
  }, [whales]);

  const timers = useRef<number[]>([]);

  // SSE состояние (опционально для дебага)
  const [sseConnected, setSseConnected] = useState(false);

  // Дедуп (чтобы не показывать одно и то же подряд)
  const seenSetRef = useRef<Set<string>>(new Set());
  const seenOrderRef = useRef<string[]>([]);
  const MAX_SEEN = 2000;

  const waveHeights = useMemo(() => {
    return isMobile ? ([0.72, 0.74, 0.76] as const) : ([0.51, 0.55, 0.58] as const);
  }, [isMobile]);

  const waveZ = useMemo(() => [30, 20, 10] as const, []);

  const waveParams = useMemo(() => {
    return isMobile
      ? ([
          { amplitude: 36, speed: 0.22, points: 4 },
          { amplitude: 32, speed: 0.19, points: 4 },
          { amplitude: 28, speed: 0.16, points: 4 },
        ] as const)
      : ([
          { amplitude: 55, speed: 0.22, points: 4 },
          { amplitude: 52, speed: 0.19, points: 4 },
          { amplitude: 50, speed: 0.16, points: 4 },
        ] as const);
  }, [isMobile]);

  // refs на элементы для wave-follow
  const followRefs = useRef(new Map<string, HTMLDivElement>());
  const rafId = useRef<number | null>(null);

  const LOADING_ID = "loading_whale";

  const removeWhaleById = useCallback((id: string) => {
    setWhales((prev) => prev.filter((x) => x.id !== id));
    followRefs.current.delete(id);
  }, []);

  /** Спавн кита из конкретной сделки */
  const spawnWhaleFromTrade = useCallback(
    (trade: TradeUI, opts?: { id?: string; isLoading?: boolean; durationSec?: number }) => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const layer = Math.floor(Math.random() * 3) as 0 | 1 | 2;
      const surfaceY = h * waveHeights[layer] - 30;

      const whaleWidth = isMobile ? 150 : 180;
      const margin = isMobile ? 14 : 24;

      const excluded = isMobile ? 0.01 : 0.15;
      const leftZoneEnd = (0.5 - excluded / 2) * w;
      const rightZoneStart = (0.5 + excluded / 2) * w;

      const pickLeftZone = Math.random() < 0.5;

      const left = pickLeftZone
        ? margin + Math.random() * Math.max(0, leftZoneEnd - margin - whaleWidth)
        : rightZoneStart + Math.random() * Math.max(0, w - rightZoneStart - margin - whaleWidth);

      const dir: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
      const driftX = dir === 1 ? w - left + 320 : -(left + 320);

      // для лоадера ставим подольше, чтобы он успел "дождаться" сделки
      const duration = opts?.durationSec ?? (15 + Math.random() * 3);
      const bobDelay = duration * 0.25;

      const instance: WhaleInstance = {
        id: opts?.id ?? uid(),
        layer,
        leftPx: left,
        zIndex: waveZ[layer] - 1,
        surfaceYPx: surfaceY,
        driftXPx: driftX,
        durationSec: duration,
        bobDelaySec: bobDelay,
        dir,
        trade,
        spawnedAtMs: performance.now(),
        isLoading: opts?.isLoading,
      };

      setWhales((prev) => {
        // не дублим loading whale
        if (instance.id === LOADING_ID && prev.some((p) => p.id === LOADING_ID)) return prev;
        return [...prev, instance];
      });

      const t = window.setTimeout(() => {
        removeWhaleById(instance.id);
      }, Math.ceil((duration + 0.4) * 1000));

      timers.current.push(t);
    },
    [isMobile, waveHeights, waveZ, removeWhaleById]
  );

  /** Показать стартового "лоадер-кита" */
  const spawnLoadingWhale = useCallback(() => {
    const loadingTrade: TradeUI = {
      traderName: "",
      traderUrl: "#",
      market: "",
      side: "BUY",
      sizeUsd: 0,
      ts: Date.now(),
      txHash: "loading",
    };

    // Делаем его чуть длиннее, чтобы почти всегда успел дождаться первого trade
    spawnWhaleFromTrade(loadingTrade, { id: LOADING_ID, isLoading: true, durationSec: 18 });
  }, [spawnWhaleFromTrade]);

  /** "Апгрейд" лоадер-кита в настоящего: меняем только содержимое, не удаляем */
  const upgradeLoadingWhale = useCallback((trade: TradeUI) => {
    setWhales((prev) =>
      prev.map((w) => {
        if (w.id !== LOADING_ID) return w;
        return {
          ...w,
          trade,
          isLoading: false,
        };
      })
    );
  }, []);

  const hasRealTradeRef = useRef(false);
  const loadingTimerRef = useRef<number | null>(null);

  // Ставим лоадер почти сразу после захода
  useEffect(() => {
    hasRealTradeRef.current = false;

    loadingTimerRef.current = window.setTimeout(() => {
      if (!hasRealTradeRef.current) spawnLoadingWhale();
    }, 120);

    return () => {
      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [spawnLoadingWhale]);

  /**
   * SSE: слушаем backend /sse и на каждое событие trade — спавним кита.
   * Важно: тут есть явный reconnect (с backoff), чтобы не было "залипаний".
   */
  useEffect(() => {
    const sseUrl = process.env.NEXT_PUBLIC_WHALE_SSE_URL || "http://localhost:8000/sse";

    let es: EventSource | null = null;
    let stopped = false;
    let reconnectTimer: number | null = null;
    let backoffMs = 500;

    const cleanup = () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (es) {
        es.close();
        es = null;
      }
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      cleanup();
      setSseConnected(false);

      const jitter = Math.floor(Math.random() * 300);
      const delay = Math.min(8000, backoffMs) + jitter;

      reconnectTimer = window.setTimeout(() => {
        if (!stopped) connect();
      }, delay);

      backoffMs = Math.min(8000, backoffMs * 2);
    };

    const dedupKey = (t: TradeUI) => {
      if (t.txHash) return t.txHash;
      return `${t.ts}:${t.traderUrl}:${t.market}:${t.side}:${t.sizeUsd}`;
    };

    const connect = () => {
      if (stopped) return;

      try {
        es = new EventSource(sseUrl);

        es.addEventListener("hello", () => {
          backoffMs = 500;
          setSseConnected(true);
        });

        es.addEventListener("trade", (e: MessageEvent) => {
          try {
            const raw = JSON.parse(e.data) as BackendTrade;
            const ui = toTradeUI(raw);
            if (!ui) return;

            const key = dedupKey(ui);
            if (seenSetRef.current.has(key)) return;

            seenSetRef.current.add(key);
            seenOrderRef.current.push(key);
            if (seenOrderRef.current.length > MAX_SEEN) {
              const old = seenOrderRef.current.shift();
              if (old) seenSetRef.current.delete(old);
            }

            // Первый реальный trade: вместо удаления лоадера — апгрейдим его карточку
            if (!hasRealTradeRef.current) {
              hasRealTradeRef.current = true;
              if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
              }
              upgradeLoadingWhale(ui);
              return; // важно: в первый раз НЕ спавним новый кит, а обновляем первого
            }

            // дальше как обычно — спавним новые киты
            spawnWhaleFromTrade(ui);
          } catch {
            // ignore bad payload
          }
        });

        es.addEventListener("heartbeat", () => {
          // noop
        });

        es.onerror = () => {
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      stopped = true;
      cleanup();
      setSseConnected(false);
    };
  }, [spawnWhaleFromTrade, upgradeLoadingWhale]);

  /** cleanup */
  useEffect(() => {
    const followMap = followRefs.current;

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      followMap.clear();
    };
  }, []);

  /** rAF: wave-follow (берём whalesRef.current) */
  useEffect(() => {
    if (rafId.current) return;

    const tick = () => {
      const now = performance.now();
      const w = window.innerWidth;

      const DRIFT_START_FRAC = 0.4;
      const current = whalesRef.current;

      for (const whale of current) {
        const el = followRefs.current.get(whale.id);
        if (!el) continue;

        const elapsedSec = (now - whale.spawnedAtMs) / 1000;
        const tNorm = clamp01(elapsedSec / whale.durationSec);

        const driftProg = clamp01((tNorm - DRIFT_START_FRAC) / (1 - DRIFT_START_FRAC));
        const xNow = whale.leftPx + whale.driftXPx * driftProg;

        const { amplitude, speed, points } = waveParams[whale.layer];

        const k = (Math.PI * 2 * points) / Math.max(1, w);
        const phase = (now / 1000) * (Math.PI * 2) * speed;

        const followOn = clamp01((tNorm - DRIFT_START_FRAC) / 0.08);

        const ampMul = isMobile ? 0.4 : 0.3;
        const amp = amplitude * ampMul;

        const arg = k * xNow + phase;
        const y = Math.sin(arg) * amp * followOn;

        const rotMul = isMobile ? 2.2 : 3.5;
        const rot = Math.cos(arg) * rotMul * followOn;

        el.style.setProperty("--waveY", `${y.toFixed(2)}px`);
        el.style.setProperty("--waveRot", `${rot.toFixed(2)}deg`);
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  }, [waveParams, isMobile]);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none">
        {whales.map((whale) => {
          const cardDelaySec = whale.durationSec * 0.22;

          const sidePill =
            whale.trade.side === "BUY"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800";

          const whaleW = isMobile ? 90 : 150;
          const whaleH = isMobile ? 40 : 70;

          const expandedAlways = isMobile;
          const isLoading = !!whale.isLoading;

          return (
            <div
              key={whale.id}
              className="absolute bottom-0"
              style={
                {
                  left: `${whale.leftPx}px`,
                  zIndex: whale.zIndex,
                  "--surfaceY": `${whale.surfaceYPx}px`,
                  "--driftX": `${whale.driftXPx}px`,
                  "--startY": `220px`,
                } as CSSVars
              }
            >
              <div
                className="whale-path drop-shadow-[0_20px_30px_rgba(0,0,0,0.25)]"
                style={{ animationDuration: `${whale.durationSec}s` }}
              >
                <div className="whale-bob" style={{ animationDelay: `${whale.bobDelaySec}s` }}>
                  <div
                    ref={(node) => {
                      if (node) followRefs.current.set(whale.id, node);
                      else followRefs.current.delete(whale.id);
                    }}
                    className="wave-follow"
                  >
                    <div className="group pointer-events-auto relative flex flex-col items-center gap-2">
                      {/* CARD */}
                      {isLoading ? (
                        <div
                          className={[
                            "trade-card",
                            "rounded-2xl bg-white/90 text-black backdrop-blur",
                            "border border-black/10",
                            "px-4 py-3",
                            "shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
                            isMobile ? "w-[240px]" : "w-[260px]",
                          ].join(" ")}
                          style={{ animationDelay: `${cardDelaySec}s` }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-extrabold px-2 py-1 rounded-full bg-black/5 text-black/60">
                              Loading
                            </div>
                            <div className="text-sm font-extrabold text-black/50">—</div>
                          </div>

                          <div className="mt-3">
                            <div className="text-xs font-semibold text-black/60">Fetching latest whales…</div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="inline-block h-3 w-3 rounded-full border-2 border-black/25 border-t-black/70 animate-spin" />
                              <span className="text-xs text-black/45">Connecting to live feed</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <a
                          href={whale.trade.traderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={[
                            "trade-card",
                            "rounded-2xl bg-white/90 text-black backdrop-blur",
                            "border border-black/10",
                            "px-4 py-3",
                            "shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
                            "transition-[box-shadow,transform] duration-300",
                            isMobile ? "w-[240px]" : "w-[260px]",
                            "group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.18),0_0_0_1px_rgba(255,215,0,0.28),0_25px_80px_rgba(255,215,0,0.22)]",
                            "active:scale-[0.99]",
                          ].join(" ")}
                          style={{ animationDelay: `${cardDelaySec}s` }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className={`text-xs font-extrabold px-2 py-1 rounded-full ${sidePill}`}>
                              {whale.trade.side}
                            </div>
                            <div className="text-sm font-extrabold">${whale.trade.sizeUsd.toLocaleString()}</div>
                          </div>

                          <div
                            className={[
                              "overflow-hidden transition-[max-height,opacity] duration-300",
                              expandedAlways
                                ? "max-h-[220px] opacity-100"
                                : "max-h-0 opacity-0 group-hover:max-h-[220px] group-hover:opacity-100",
                            ].join(" ")}
                          >
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-black/60">Trader</div>
                              <div className="text-sm font-extrabold leading-tight">@{whale.trade.traderName}</div>
                            </div>

                            <div className="mt-2 text-xs text-black/70">{whale.trade.market}</div>

                            <div className="mt-2 text-[11px] text-black/45">
                              {isMobile ? "Tap to open trader profile →" : "Click to open trader profile →"}
                            </div>
                          </div>
                        </a>
                      )}

                      {/* WHALE + GLOW */}
                      <div className="relative">
                        <div
                          className={[
                            "absolute -inset-16 rounded-full",
                            "opacity-0 group-hover:opacity-100",
                            "transition-opacity duration-300",
                            "pointer-events-none",
                            "bg-[radial-gradient(circle,rgba(255,215,0,0.45),rgba(255,215,0,0)_70%)]",
                          ].join(" ")}
                        />

                        <div
                          className={[
                            "relative",
                            "transition-transform duration-300",
                            "group-hover:scale-[1.03]",
                            "drop-shadow-[0_14px_18px_rgba(0,0,0,0.25)]",
                            "group-hover:drop-shadow-[0_18px_22px_rgba(0,0,0,0.25)]",
                          ].join(" ")}
                          style={{ transform: whale.dir === 1 ? "scaleX(-1)" : "scaleX(1)" }}
                        >
                          <Image src="/whale.png" alt="Whale" width={whaleW} height={whaleH} className="select-none" />
                        </div>
                      </div>
                      {/* /WHALE */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
