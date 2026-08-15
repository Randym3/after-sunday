const workflowRows = [
  { number: "01", command: "Add sermon", detail: "recording or transcript", state: "READY", tone: "green" },
  { number: "02", command: "Review transcript", detail: "sermon context", state: "READY", tone: "green" },
  { number: "03", command: "Draft follow-up", detail: "AI summary + questions", state: "REVIEW", tone: "blue" },
  { number: "04", command: "Send campaign", detail: "group · schedule", state: "WAITING", tone: "muted" },
];

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[590px] lg:mt-5">
      <div className="absolute -right-5 -top-8 h-16 w-16 rounded-full border border-[#cddcf8] bg-[#edf3ff] sm:-right-8 sm:-top-10 sm:h-20 sm:w-20" aria-hidden="true" />
      <div className="absolute -bottom-8 -left-10 hidden h-28 w-28 rounded-3xl border border-[#cddcf8] bg-[#edf3ff]/70 sm:block" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-2xl border border-[#26312e] bg-[#101716] shadow-[0_24px_60px_-28px_rgba(16,23,22,0.8)]">
        <div className="flex items-center justify-between border-b border-[#29332f] px-5 py-4 font-mono text-[10px] text-[#82908a]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#53625c]" />
            <span className="h-2 w-2 rounded-full bg-[#53625c]" />
            <span className="h-2 w-2 rounded-full bg-[#53625c]" />
            <span className="ml-2">After Sunday / follow-up loop</span>
          </div>
          <span className="text-[#57c89a]">workflow active</span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6faaa0]">
                Sunday, August 02
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#f3f6f2] sm:text-3xl">
                The Good Shepherd
              </h2>
              <p className="mt-1 text-xs text-[#89948f]">Psalm 23 · Pastor John</p>
            </div>
            <span className="hidden rounded-md border border-[#315c4e] bg-[#18372e] px-2.5 py-1.5 font-mono text-[9px] text-[#75d6ae] sm:block">
              SERMON 001
            </span>
          </div>

          <div className="space-y-2">
            {workflowRows.map((row, index) => (
              <div
                key={row.number}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3.5 sm:px-4 ${
                  index === 2
                    ? "border-[#2e6bf1] bg-[#17284b]"
                    : "border-[#293630] bg-[#151e1b]"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${index === 2 ? "border-[#2e6bf1] bg-[#2161e8] text-white" : "border-[#35433d] text-[#84928b]"}`}>
                  {row.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-mono text-xs font-semibold ${index === 2 ? "text-[#eaf0ff]" : "text-[#ecf1ed]"}`}>
                    {row.command}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#82908a]">{row.detail}</p>
                </div>
                <span className={`rounded px-2 py-1 font-mono text-[9px] ${row.tone === "blue" ? "bg-[#2161e8] text-white" : row.tone === "green" ? "bg-[#174f3d] text-[#7ed5af]" : "bg-[#24302b] text-[#9ba8a1]"}`}>
                  {row.state}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-[#29332f] pt-5 font-mono text-[10px] text-[#718079]">
            <span className="text-[#5e9df8]">↳ NEXT</span>
            <span className="h-px flex-1 bg-[#32413a]" />
            <span>approve draft → send once</span>
          </div>
        </div>
      </div>

      <div className="relative ml-8 hidden border-x border-b border-[#cbd4d1] bg-[#f8faf7] px-4 py-3 shadow-sm sm:block">
        <div className="grid grid-cols-4 gap-2 font-mono text-[9px] text-[#7a8580]">
          <span><b className="text-[#2161e8]">/sermons</b><br />source</span>
          <span><b className="text-[#2161e8]">/draft</b><br />review</span>
          <span><b className="text-[#2161e8]">/campaign</b><br />recipients</span>
          <span><b className="text-[#2161e8]">/send</b><br />one time</span>
        </div>
      </div>
    </div>
  );
}