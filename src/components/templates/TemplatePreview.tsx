"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TemplateContent, TemplateType } from "@/types";
import { getStructuredTemplateDraft } from "@/components/templates/templateConfig";

const TONE_STYLES: Record<string, { shell: string; accent: string; muted: string; border: string }> = {
    slate: {
        shell: "bg-slate-950 text-white",
        accent: "text-sky-300",
        muted: "text-slate-300",
        border: "border-sky-400/30",
    },
    emerald: {
        shell: "bg-emerald-950 text-white",
        accent: "text-emerald-300",
        muted: "text-emerald-100/80",
        border: "border-emerald-400/30",
    },
    amber: {
        shell: "bg-stone-950 text-white",
        accent: "text-amber-300",
        muted: "text-stone-300",
        border: "border-amber-300/30",
    },
    rose: {
        shell: "bg-rose-950 text-white",
        accent: "text-rose-300",
        muted: "text-rose-100/80",
        border: "border-rose-300/30",
    },
};

export function TemplatePreview({
    type,
    name,
    content,
    compact = false,
}: {
    type: TemplateType;
    name: string;
    content?: TemplateContent | Record<string, unknown> | null;
    compact?: boolean;
}) {
    const draft = getStructuredTemplateDraft(type, content);
    const tone = TONE_STYLES[draft.accentTone] ?? TONE_STYLES.slate;

    if (type === "card") {
        return (
            <div className={cn("rounded-2xl border p-4 shadow-sm", tone.shell, tone.border, compact ? "min-h-[172px]" : "min-h-[220px]")}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className={cn("text-[11px] uppercase tracking-[0.22em]", tone.accent)}>{draft.layoutPreset}</p>
                        <h4 className={cn("mt-2 font-semibold", compact ? "text-lg" : "text-2xl")}>{name}</h4>
                        <p className={cn("mt-1 max-w-[18rem] text-sm leading-5", tone.muted)}>{draft.subheadline}</p>
                    </div>
                    {draft.showLogo ? (
                        <div className={cn("rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em]", tone.border, tone.accent)}>
                            LOGO
                        </div>
                    ) : null}
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                    <div className="space-y-1 text-xs">
                        <p className={tone.muted}>+91 98765 43210</p>
                        <p className={tone.muted}>billing@vahi.app</p>
                        <p className={tone.muted}>{draft.footerNote || "GST • UPI • Counter billing"}</p>
                    </div>
                    {draft.showQr ? (
                        <div className={cn("grid h-16 w-16 place-items-center rounded-xl border text-[10px] font-bold uppercase", tone.border, tone.accent)}>
                            QR
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    if (type === "email") {
        return (
            <div className={cn("rounded-2xl border bg-white p-4 text-slate-900 shadow-sm", compact ? "min-h-[172px]" : "min-h-[220px]")}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{draft.layoutPreset}</p>
                        <h4 className="mt-1 text-lg font-semibold">{draft.headline}</h4>
                    </div>
                    {draft.showLogo ? (
                        <div className="rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                            Vahi
                        </div>
                    ) : null}
                </div>
                <div className="mt-4 space-y-2">
                    <p className="text-sm text-slate-500">{draft.subheadline}</p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-700">
                        {stripHtml(draft.htmlBody || "Write your message body here.")}
                    </div>
                    <p className="text-xs text-slate-500">{draft.footerNote}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-2xl border bg-white p-4 shadow-sm", compact ? "min-h-[172px]" : "min-h-[220px]")}>
            <div className={cn("rounded-2xl border px-4 py-3", tone.border, compact ? "min-h-[140px]" : "min-h-[188px]")}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{draft.layoutPreset}</p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-900">{draft.headline}</h4>
                        <p className="mt-1 text-sm text-slate-500">{draft.subheadline}</p>
                    </div>
                    {draft.showLogo ? (
                        <div className={cn("rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em]", tone.border, tone.accent)}>
                            LOGO
                        </div>
                    ) : null}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 text-sm">
                    <div className="space-y-1 text-slate-600">
                        <p>Item A x2</p>
                        <p>Item B x1</p>
                        <p className="font-semibold text-slate-900">Subtotal</p>
                        {draft.showGst ? <p className="font-semibold text-slate-900">GST</p> : null}
                        <p className="font-semibold text-slate-900">Total</p>
                    </div>
                    <div className="space-y-1 text-right text-slate-900">
                        <p>Rs 240</p>
                        <p>Rs 60</p>
                        <p className="font-semibold">Rs 300</p>
                        {draft.showGst ? <p className="font-semibold">Rs 54</p> : null}
                        <p className={cn("font-semibold", tone.accent)}>Rs {draft.showGst ? "354" : "300"}</p>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{draft.footerNote || "Thank you for doing business with us."}</span>
                    {draft.showSignature ? <span>Signature enabled</span> : null}
                </div>
            </div>
        </div>
    );
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
