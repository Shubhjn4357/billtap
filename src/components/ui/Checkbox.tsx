"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}

export function Checkbox({ checked, onCheckedChange, disabled, className }: CheckboxProps) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onCheckedChange(!checked)}
            className={cn(
                "peer h-5 w-5 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center transition-colors",
                checked ? "bg-primary text-primary-foreground" : "bg-background",
                className
            )}
        >
            <AnimatePresence>
                {checked && (
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                    >
                        <Check className="h-4 w-4 stroke-[3px]" />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );
}
