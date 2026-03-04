"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, UserPlus, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { type LiveSnapshot } from "@/services/notificationService";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

export default function LiveUpdatesPage() {
    const { toast } = useToast();
    const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
    const [history, setHistory] = useState<LiveSnapshot[]>([]);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadSnapshot = async () => {
        setLoading(true);
        try {
            const { data: payload } = await api.get<{ ok?: boolean; snapshot?: LiveSnapshot }>("/admin/live/snapshot");
            if (payload.ok && payload.snapshot) {
                setSnapshot(payload.snapshot);
                setHistory((prev) => [payload.snapshot!, ...prev].slice(0, 15));
                setConnected(true);
            }
        } catch (error) {
            setConnected(false);
            toast({
                title: "Live snapshot unavailable",
                description: getErrorMessage(error, "Unable to fetch live snapshot."),
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSnapshot();
        const timer = setInterval(() => {
            void loadSnapshot();
        }, 15_000);

        return () => {
            clearInterval(timer);
            setConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cards = useMemo(() => {
        if (!snapshot) return [];
        return [
            { title: "Signups (24h)", value: snapshot.signupsLast24h, icon: UserPlus, tone: "text-blue-600" },
            { title: "Billing Events (24h)", value: snapshot.billingEventsLast24h, icon: Wallet, tone: "text-green-600" },
            { title: "Error Spikes (24h)", value: snapshot.errorSpikesLast24h, icon: AlertTriangle, tone: "text-red-600" },
            { title: "Queue Spikes", value: snapshot.queueSpikes, icon: Activity, tone: "text-amber-600" },
            { title: "Upgrades (24h)", value: snapshot.upgradesLast24h, icon: ArrowUpRight, tone: "text-green-600" },
            { title: "Downgrades (24h)", value: snapshot.downgradesLast24h, icon: ArrowDownRight, tone: "text-orange-600" },
        ];
    }, [snapshot]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Live Updates</h1>
                    <p className="text-muted-foreground">Near-real-time feed for signups, upgrades, failures, and queue spikes.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={connected ? "text-xs font-semibold text-green-600" : "text-xs font-semibold text-amber-600"}>
                        {connected ? "SSE CONNECTED" : "SSE DISCONNECTED"}
                    </span>
                    <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                    <Card key={card.title}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                {card.title}
                                <card.icon className={`h-4 w-4 ${card.tone}`} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{card.value.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Snapshots</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {history.map((entry, index) => (
                            <div key={`${entry.ts}-${index}`} className="rounded-lg border p-3 text-sm">
                                <div className="font-semibold">{new Date(entry.ts).toLocaleString()}</div>
                                <div className="text-muted-foreground mt-1">
                                    Signups {entry.signupsLast24h} | Billing {entry.billingEventsLast24h} | Errors {entry.errorSpikesLast24h} | Queue {entry.queueSpikes}
                                </div>
                            </div>
                        ))}
                        {history.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No snapshots received yet.</div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
