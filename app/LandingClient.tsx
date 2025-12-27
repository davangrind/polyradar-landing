"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import WavesBackground from "./components/WavesBackground";
import WhaleSystem from "./components/WhaleSystem";

export default function LandingClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // чтобы анимации гарантированно стартовали после гидратации
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#2A59CF] text-white overflow-hidden">
      {/* Background waves */}
      <WavesBackground />

      {/* Whales */}
      <WhaleSystem />

      {/* Center content overlay: не блокирует ховеры, только сама форма кликабельна */}
      <div className="absolute inset-0 z-30 flex px-0 pointer-events-none
                items-end
                sm:items-center sm:justify-center sm:px-6">
        <div className="relative pointer-events-auto w-full sm:w-auto max-w-[520px] mx-auto">

          {/* Сама glass-панель */}
          <div className="backdrop-blur-xs relative glass-panel
                    rounded-t-[32px] rounded-b-0
                    sm:rounded-[32px]
                    px-6 py-7 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute inset-0 rounded-[32px] origami-noise" />

            <div className="relative flex flex-col items-center gap-6 min-w-[280px] sm:min-w-sm">
              {/* Logo */}
              <div
                className="intro-step"
                style={{ animationDelay: mounted ? "0ms" : "9999ms" }}
              >
                <div className="relative w-[180px] h-[180px]">
                  <Image
                    src="/logo.png"
                    alt="Polyradar"
                    fill
                    priority
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 w-3/4 sm:w-100">
                <a
                  href="https://x.com/"
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "intro-step",
                    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold",
                    "bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/25",
                    "transition focus:outline-none focus:ring-2 focus:ring-white/30",
                    "backdrop-blur",
                  ].join(" ")}
                  style={{ animationDelay: mounted ? "220ms" : "9999ms" }}
                >
                  <span
                    className="type-reveal"
                    style={{ animationDelay: mounted ? "420ms" : "9999ms" }}
                  >
                    Join Polyradar on X
                  </span>
                </a>

                <a
                  href="#"
                  className={[
                    "intro-step",
                    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold",
                    "bg-white text-black hover:bg-white/90",
                    "transition focus:outline-none focus:ring-2 focus:ring-white/30",
                  ].join(" ")}
                  style={{ animationDelay: mounted ? "420ms" : "9999ms" }}
                >
                  <span
                    className="type-reveal"
                    style={{ animationDelay: mounted ? "620ms" : "9999ms" }}
                  >
                    Sign up for Beta
                  </span>
                </a>
              </div>

              <p
                className="intro-step text-sm text-white/60 text-center"
                style={{ animationDelay: mounted ? "650ms" : "9999ms" }}
              >
                Know what whales do on Polymarket right as it happens
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
