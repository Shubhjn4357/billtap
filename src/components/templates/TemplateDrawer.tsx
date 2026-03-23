"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Template, TemplateType } from "@/types";
import { getErrorMessage } from "@/lib/api-error";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import {
    buildTemplateContent,
    getDefaultTemplateDraft,
    getStructuredTemplateDraft,
    getTemplateExtraContent,
    TEMPLATE_PRESET_OPTIONS,
    TEMPLATE_TONE_OPTIONS,
    TEMPLATE_TYPE_OPTIONS,
    type TemplateDraft,
} from "@/components/templates/templateConfig";

interface TemplateDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    template?: Template;
    isSaving?: boolean;
    onSave: (payload: {
        id?: string;
        name: string;
        type: TemplateType;
        thumbnailUrl?: string;
        isDefault: boolean;
        isActive: boolean;
        content: Record<string, unknown>;
    }) => Promise<void>;
}

const parseJsonContent = (value: string): Record<string, unknown> => {
    if (!value.trim()) return {};
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Advanced content must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
};

const stringifyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export function TemplateDrawer({
    isOpen,
    onClose,
    template,
    isSaving = false,
    onSave,
}: TemplateDrawerProps) {
    const [name, setName] = useState("");
    const [type, setType] = useState<TemplateType>("invoice");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [draft, setDraft] = useState<TemplateDraft>(getDefaultTemplateDraft("invoice"));
    const [advancedJson, setAdvancedJson] = useState("{}");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setValidationError(null);
        if (template) {
            setName(template.name);
            setType(template.type);
            setThumbnailUrl(template.thumbnailUrl ?? "");
            setIsDefault(Boolean(template.isDefault));
            setIsActive(Boolean(template.isActive));
            setDraft(getStructuredTemplateDraft(template.type, template.content));
            setAdvancedJson(stringifyJson(getTemplateExtraContent(template.content)));
            setShowAdvanced(false);
            return;
        }

        setName("");
        setType("invoice");
        setThumbnailUrl("");
        setIsDefault(false);
        setIsActive(true);
        setDraft(getDefaultTemplateDraft("invoice"));
        setAdvancedJson("{}");
        setShowAdvanced(false);
    }, [isOpen, template]);

    const presetOptions = useMemo(() => TEMPLATE_PRESET_OPTIONS[type], [type]);
    const typeDescription = useMemo(
        () => TEMPLATE_TYPE_OPTIONS.find((entry) => entry.value === type)?.description ?? "",
        [type]
    );

    const submit = async () => {
        setValidationError(null);
        try {
            if (!name.trim()) {
                throw new Error("Template name is required.");
            }

            const content = buildTemplateContent({
                type,
                draft,
                extras: parseJsonContent(advancedJson),
            });

            await onSave({
                id: template?.id,
                name: name.trim(),
                type,
                thumbnailUrl: thumbnailUrl.trim() || undefined,
                isDefault,
                isActive,
                content,
            });
        } catch (error) {
            setValidationError(getErrorMessage(error, "Invalid template payload."));
        }
    };

    const onTypeChange = (nextType: TemplateType) => {
        setType(nextType);
        setDraft(getDefaultTemplateDraft(nextType));
        setAdvancedJson("{}");
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={template ? "Edit Template" : "Create Template"}
            description={template ? `Updating ${template.name}` : "Create a Vahi-facing template with preview-first controls."}
            footer={(
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={() => { void submit(); }} isLoading={isSaving}>
                        {template ? "Save Changes" : "Create Template"}
                    </Button>
                </div>
            )}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
                className="space-y-6"
            >
                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Template Name">
                                <Input value={name} onChange={(event) => setName(event.target.value)} required />
                            </Field>
                            <Field label="Type">
                                <Select
                                    value={type}
                                    onChange={(event) => onTypeChange(event.target.value as TemplateType)}
                                >
                                    {TEMPLATE_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Select>
                                <p className="mt-1 text-xs text-muted-foreground">{typeDescription}</p>
                            </Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Layout Preset">
                                <Select
                                    value={draft.layoutPreset}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, layoutPreset: event.target.value }))}
                                >
                                    {presetOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Accent Tone">
                                <Select
                                    value={draft.accentTone}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, accentTone: event.target.value }))}
                                >
                                    {TEMPLATE_TONE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Select>
                            </Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Headline">
                                <Input
                                    value={draft.headline}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, headline: event.target.value }))}
                                />
                            </Field>
                            <Field label="Subheadline">
                                <Input
                                    value={draft.subheadline}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, subheadline: event.target.value }))}
                                />
                            </Field>
                        </div>

                        <Field label="Footer Note">
                            <Input
                                value={draft.footerNote}
                                onChange={(event) => setDraft((prev) => ({ ...prev, footerNote: event.target.value }))}
                            />
                        </Field>

                        {type === "email" ? (
                            <Field label="Email Body">
                                <textarea
                                    className="min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                    value={draft.htmlBody}
                                    onChange={(event) => setDraft((prev) => ({ ...prev, htmlBody: event.target.value }))}
                                />
                            </Field>
                        ) : null}

                        <Field label="Thumbnail URL">
                            <Input
                                value={thumbnailUrl}
                                onChange={(event) => setThumbnailUrl(event.target.value)}
                                placeholder="Optional image URL for catalog view"
                            />
                        </Field>

                        <div className="grid gap-3 md:grid-cols-2">
                            <SwitchCard
                                title="Default Template"
                                description="Use this as the primary preset for its type."
                                checked={isDefault}
                                onCheckedChange={setIsDefault}
                            />
                            <SwitchCard
                                title="Active"
                                description="Make this template available in admin-managed flows."
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <SwitchCard
                                title="Show Logo"
                                description="Render business identity in the template header."
                                checked={draft.showLogo}
                                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showLogo: checked }))}
                            />
                            {type === "invoice" ? (
                                <SwitchCard
                                    title="Show GST"
                                    description="Keep GST rows visible in invoice totals."
                                    checked={draft.showGst}
                                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showGst: checked }))}
                                />
                            ) : null}
                            {type === "invoice" ? (
                                <SwitchCard
                                    title="Show Signature"
                                    description="Enable approval/signature line in document footer."
                                    checked={draft.showSignature}
                                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showSignature: checked }))}
                                />
                            ) : null}
                            {type === "card" ? (
                                <SwitchCard
                                    title="Show QR"
                                    description="Display a QR-style action area on the card."
                                    checked={draft.showQr}
                                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showQr: checked }))}
                                />
                            ) : null}
                        </div>

                        <div className="rounded-2xl border border-border bg-muted/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">Advanced JSON</p>
                                    <p className="text-sm text-muted-foreground">
                                        Optional extra keys for migration, experimentation, or future renderers.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAdvanced((prev) => !prev)}
                                >
                                    {showAdvanced ? "Hide" : "Show"} JSON
                                </Button>
                            </div>
                            {showAdvanced ? (
                                <textarea
                                    className="mt-4 min-h-[180px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                    value={advancedJson}
                                    onChange={(event) => setAdvancedJson(event.target.value)}
                                />
                            ) : null}
                        </div>

                        {validationError ? (
                            <p className="text-sm font-medium text-destructive">{validationError}</p>
                        ) : null}
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-muted/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Preview</p>
                            <div className="mt-3">
                                <TemplatePreview
                                    type={type}
                                    name={name.trim() || "Untitled Template"}
                                    content={buildTemplateContent({
                                        type,
                                        draft,
                                        extras: (() => {
                                            try {
                                                return parseJsonContent(advancedJson);
                                            } catch {
                                                return {};
                                            }
                                        })(),
                                    })}
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preview Notes</p>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                <li>Structured controls are the source of truth for the main preview.</li>
                                <li>Advanced JSON is merged in for extra keys but does not override headline, layout, or main toggles.</li>
                                <li>Use template presets to keep invoice, card, and email output consistent with Vahi surfaces.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </form>
        </Sheet>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>
            {children}
        </div>
    );
}

function SwitchCard({
    title,
    description,
    checked,
    onCheckedChange,
}: {
    title: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="pr-3">
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}
