"use client";
import { useEffect, useRef } from "react";

// Small fetch wrapper used by every page. Never throws: a network error comes back as status 0.
export async function call(method: string, path: string, body?: unknown) {
  try {
    const res = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Can't reach the teacher's laptop. Check your Wi-Fi." } };
  }
}

// Calls fn now and then every few seconds until the page is closed.
export function usePoll(fn: () => Promise<void>, ms = 3000) {
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await latest.current().catch(() => {});
      if (!stopped) timer = setTimeout(tick, ms);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ms]);
}

// 125 -> "02:05"
export function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Timer turns amber under 5 minutes and red under 1 minute.
export function timerClass(seconds: number) {
  if (seconds <= 60) return "timer timer-danger";
  if (seconds <= 300) return "timer timer-warn";
  return "timer";
}

// The join code this phone is using, so a page reload goes straight back into the quiz.
export const getJoinedCode = () => localStorage.getItem("classly_code");
export const setJoinedCode = (code: string) => localStorage.setItem("classly_code", code);
export const clearJoinedCode = () => localStorage.removeItem("classly_code");
