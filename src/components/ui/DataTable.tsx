"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

interface Column<T> {
    header: string;
    accessorKey: keyof T | string;
    cell?: (item: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    isLoading?: boolean;
    onRowClick?: (item: T) => void;
    emptyMessage?: string;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
}

export function DataTable<T extends { id: string | number }>({
    columns,
    data,
    isLoading,
    onRowClick,
    emptyMessage = "No results found.",
    searchPlaceholder = "Search...",
    searchValue,
    onSearchChange,
}: DataTableProps<T>) {
    return (
        <div className="space-y-4">
            {onSearchChange && (
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                    />
                </div>
            )}

            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b">
                            <tr>
                                {columns.map((column, idx) => (
                                    <th
                                        key={idx}
                                        className={cn(
                                            "h-12 px-6 text-left align-middle font-semibold text-muted-foreground",
                                            column.className
                                        )}
                                    >
                                        {column.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                            <p>Loading data...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="h-48 text-center text-muted-foreground">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => onRowClick?.(item)}
                                        className={cn(
                                            "transition-colors hover:bg-muted/30",
                                            onRowClick && "cursor-pointer"
                                        )}
                                    >
                                        {columns.map((column, idx) => (
                                            <td
                                                key={idx}
                                                className={cn(
                                                    "px-6 py-4 align-middle",
                                                    column.className
                                                )}
                                            >
                                                {column.cell
                                                    ? column.cell(item)
                                                    : (item[column.accessorKey as keyof T] as React.ReactNode)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
