import { NextResponse } from "next/server";

function clampInt(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // лимит в Data-API до 10000 :contentReference[oaicite:1]{index=1}
  const limit = clampInt(Number(searchParams.get("limit") ?? 5000), 1, 10000);
  const minUsd = Math.max(0, Number(searchParams.get("minUsd") ?? 100));

  // сколько секунд назад считаем "окно"
  const sinceSec = clampInt(Number(searchParams.get("sinceSec") ?? 60), 1, 3600);
  const cutoff = Math.floor(Date.now() / 1000) - sinceSec;

  const url = new URL("https://data-api.polymarket.com/trades");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", "0");
  url.searchParams.set("takerOnly", "true");

  // CASH-фильтр (вместе) :contentReference[oaicite:2]{index=2}
  url.searchParams.set("filterType", "CASH");
  url.searchParams.set("filterAmount", String(minUsd));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Polymarket Data API error", status: res.status },
      { status: 502 }
    );
  }

  const data = await res.json();

  // Data-API отдаёт "самые свежие" первыми :contentReference[oaicite:3]{index=3}
  // Поэтому мы можем быстро отрезать всё что старее cutoff.
  const filtered = Array.isArray(data)
  ? (data as unknown[]).filter((x): x is { timestamp: number } => {
      if (!x || typeof x !== "object") return false;
      const ts = (x as Record<string, unknown>).timestamp;
      return typeof ts === "number" && ts >= cutoff;
    })
  : [];

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "no-store" },
  });
}
