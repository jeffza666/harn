import { connection } from "next/server";
import { SplitApp } from "@/components/split/split-app";
import { geminiApiKey, geminiModel, isSupportedFlashModel } from "@/lib/env";
import { labels } from "@/lib/labels";

export const metadata = {
  title: `${labels.splitTitle} · ${labels.appName}`,
  description: labels.landingBody,
};

export default async function SplitPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  await connection();
  const query = await searchParams;
  const demo = query.demo;
  const initialDemo = demo === "1" || (Array.isArray(demo) && demo.includes("1"));
  const configured = geminiApiKey() !== undefined;
  const model = configured ? geminiModel() : null;

  return (
    <SplitApp
      initialDemo={initialDemo}
      extraction={{
        configured,
        model,
        modelSupported: model !== null && isSupportedFlashModel(model),
      }}
    />
  );
}
