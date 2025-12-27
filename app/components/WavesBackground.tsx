"use client";

import { useEffect, useState } from "react";
import Wave from "react-wavify";

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

export default function WavesBackground() {
  const isMobile = useIsMobile(640);

  const waveHeights = isMobile
    ? ["h-[75vh]", "h-[70vh]", "h-[65vh]"] // выше примерно на 1/4
    : ["h-[60vh]", "h-[55vh]", "h-[50vh]"];

  // амплитуда меньше на мобиле
  const amp = isMobile ? [36, 32, 28] : [55, 52, 50];

  return (
    <div className="absolute inset-x-0 bottom-[-10] pointer-events-none">
      {/* Wave 3 (back) */}
      <div className="absolute inset-x-0 bottom-0 z-[10]">
        <Wave
          fill="rgba(0,41,79,0.7)"
          paused={false}
          options={{ height: 40, amplitude: amp[0], speed: 0.22, points: 4 }}
          className={`w-full ${waveHeights[0]} wave-svg wave-back`}
        />
      </div>

      {/* Wave 2 (middle) */}
      <div className="absolute inset-x-0 bottom-0 z-[20]">
        <Wave
          fill="rgba(3,69,127,0.7)"
          paused={false}
          options={{ height: 32, amplitude: amp[1], speed: 0.19, points: 4 }}
          className={`w-full ${waveHeights[1]} wave-svg wave-back`}
        />
      </div>

      {/* Wave 1 (front) */}
      <div className="absolute inset-x-0 bottom-0 z-[30]">
        <Wave
          fill="rgba(49,110,164,0.7)"
          paused={false}
          options={{ height: 26, amplitude: amp[2], speed: 0.16, points: 4 }}
          className={`w-full ${waveHeights[2]} wave-svg wave-back`}
        />
      </div>
    </div>
  );
}
