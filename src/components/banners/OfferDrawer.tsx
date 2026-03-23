"use client";

import React, { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { offerService, type Offer } from "@/services/offerService";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { Megaphone, Target, Image as ImageIcon, Link as LinkIcon, CalendarClock, Sparkles } from "lucide-react";
import { getErrorMessage } from "@/lib/api-error";
import { Select } from "@/components/ui/Select";
import { VAHI_APP_ROUTE_GROUPS, getVahiAppRouteLabel, isPresetVahiAppRoute } from "@/lib/vahiAppRoutes";

interface OfferDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    offer?: Offer;
    onSuccess: () => void;
}

const toDateTimeLocal = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function OfferDrawer({ isOpen, onClose, offer, onSuccess }: OfferDrawerProps) {
    const [routeChoice, setRouteChoice] = useState("");
    const [formData, setFormData] = useState<Partial<Offer>>({
        id: "",
        title: "",
        message: "",
        audience: "all",
        isActive: true,
        priority: 0,
        bannerUrl: "",
        bannerBackground: "",
        ctaText: "",
        ctaRoute: "",
        startsAt: "",
        endsAt: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (offer) {
            const normalizedRoute = offer.ctaRoute?.trim() ?? "";
            setFormData({
                ...offer,
                bannerUrl: offer.bannerUrl ?? "",
                bannerBackground: offer.bannerBackground ?? "",
                ctaText: offer.ctaText ?? "",
                ctaRoute: normalizedRoute,
                startsAt: toDateTimeLocal(offer.startsAt),
                endsAt: toDateTimeLocal(offer.endsAt),
            });
            setRouteChoice(
                !normalizedRoute
                    ? ""
                    : isPresetVahiAppRoute(normalizedRoute)
                        ? normalizedRoute
                        : "__custom__"
            );
        } else {
            setFormData({
                id: `off_${Date.now()}`,
                title: "",
                message: "",
                audience: "all",
                isActive: true,
                priority: 0,
                bannerUrl: "",
                bannerBackground: "",
                ctaText: "",
                ctaRoute: "",
                startsAt: "",
                endsAt: "",
            });
            setRouteChoice("");
        }
    }, [offer, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.startsAt && formData.endsAt && new Date(formData.endsAt).getTime() < new Date(formData.startsAt).getTime()) {
            toast({
                title: "Invalid schedule",
                description: "End time must be after the start time.",
                type: "error",
            });
            return;
        }
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                bannerUrl: formData.bannerUrl?.trim() || null,
                bannerBackground: formData.bannerBackground?.trim() || null,
                ctaText: formData.ctaText?.trim() || null,
                ctaRoute: formData.ctaRoute?.trim() || null,
                startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
                endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : null,
            };

            if (offer) {
                await offerService.upsert(offer.id, payload);
                toast({
                    title: "Success",
                    description: "Banner updated successfully",
                    type: "success"
                });
            } else {
                await offerService.create(payload);
                toast({
                    title: "Success",
                    description: "Banner created successfully",
                    type: "success"
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Offer update failed:", error);
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to save banner."),
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={offer ? "Edit Banner" : "Create New Banner"}
            description={offer ? `Updating banner: ${offer.title}` : "Create a system-wide notification or promotional offer."}
            footer={
                <div className="flex gap-3 justify-end w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} isLoading={isLoading}>
                        {offer ? "Save Changes" : "Publish Banner"}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Megaphone className="h-4 w-4" />
                        Content & Layout
                    </h3>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Banner Title</label>
                        <Input
                            placeholder="e.g. 50% Off Annual Plans"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Message / Description</label>
                        <textarea
                            className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            placeholder="Detailed text for the banner..."
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Targeting
                    </h3>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Audience</label>
                        <Select
                            value={formData.audience}
                            onChange={(e) => setFormData({ ...formData, audience: e.target.value as "all" | "owners" | "staff" })}
                        >
                            <option value="all">All Users</option>
                            <option value="owners">Owners Only</option>
                            <option value="staff">Staff Only</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Priority (Higher = Top)</label>
                        <Input
                            type="number"
                            placeholder="0"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        CTA & Media
                    </h3>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Banner Image URL (Optional)</label>
                        <div className="relative">
                            <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                placeholder="https://..."
                                value={formData.bannerUrl || ""}
                                onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Banner Background (Optional)</label>
                        <Input
                            placeholder="e.g. linear-gradient(...) or #123456"
                            value={formData.bannerBackground || ""}
                            onChange={(e) => setFormData({ ...formData, bannerBackground: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">CTA Button Text</label>
                            <Input
                                placeholder="e.g. Upgrade Now"
                                value={formData.ctaText || ""}
                                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Redirect Destination</label>
                            <Select
                                value={routeChoice}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setRouteChoice(next);
                                    if (!next) {
                                        setFormData({ ...formData, ctaRoute: "" });
                                        return;
                                    }
                                    if (next === "__custom__") return;
                                    setFormData({ ...formData, ctaRoute: next });
                                }}
                            >
                                <option value="">No redirect</option>
                                <option value="__custom__">Custom route or deep link</option>
                                {VAHI_APP_ROUTE_GROUPS.map(([group, options]) => (
                                    <optgroup key={group} label={group}>
                                        {options.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Select>
                        </div>
                    </div>
                    {routeChoice === "__custom__" ? (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Custom Route / Deep Link</label>
                            <Input
                                placeholder="e.g. /settings/subscription or https://example.com"
                                value={formData.ctaRoute || ""}
                                onChange={(e) => setFormData({ ...formData, ctaRoute: e.target.value })}
                            />
                        </div>
                    ) : null}
                    {formData.ctaRoute ? (
                        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                                {getVahiAppRouteLabel(formData.ctaRoute) ?? "Custom destination"}
                            </span>
                            <span className="ml-2">{formData.ctaRoute}</span>
                        </div>
                    ) : null}
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Schedule
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Starts At</label>
                            <Input
                                type="datetime-local"
                                value={String(formData.startsAt || "")}
                                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ends At</label>
                            <Input
                                type="datetime-local"
                                value={String(formData.endsAt || "")}
                                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Preview
                    </h3>
                    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile offer card</p>
                        <div
                            className="mt-3 rounded-2xl border border-border px-4 py-4"
                            style={{
                                background: formData.bannerBackground?.trim() || undefined,
                            }}
                        >
                            <p className="text-base font-semibold text-foreground">{formData.title || "Banner title preview"}</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {formData.message || "Offer or announcement message will appear here."}
                            </p>
                            {formData.ctaText || formData.ctaRoute ? (
                                <p className="mt-3 text-sm font-semibold text-primary">
                                    {(formData.ctaText || "Open").trim()}
                                    {formData.ctaRoute ? ` -> ${getVahiAppRouteLabel(formData.ctaRoute) ?? formData.ctaRoute}` : ""}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold">Live Status</p>
                        <p className="text-xs text-muted-foreground">Make this banner visible immediately.</p>
                    </div>
                    <Switch
                        checked={formData.isActive || false}
                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                </div>
            </form>
        </Sheet>
    );
}
