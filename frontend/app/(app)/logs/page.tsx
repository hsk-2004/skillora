"use client";

import LiveLogsView from "@/components/LiveLogsView";

export default function LogsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-3xl font-serif text-[#141A16]">Live Logs</h1>
      <LiveLogsView />
    </div>
  );
}
