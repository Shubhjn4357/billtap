"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Megaphone, Users, Target, Trash2 } from "lucide-react";
import { Offer, offerService } from "@/services/offerService";
import { useToast } from "@/components/ui/Toast";
import { OfferDrawer } from "@/components/banners/OfferDrawer";
import { Switch } from "@/components/ui/Switch";
import { getErrorMessage } from "@/lib/api-error";
import { getVahiAppRouteLabel } from "@/lib/vahiAppRoutes";

export default function BannersPage() {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<Offer | undefined>(undefined);
    const { toast } = useToast();

    const fetchOffers = async () => {
        setIsLoading(true);
        try {
            const data = await offerService.getAll();
            setOffers(data);
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to fetch offers."),
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOffers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEdit = (offer: Offer) => {
        setSelectedOffer(offer);
        setIsDrawerOpen(true);
    };

    const handleCreate = () => {
        setSelectedOffer(undefined);
        setIsDrawerOpen(true);
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            await offerService.toggleActive(id, !currentStatus);
            toast({
                title: "Success",
                description: `Offer ${!currentStatus ? "activated" : "deactivated"} successfully`,
                type: "success"
            });
            fetchOffers();
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to toggle offer status."),
                type: "error"
            });
        }
    };

    const handleDelete = async (offer: Offer) => {
        if (!window.confirm(`Delete offer "${offer.title}"?`)) return;
        try {
            await offerService.delete(offer.id);
            toast({
                title: "Success",
                description: "Offer deleted successfully.",
                type: "success",
            });
            await fetchOffers();
        } catch (error) {
            toast({
                title: "Error",
                description: getErrorMessage(error, "Failed to delete offer."),
                type: "error",
            });
        }
    };

    const columns = [
        {
            header: "Offer / Banner",
            accessorKey: "title",
            cell: (offer: Offer) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Megaphone className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-semibold">{offer.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">{offer.message}</p>
                    </div>
                </div>
            )
        },
        {
            header: "Audience",
            accessorKey: "audience",
            cell: (offer: Offer) => (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted w-fit">
                    <Users className="h-3 w-3" />
                    {offer.audience.replace("_", " ")}
                </div>
            )
        },
        {
            header: "Priority",
            accessorKey: "priority",
            cell: (offer: Offer) => (
                <div className="flex items-center gap-1">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{offer.priority}</span>
                </div>
            )
        },
        {
            header: "Redirect",
            accessorKey: "ctaRoute",
            cell: (offer: Offer) => {
                if (!offer.ctaRoute) {
                    return <span className="text-xs text-muted-foreground">No redirect</span>;
                }
                const presetLabel = getVahiAppRouteLabel(offer.ctaRoute);
                return (
                    <div className="space-y-1">
                        <p className="text-xs font-semibold">{presetLabel ?? "Custom link"}</p>
                        <p className="max-w-[220px] truncate text-[11px] text-muted-foreground">{offer.ctaRoute}</p>
                    </div>
                );
            },
        },
        {
            header: "Status",
            accessorKey: "isActive",
            cell: (offer: Offer) => (
                <div className="flex items-center gap-2">
                    <Switch
                        checked={offer.isActive}
                        onCheckedChange={() => handleToggleActive(offer.id, offer.isActive)}
                    />
                    <span className={offer.isActive ? "text-green-600 font-semibold text-[10px] uppercase tracking-wider" : "text-muted-foreground font-semibold text-[10px] uppercase tracking-wider"}>
                        {offer.isActive ? "Live" : "Draft"}
                    </span>
                </div>
            )
        },
        {
            header: "Actions",
            accessorKey: "actions",
            className: "text-right",
            cell: (offer: Offer) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(offer);
                    }}>
                        Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(offer);
                    }} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Banners & Offers</h1>
                    <p className="text-muted-foreground">Manage mobile banners, announcements, and redirect targets for the Vahi app.</p>
                </div>
                <Button onClick={handleCreate} className="h-11 px-6 shadow-lg shadow-primary/20">
                    <Plus className="mr-2 h-5 w-5" />
                    Create Offer
                </Button>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <DataTable
                        columns={columns}
                        data={offers}
                        isLoading={isLoading}
                        onRowClick={handleEdit}
                        emptyMessage="No active offers or banners found."
                    />
                </CardContent>
            </Card>

            <OfferDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                offer={selectedOffer}
                onSuccess={fetchOffers}
            />
        </div>
    );
}
