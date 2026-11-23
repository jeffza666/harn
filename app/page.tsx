import Link from "next/link";
import { labels } from "@/lib/labels";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full max-w-xl">
        <p className="text-sm font-semibold text-emerald-700">{labels.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{labels.landingTitle}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{labels.landingBody}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/split?demo=1"
            className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {labels.trySample}
          </Link>
          <Link
            href="/split"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            {labels.startBill}
          </Link>
        </div>
        <p className="mt-6 text-sm leading-6 text-slate-500">{labels.browserOnly}</p>
      </div>
    </main>
  );
}
