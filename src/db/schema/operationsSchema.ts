import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import {
    amountTypeEnum,
    attendanceStatusEnum,
    payrollCategoryEnum,
    periodStatusEnum,
    requestModuleEnum,
    requestStatusEnum,
    requestTypeEnum,
    salaryRunStatusEnum,
} from './enums';
import { createCreatedAt, createOwnerScope, createTimestamps } from './common';

export const businessControls = pgTable('business_controls', {
    userId: text('userId').primaryKey().notNull(),
    makerCheckerEnabled: boolean('makerCheckerEnabled').default(true).notNull(),
    journalApprovalRequired: boolean('journalApprovalRequired').default(true).notNull(),
    stockAdjustmentApprovalRequired: boolean('stockAdjustmentApprovalRequired').default(true).notNull(),
    periodLockEnabled: boolean('periodLockEnabled').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('business_controls_user_idx').on(table.userId),
}));

export const approvalRequests = pgTable('approval_requests', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    module: requestModuleEnum('module').notNull(),
    requestType: requestTypeEnum('requestType').notNull(),
    requestedBy: text('requestedBy').notNull(),
    requestedByRole: text('requestedByRole'),
    status: requestStatusEnum('status').default('pending').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    reason: text('reason'),
    reviewedBy: text('reviewedBy'),
    reviewedAt: timestamp('reviewedAt', { withTimezone: true, mode: 'date' }),
    reviewNote: text('reviewNote'),
    ...createTimestamps(),
}, (table) => ({
    userStatusIndex: index('approval_requests_user_status_idx').on(table.userId, table.status),
    moduleIndex: index('approval_requests_module_idx').on(table.module),
    requesterIndex: index('approval_requests_requester_idx').on(table.requestedBy),
    createdIndex: index('approval_requests_created_idx').on(table.createdAt),
}));

export const auditLogs = pgTable('audit_logs', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    actorUid: text('actorUid').notNull(),
    actorRole: text('actorRole'),
    module: text('module').notNull(),
    action: text('action').notNull(),
    entityType: text('entityType'),
    entityId: text('entityId'),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null> | null>(),
    ...createCreatedAt(),
}, (table) => ({
    userIndex: index('audit_logs_user_idx').on(table.userId),
    moduleIndex: index('audit_logs_module_idx').on(table.module),
    actorIndex: index('audit_logs_actor_idx').on(table.actorUid),
    createdIndex: index('audit_logs_created_idx').on(table.createdAt),
}));

export const accountingPeriods = pgTable('accounting_periods', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    periodStart: timestamp('periodStart', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('periodEnd', { withTimezone: true, mode: 'date' }).notNull(),
    status: periodStatusEnum('status').default('open').notNull(),
    lockedBy: text('lockedBy'),
    lockedAt: timestamp('lockedAt', { withTimezone: true, mode: 'date' }),
    closedBy: text('closedBy'),
    closedAt: timestamp('closedAt', { withTimezone: true, mode: 'date' }),
    notes: text('notes'),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('accounting_periods_user_idx').on(table.userId),
    rangeIndex: index('accounting_periods_range_idx').on(table.periodStart, table.periodEnd),
    statusIndex: index('accounting_periods_status_idx').on(table.status),
}));

export const branches = pgTable('branches', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: text('address'),
    isPrimary: boolean('isPrimary').default(false).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('branches_user_idx').on(table.userId),
    codeIndex: index('branches_code_idx').on(table.code),
}));

export const attendanceRecords = pgTable('attendance_records', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    staffUid: text('staffUid').notNull(),
    shiftName: text('shiftName'),
    checkInAt: timestamp('checkInAt', { withTimezone: true, mode: 'date' }).notNull(),
    checkOutAt: timestamp('checkOutAt', { withTimezone: true, mode: 'date' }),
    overtimeMinutes: integer('overtimeMinutes').default(0).notNull(),
    status: attendanceStatusEnum('status').default('present').notNull(),
    notes: text('notes'),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('attendance_records_user_idx').on(table.userId),
    staffIndex: index('attendance_records_staff_idx').on(table.staffUid),
    dateIndex: index('attendance_records_checkin_idx').on(table.checkInAt),
}));

export const payrollComponents = pgTable('payroll_components', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: payrollCategoryEnum('category').notNull(),
    amountType: amountTypeEnum('amountType').default('fixed').notNull(),
    value: doublePrecision('value').default(0).notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('payroll_components_user_idx').on(table.userId),
    codeIndex: index('payroll_components_code_idx').on(table.code),
    categoryIndex: index('payroll_components_category_idx').on(table.category),
}));

export const salaryRuns = pgTable('salary_runs', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    periodStart: timestamp('periodStart', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('periodEnd', { withTimezone: true, mode: 'date' }).notNull(),
    status: salaryRunStatusEnum('status').default('draft').notNull(),
    totalGross: doublePrecision('totalGross').default(0).notNull(),
    totalDeductions: doublePrecision('totalDeductions').default(0).notNull(),
    totalNet: doublePrecision('totalNet').default(0).notNull(),
    journalEntryId: text('journalEntryId'),
    createdBy: text('createdBy').notNull(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('salary_runs_user_idx').on(table.userId),
    periodIndex: index('salary_runs_period_idx').on(table.periodStart, table.periodEnd),
    statusIndex: index('salary_runs_status_idx').on(table.status),
}));

export const salaryRunItems = pgTable('salary_run_items', {
    id: text('id').primaryKey(),
    ...createOwnerScope(),
    runId: text('runId').notNull(),
    staffUid: text('staffUid').notNull(),
    attendanceDays: doublePrecision('attendanceDays').default(0).notNull(),
    overtimeMinutes: integer('overtimeMinutes').default(0).notNull(),
    grossPay: doublePrecision('grossPay').default(0).notNull(),
    deductions: doublePrecision('deductions').default(0).notNull(),
    netPay: doublePrecision('netPay').default(0).notNull(),
    componentBreakdown: jsonb('componentBreakdown').$type<Array<{
        componentId: string;
        code: string;
        name: string;
        category: 'earning' | 'deduction' | 'statutory';
        amount: number;
    }>>().default([]).notNull(),
    payslipData: jsonb('payslipData').$type<Record<string, unknown> | null>(),
    ...createTimestamps(),
}, (table) => ({
    userIndex: index('salary_run_items_user_idx').on(table.userId),
    runIndex: index('salary_run_items_run_idx').on(table.runId),
    staffIndex: index('salary_run_items_staff_idx').on(table.staffUid),
}));

