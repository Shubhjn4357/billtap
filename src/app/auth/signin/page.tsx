"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { motion } from "framer-motion";
import { LayoutDashboard } from "lucide-react";

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="flex flex-col items-center gap-2 mb-8 text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg mb-2">
                        <LayoutDashboard className="h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Vahi Admin</h1>
                    <p className="text-muted-foreground">Manage your business ecosystem with ease.</p>
                </div>

                <Card className="border-none shadow-2xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl text-center">Sign in</CardTitle>
                        <CardDescription className="text-center">
                            Sign in with your Google account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Button
                            variant="outline"
                            className="h-12 text-base font-semibold"
                            onClick={() => signIn("google", { callbackUrl })}
                        >
                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            Continue with Google
                        </Button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">
                                    Secure Administration
                                </span>
                            </div>
                        </div>
                        <p className="px-8 text-center text-sm text-muted-foreground">
                            By clicking continue, you agree to our{" "}
                            <a href="#" className="underline underline-offset-4 hover:text-primary">
                                Terms of Service
                            </a>{" "}
                            and{" "}
                            <a href="#" className="underline underline-offset-4 hover:text-primary">
                                Privacy Policy
                            </a>
                            .
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-muted/30" />}>
            <SignInContent />
        </Suspense>
    );
}
