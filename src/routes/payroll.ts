import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ensureSystemAccounts } from '../accounting/systemAccounts';
import { withTransaction } from '../db/transaction';
import {
    attendanceRecords,
    journalEntries,
    journalLines,
    payrollComponents,
    salaryRunItems,
    salaryRuns,
    users,
} from '../db/schema';
import { requireAuth, type AppEnv } from '../middleware/auth';
import {
    ensurePeriodUnlockedForDate,
    hasModulePermission,
    writeAuditLog,
} from '../operations/controls';

const payrollRoute = new Hono<AppEnv>();

const roundAmount = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const toDate = (value: string | Date | undefined, fallback: Date): Date => {
    if (!value) return fallback;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed;
};

payrollRoute.post('/attendance/check-in', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Attendance create access denied.' }, 403);
        }

        const body = await c.req.json();
        const payload = z.object({
            staffUid: z.string().optional(),
            branchId: z.string().optional(),
            shiftName: z.string().optional(),
            checkInAt: z.coerce.date().optional(),
            notes: z.string().optional(),
        }).parse(body);

        const staffUid = payload.staffUid ?? authUser.uid;
        const db = c.get('db');
        const now = new Date();
        const checkInAt = payload.checkInAt ?? now;

        const id = nanoid();
        await db.insert(attendanceRecords).values({
            id,
            userId: effectiveUserId,
            staffUid,
            branchId: payload.branchId ?? null,
            shiftName: payload.shiftName ?? null,
            checkInAt,
            checkOutAt: null,
            overtimeMinutes: 0,
            status: 'present',
            notes: payload.notes ?? null,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'admin',
            action: 'attendance.checked_in',
            entityType: 'attendance',
            entityId: id,
            after: { staffUid, checkInAt: checkInAt.toISOString() },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to check in.' }, 400);
    }
});

payrollRoute.post('/attendance/:id/check-out', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'update')) {
            return c.json({ ok: false, message: 'Attendance update access denied.' }, 403);
        }

        const id = c.req.param('id');
        const body = await c.req.json();
        const payload = z.object({
            checkOutAt: z.coerce.date().optional(),
            overtimeMinutes: z.number().int().nonnegative().optional(),
            status: z.enum(['present', 'absent', 'half-day', 'leave']).optional(),
            notes: z.string().optional(),
        }).parse(body);

        const db = c.get('db');
        const checkOutAt = payload.checkOutAt ?? new Date();
        const updated = await db
            .update(attendanceRecords)
            .set({
                checkOutAt,
                overtimeMinutes: payload.overtimeMinutes ?? 0,
                status: payload.status ?? 'present',
                notes: payload.notes ?? null,
                updatedAt: new Date(),
            })
            .where(and(eq(attendanceRecords.id, id), eq(attendanceRecords.userId, effectiveUserId)))
            .returning({ id: attendanceRecords.id });

        if (!updated[0]) return c.json({ ok: false, message: 'Attendance record not found.' }, 404);

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'admin',
            action: 'attendance.checked_out',
            entityType: 'attendance',
            entityId: id,
            after: {
                checkOutAt: checkOutAt.toISOString(),
                overtimeMinutes: payload.overtimeMinutes ?? 0,
                status: payload.status ?? 'present',
            },
        });

        return c.json({ ok: true });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to check out.' }, 400);
    }
});

payrollRoute.get('/attendance', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Attendance access denied.' }, 403);
    }

    const start = toDate(c.req.query('start'), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const end = toDate(c.req.query('end'), new Date());
    const staffUid = c.req.query('staffUid');
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 200), 1), 1000);

    const conditions = [
        eq(attendanceRecords.userId, effectiveUserId),
        gte(attendanceRecords.checkInAt, start),
        lte(attendanceRecords.checkInAt, end),
    ];
    if (staffUid) {
        conditions.push(eq(attendanceRecords.staffUid, staffUid));
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(attendanceRecords)
        .where(and(...conditions))
        .orderBy(desc(attendanceRecords.checkInAt))
        .limit(limit);

    return c.json({ ok: true, records: rows });
});

payrollRoute.get('/components', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Payroll access denied.' }, 403);
    }

    const db = c.get('db');
    const rows = await db
        .select()
        .from(payrollComponents)
        .where(eq(payrollComponents.userId, effectiveUserId))
        .orderBy(asc(payrollComponents.category), asc(payrollComponents.code));

    return c.json({ ok: true, components: rows });
});

payrollRoute.post('/components', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Payroll setup access denied.' }, 403);
        }

        const body = await c.req.json();
        const payload = z.object({
            code: z.string().min(1).max(32),
            name: z.string().min(1).max(100),
            category: z.enum(['earning', 'deduction', 'statutory']),
            amountType: z.enum(['fixed', 'percent']).default('fixed'),
            value: z.number().nonnegative(),
            isActive: z.boolean().default(true),
        }).parse(body);

        const db = c.get('db');
        const id = nanoid();
        const now = new Date();
        await db.insert(payrollComponents).values({
            id,
            userId: effectiveUserId,
            code: payload.code.trim().toUpperCase(),
            name: payload.name.trim(),
            category: payload.category,
            amountType: payload.amountType,
            value: payload.value,
            isActive: payload.isActive,
            createdAt: now,
            updatedAt: now,
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'admin',
            action: 'payroll.component_created',
            entityType: 'payroll_component',
            entityId: id,
            after: {
                code: payload.code,
                category: payload.category,
                amountType: payload.amountType,
                value: payload.value,
            },
        });

        return c.json({ ok: true, id });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to save component.' }, 400);
    }
});

payrollRoute.post('/salary-runs/generate', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'create')) {
            return c.json({ ok: false, message: 'Payroll generate access denied.' }, 403);
        }

        const body = await c.req.json();
        const payload = z.object({
            periodStart: z.coerce.date(),
            periodEnd: z.coerce.date(),
            branchId: z.string().optional(),
            includeStaffUids: z.array(z.string()).optional(),
            basePay: z.number().nonnegative().default(0),
            staffBasePay: z.record(z.string(), z.number().nonnegative()).optional(),
            overtimeRatePerHour: z.number().nonnegative().default(0),
            applyAttendanceProration: z.boolean().default(false),
        }).parse(body);

        if (payload.periodStart.getTime() > payload.periodEnd.getTime()) {
            return c.json({ ok: false, message: 'periodStart must be before periodEnd.' }, 400);
        }

        const db = c.get('db');
        const now = new Date();
        const periodDays = Math.max(
            1,
            Math.floor((payload.periodEnd.getTime() - payload.periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
        );

        const staffFilters = [
            eq(users.ownerId, effectiveUserId),
            eq(users.role, 'staff'),
        ];
        if (payload.includeStaffUids && payload.includeStaffUids.length > 0) {
            staffFilters.push(inArray(users.uid, payload.includeStaffUids));
        }

        const staffRows = await db
            .select({ uid: users.uid, displayName: users.displayName, phoneNumber: users.phoneNumber })
            .from(users)
            .where(and(...staffFilters));

        if (staffRows.length === 0) {
            return c.json({ ok: false, message: 'No staff found for payroll run.' }, 400);
        }

        const attendanceConditions = [
            eq(attendanceRecords.userId, effectiveUserId),
            gte(attendanceRecords.checkInAt, payload.periodStart),
            lte(attendanceRecords.checkInAt, payload.periodEnd),
            inArray(attendanceRecords.staffUid, staffRows.map((staff) => staff.uid)),
        ];
        const attendance = await db
            .select()
            .from(attendanceRecords)
            .where(and(...attendanceConditions));

        const components = await db
            .select()
            .from(payrollComponents)
            .where(and(eq(payrollComponents.userId, effectiveUserId), eq(payrollComponents.isActive, true)))
            .orderBy(asc(payrollComponents.code));

        const attendanceByStaff = new Map<string, typeof attendance>();
        for (const row of attendance) {
            const current = attendanceByStaff.get(row.staffUid) ?? [];
            current.push(row);
            attendanceByStaff.set(row.staffUid, current);
        }

        const runId = nanoid();
        const runItems: Array<typeof salaryRunItems.$inferInsert> = [];
        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;

        for (const staff of staffRows) {
            const rows = attendanceByStaff.get(staff.uid) ?? [];
            let attendanceDays = 0;
            let overtimeMinutes = 0;
            for (const row of rows) {
                if (row.status === 'half-day') {
                    attendanceDays += 0.5;
                } else if (row.status === 'present') {
                    attendanceDays += 1;
                }
                overtimeMinutes += Number(row.overtimeMinutes ?? 0);
            }

            const staffBasePay = payload.staffBasePay?.[staff.uid] ?? payload.basePay;
            const attendanceFactor = payload.applyAttendanceProration ? Math.min(1, attendanceDays / periodDays) : 1;
            const proratedBasePay = roundAmount(staffBasePay * attendanceFactor);
            const overtimeAmount = roundAmount((overtimeMinutes / 60) * payload.overtimeRatePerHour);

            let earnings = 0;
            let deductions = 0;
            const breakdown: Array<{
                componentId: string;
                code: string;
                name: string;
                category: 'earning' | 'deduction' | 'statutory';
                amount: number;
            }> = [];

            breakdown.push({
                componentId: 'BASE',
                code: 'BASE',
                name: 'Base Pay',
                category: 'earning',
                amount: proratedBasePay,
            });
            if (overtimeAmount > 0) {
                breakdown.push({
                    componentId: 'OVERTIME',
                    code: 'OVERTIME',
                    name: 'Overtime',
                    category: 'earning',
                    amount: overtimeAmount,
                });
            }

            for (const component of components) {
                const rawAmount = component.amountType === 'percent'
                    ? (proratedBasePay * Number(component.value ?? 0)) / 100
                    : Number(component.value ?? 0);
                const amount = roundAmount(rawAmount);
                if (amount <= 0) continue;

                breakdown.push({
                    componentId: component.id,
                    code: component.code,
                    name: component.name,
                    category: component.category as 'earning' | 'deduction' | 'statutory',
                    amount,
                });

                if (component.category === 'earning') {
                    earnings += amount;
                } else {
                    deductions += amount;
                }
            }

            const grossPay = roundAmount(proratedBasePay + overtimeAmount + earnings);
            const totalDeduction = roundAmount(deductions);
            const netPay = roundAmount(Math.max(grossPay - totalDeduction, 0));

            totalGross += grossPay;
            totalDeductions += totalDeduction;
            totalNet += netPay;

            runItems.push({
                id: nanoid(),
                userId: effectiveUserId,
                runId,
                staffUid: staff.uid,
                attendanceDays,
                overtimeMinutes,
                grossPay,
                deductions: totalDeduction,
                netPay,
                componentBreakdown: breakdown,
                payslipData: {
                    staffName: staff.displayName ?? staff.phoneNumber ?? staff.uid,
                    periodStart: payload.periodStart.toISOString(),
                    periodEnd: payload.periodEnd.toISOString(),
                    attendanceDays,
                    overtimeMinutes,
                    breakdown,
                    grossPay,
                    deductions: totalDeduction,
                    netPay,
                },
                createdAt: now,
                updatedAt: now,
            });
        }

        await withTransaction(db, async (tx) => {
            await tx.insert(salaryRuns).values({
                id: runId,
                userId: effectiveUserId,
                branchId: payload.branchId ?? null,
                periodStart: payload.periodStart,
                periodEnd: payload.periodEnd,
                status: 'draft',
                totalGross: roundAmount(totalGross),
                totalDeductions: roundAmount(totalDeductions),
                totalNet: roundAmount(totalNet),
                journalEntryId: null,
                createdBy: authUser.uid,
                createdAt: now,
                updatedAt: now,
            });
            if (runItems.length > 0) {
                await tx.insert(salaryRunItems).values(runItems);
            }
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'payroll.run_generated',
            entityType: 'salary_run',
            entityId: runId,
            after: {
                periodStart: payload.periodStart.toISOString(),
                periodEnd: payload.periodEnd.toISOString(),
                itemCount: runItems.length,
                totalNet: roundAmount(totalNet),
            },
        });

        return c.json({
            ok: true,
            runId,
            summary: {
                staffCount: runItems.length,
                totalGross: roundAmount(totalGross),
                totalDeductions: roundAmount(totalDeductions),
                totalNet: roundAmount(totalNet),
            },
        });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to generate salary run.' }, 400);
    }
});

payrollRoute.get('/salary-runs', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Payroll access denied.' }, 403);
    }

    const limit = Math.min(Math.max(Number(c.req.query('limit') || 100), 1), 500);
    const db = c.get('db');
    const rows = await db
        .select()
        .from(salaryRuns)
        .where(eq(salaryRuns.userId, effectiveUserId))
        .orderBy(desc(salaryRuns.periodStart))
        .limit(limit);

    return c.json({ ok: true, runs: rows });
});

payrollRoute.get('/salary-runs/:id', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Payroll access denied.' }, 403);
    }

    const id = c.req.param('id');
    const db = c.get('db');
    const [run] = await db
        .select()
        .from(salaryRuns)
        .where(and(eq(salaryRuns.id, id), eq(salaryRuns.userId, effectiveUserId)))
        .limit(1);
    if (!run) return c.json({ ok: false, message: 'Salary run not found.' }, 404);

    const items = await db
        .select()
        .from(salaryRunItems)
        .where(and(eq(salaryRunItems.runId, id), eq(salaryRunItems.userId, effectiveUserId)))
        .orderBy(asc(salaryRunItems.staffUid));

    return c.json({ ok: true, run, items });
});

payrollRoute.post('/salary-runs/:id/finalize', requireAuth, async (c) => {
    try {
        const effectiveUserId = c.get('effectiveUserId');
        const authUser = c.get('authUser');
        if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
        if (!hasModulePermission(authUser, 'accounting', 'approve')) {
            return c.json({ ok: false, message: 'Payroll finalize access denied.' }, 403);
        }

        const id = c.req.param('id');
        const db = c.get('db');
        const now = new Date();

        const [run] = await db
            .select()
            .from(salaryRuns)
            .where(and(eq(salaryRuns.id, id), eq(salaryRuns.userId, effectiveUserId)))
            .limit(1);
        if (!run) return c.json({ ok: false, message: 'Salary run not found.' }, 404);
        if (run.status === 'finalized') {
            return c.json({ ok: true, journalEntryId: run.journalEntryId, status: run.status });
        }

        await ensurePeriodUnlockedForDate(db, effectiveUserId, run.periodEnd);

        const result = await withTransaction(db, async (tx) => {
            const accountMap = await ensureSystemAccounts(tx, effectiveUserId, now);
            const payrollExpenseAccountId = accountMap.get('5200');
            const salaryPayableAccountId = accountMap.get('2200');
            if (!payrollExpenseAccountId || !salaryPayableAccountId) {
                throw new Error('Payroll system accounts are not available.');
            }

            const entryId = nanoid();
            const totalNet = roundAmount(Number(run.totalNet ?? 0));
            await tx.insert(journalEntries).values({
                id: entryId,
                userId: effectiveUserId,
                branchId: run.branchId ?? null,
                costCenter: null,
                projectCode: null,
                entryDate: run.periodEnd,
                batchNumber: null,
                referenceType: 'PAYROLL_RUN',
                referenceId: run.id,
                narration: `Payroll run ${run.id} finalized`,
                currency: 'INR',
                createdAt: now,
            });

            await tx.insert(journalLines).values([
                {
                    id: nanoid(),
                    entryId,
                    userId: effectiveUserId,
                    accountId: payrollExpenseAccountId,
                    partyId: null,
                    debit: totalNet,
                    credit: 0,
                    hsn: null,
                    gstRate: 0,
                    taxType: null,
                    createdAt: now,
                },
                {
                    id: nanoid(),
                    entryId,
                    userId: effectiveUserId,
                    accountId: salaryPayableAccountId,
                    partyId: null,
                    debit: 0,
                    credit: totalNet,
                    hsn: null,
                    gstRate: 0,
                    taxType: null,
                    createdAt: now,
                },
            ]);

            await tx
                .update(salaryRuns)
                .set({
                    status: 'finalized',
                    journalEntryId: entryId,
                    updatedAt: now,
                })
                .where(eq(salaryRuns.id, run.id));

            return { entryId };
        });

        await writeAuditLog(db, {
            userId: effectiveUserId,
            actorUid: authUser.uid,
            actorRole: authUser.role,
            module: 'accounting',
            action: 'payroll.run_finalized',
            entityType: 'salary_run',
            entityId: id,
            after: {
                status: 'finalized',
                journalEntryId: result.entryId,
            },
        });

        return c.json({ ok: true, journalEntryId: result.entryId, status: 'finalized' });
    } catch (error: unknown) {
        return c.json({ ok: false, message: error instanceof Error ? error.message : 'Failed to finalize run.' }, 400);
    }
});

payrollRoute.get('/salary-runs/:id/payslip/:staffUid', requireAuth, async (c) => {
    const effectiveUserId = c.get('effectiveUserId');
    const authUser = c.get('authUser');
    if (!effectiveUserId || !authUser) return c.json({ ok: false, message: 'Unauthorized.' }, 401);
    if (!hasModulePermission(authUser, 'accounting', 'view')) {
        return c.json({ ok: false, message: 'Payroll access denied.' }, 403);
    }

    const runId = c.req.param('id');
    const staffUid = c.req.param('staffUid');
    const db = c.get('db');
    const [run] = await db
        .select()
        .from(salaryRuns)
        .where(and(eq(salaryRuns.id, runId), eq(salaryRuns.userId, effectiveUserId)))
        .limit(1);
    if (!run) return c.json({ ok: false, message: 'Salary run not found.' }, 404);

    const [item] = await db
        .select()
        .from(salaryRunItems)
        .where(and(
            eq(salaryRunItems.runId, runId),
            eq(salaryRunItems.userId, effectiveUserId),
            eq(salaryRunItems.staffUid, staffUid)
        ))
        .limit(1);
    if (!item) return c.json({ ok: false, message: 'Payslip entry not found.' }, 404);

    const [staff] = await db
        .select({ uid: users.uid, displayName: users.displayName, phoneNumber: users.phoneNumber, email: users.email })
        .from(users)
        .where(eq(users.uid, staffUid))
        .limit(1);

    return c.json({
        ok: true,
        format: 'json',
        payslip: {
            runId: run.id,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            staff: {
                uid: staffUid,
                displayName: staff?.displayName ?? null,
                phoneNumber: staff?.phoneNumber ?? null,
                email: staff?.email ?? null,
            },
            grossPay: item.grossPay,
            deductions: item.deductions,
            netPay: item.netPay,
            attendanceDays: item.attendanceDays,
            overtimeMinutes: item.overtimeMinutes,
            breakdown: item.componentBreakdown,
            generatedAt: new Date(),
        },
    });
});

export default payrollRoute;
