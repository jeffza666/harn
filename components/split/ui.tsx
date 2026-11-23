import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { issueText, labels } from "@/lib/labels";
import type { Issue, IssueCode } from "@/lib/types";

const buttonVariants = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", className = "") {
  return `inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${buttonVariants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function Banner({ tone, children }: { tone: "emerald" | "amber" | "slate"; children: ReactNode }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-900",
    amber: "bg-amber-50 text-amber-950",
    slate: "bg-slate-100 text-slate-700",
  };
  return <p className={`rounded-xl px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</p>;
}

export function IssueList({ issues }: { issues: Issue[] }) {
  const codes = [...new Set(issues.map((issue) => issue.code))];
  if (codes.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">{labels.fixBeforeContinue}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {codes.map((code) => (
          <li key={code}>{issueText[code]}</li>
        ))}
      </ul>
    </div>
  );
}

export function issueFor(issues: Issue[], code: IssueCode, id?: string) {
  return issues.some((issue) => issue.code === code && (id === undefined || issue.itemId === id || issue.participantId === id));
}

const inputClass =
  "w-full rounded-xl border bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-emerald-700";

export function TextField({
  id,
  label,
  error = false,
  errorMessage,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: boolean;
  errorMessage?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error || undefined}
        aria-describedby={error && errorMessage ? errorId : undefined}
        className={`${inputClass} ${error ? "border-rose-400" : "border-slate-300"}`}
        {...props}
      />
      {error && errorMessage ? (
        <p id={errorId} className="mt-1 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</section>;
}
