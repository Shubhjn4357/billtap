"use client";

import React, { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Offer, offerService } from "@/services/offerService";
import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { Megaphone, Target, Image as ImageIcon, Link as LinkIcon } from "lucide-react";

interface OfferDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    offer?: Offer;
    onSuccess: () => void;
}

export function OfferDrawer({ isOpen, onClose, offer, onSuccess }: OfferDrawerProps) {
    const [formData, setFormData] = useState<Partial<Offer>>({
        id: "",
        title: "",
        message: "",
        audience: "all",
        isActive: true,
        priority: 0,
        bannerUrl: "",
        ctaText: "",
        ctaRoute: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (offer) {
            setFormData(offer);
        } else {
            setFormData({
                id: `off_${Date.now()}`,
                title: "",
                message: "",
                audience: "all",
                isActive: true,
                priority: 0,
                bannerUrl: "",
                ctaText: "",
                ctaRoute: "",
            });
        }
    }, [offer, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (offer) {
                await offerService.upsert(offer.id, formData);
                toast({
                    title: "Success",
                    description: "Banner updated successfully",
                    type: "success"
                });
            } else {
                await offerService.create(formData);
                toast({
                    title: "Success",
                    description: "Banner created successfully",
                    type: "success"
                });
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Offer update failed:", err);
            toast({
                title: "Error",
                description: "Failed to save banner",
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
                        <Input
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
                        <select
                            className="w-full h-10 px-3 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                            value={formData.audience}
                            onChange={(e) => setFormData({ ...formData, audience: e.target.value as "all" | "owners" | "staff" })}
                        >
                            <option value="all">All Users</option>
                            <option value="owners">Owners Only</option>
                            <option value="staff">Staff Only</option>
                        </select>
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
                            <label className="text-sm font-medium">CTA Route / Link</label>
                            <Input
                                placeholder="e.g. /subscription"
                                value={formData.ctaRoute || ""}
                                onChange={(e) => setFormData({ ...formData, ctaRoute: e.target.value })}
                            />
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
