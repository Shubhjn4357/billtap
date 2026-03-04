"use client";

import React, { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Template, TemplateType } from "@/types";
import { getErrorMessage } from "@/lib/api-error";

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
        throw new Error("Content must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
};

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
    const [contentJson, setContentJson] = useState("{}");
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValidationError(null);
        if (template) {
            setName(template.name);
            setType(template.type);
            setThumbnailUrl(template.thumbnailUrl ?? "");
            setIsDefault(Boolean(template.isDefault));
            setIsActive(Boolean(template.isActive));
            setContentJson(JSON.stringify(template.content ?? {}, null, 2));
            return;
        }
        setName("");
        setType("invoice");
        setThumbnailUrl("");
        setIsDefault(false);
        setIsActive(true);
        setContentJson("{}");
    }, [isOpen, template]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setValidationError(null);
        try {
            const content = parseJsonContent(contentJson);
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

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={template ? "Edit Template" : "Create Template"}
            description={template ? `Updating ${template.name}` : "Create a new admin-managed template."}
            footer={(
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} isLoading={isSaving}>
                        {template ? "Save Changes" : "Create Template"}
                    </Button>
                </div>
            )}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Template Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <Select
                            value={type}
                            onChange={(e) => setType(e.target.value as TemplateType)}
                        >
                            <option value="invoice">Invoice</option>
                            <option value="card">Card</option>
                            <option value="email">Email</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Thumbnail URL</label>
                        <Input
                            value={thumbnailUrl}
                            onChange={(e) => setThumbnailUrl(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Content (JSON)</label>
                    <textarea
                        className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={contentJson}
                        onChange={(e) => setContentJson(e.target.value)}
                    />
                    {validationError ? (
                        <p className="text-xs text-destructive">{validationError}</p>
                    ) : null}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded-md border border-input p-3">
                        <span className="text-sm">Set as default</span>
                        <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-input p-3">
                        <span className="text-sm">Active</span>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                </div>
            </form>
        </Sheet>
    );
}
