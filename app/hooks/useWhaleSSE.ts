"use client";

import { useEffect, useRef } from "react";

type Trade = {
  timestamp: number;
  side: string;
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

type Options = {
  sseUrl: string;
  onTrade: (t: Trade) => void;
  onStatus?: (s: { connected: boolean; error?: string }) => void;
};

export function useWhaleSSE({ sseUrl, onTrade, onStatus }: Options) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let closed = false;

    const cleanup = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };

    const scheduleReconnect = (reason?: string) => {
      if (closed) return;
      cleanup();
      onStatus?.({ connected: false, error: reason ?? "reconnect" });
      // небольшой джиттер, чтобы не долбить сервер синхронно у всех
      const delay = 1000 + Math.floor(Math.random() * 1500);
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };

    const tradeKey = (t: Trade) =>
      t.transactionHash ?? `${t.timestamp}:${t.proxyWallet}:${t.conditionId}:${t.side}:${t.price}:${t.size}`;

    const connect = () => {
      if (closed) return;

      const es = new EventSource(sseUrl, { withCredentials: false });
      esRef.current = es;

      es.addEventListener("hello", () => {
        onStatus?.({ connected: true });
      });

      es.addEventListener("trade", (e: MessageEvent) => {
        try {
          const t = JSON.parse(e.data) as Trade;

          // лёгкий дедуп на фронте, чтобы не спавнить одно и то же подряд
          const k = tradeKey(t);
          const seen = lastSeenRef.current;
          if (seen.has(k)) return;
          seen.add(k);
          // ограничим размер set, чтобы не рос бесконечно
          if (seen.size > 500) {
            lastSeenRef.current = new Set(Array.from(seen).slice(-300));
          }

          onTrade(t);
        } catch {
          // ignore
        }
      });

      // heartbeat можно слушать, если хочешь UI “соединение живо”
      es.addEventListener("heartbeat", () => {
        // optional
      });

      es.onerror = () => {
        // EventSource может сам переподключаться, но часто лучше контролировать самим,
        // чтобы не зависеть от браузерной реализации
        scheduleReconnect("sse error");
      };
    };

    connect();

    return () => {
      closed = true;
      cleanup();
      onStatus?.({ connected: false });
    };
  }, [sseUrl, onTrade, onStatus]);
}
