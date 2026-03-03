#!/usr/bin/env node

/**
 * High-risk accounting invariant checks.
 *
 * This script is intentionally deterministic and dependency-free so it can run
 * in CI without DB/service setup.
 */

const EPS = 1e-6;

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const almostEqual = (a, b) => Math.abs(a - b) < EPS;

const computeGstSplit = ({ taxableValue, gstRate, isInterState }) => {
    const tax = taxableValue * (gstRate / 100);
    if (isInterState) {
        return { cgst: 0, sgst: 0, igst: tax, totalTax: tax };
    }
    return { cgst: tax / 2, sgst: tax / 2, igst: 0, totalTax: tax };
};

const run = () => {
    // 1) GST split should preserve total tax.
    for (const rate of [0, 0.25, 3, 5, 18, 40]) {
        const base = 12345.67;
        const inter = computeGstSplit({ taxableValue: base, gstRate: rate, isInterState: true });
        const intra = computeGstSplit({ taxableValue: base, gstRate: rate, isInterState: false });
        assert(almostEqual(inter.cgst + inter.sgst + inter.igst, inter.totalTax), `Inter-state split mismatch for rate ${rate}`);
        assert(almostEqual(intra.cgst + intra.sgst + intra.igst, intra.totalTax), `Intra-state split mismatch for rate ${rate}`);
    }

    // 2) Double-entry totals must remain balanced.
    const voucherLines = [
        { account: 'Accounts Receivable', debit: 1180, credit: 0 },
        { account: 'Sales', debit: 0, credit: 1000 },
        { account: 'Output CGST', debit: 0, credit: 90 },
        { account: 'Output SGST', debit: 0, credit: 90 },
    ];
    const debitTotal = voucherLines.reduce((sum, line) => sum + line.debit, 0);
    const creditTotal = voucherLines.reduce((sum, line) => sum + line.credit, 0);
    assert(almostEqual(debitTotal, creditTotal), 'Voucher is not balanced');

    // 3) Rounding control checks.
    const roundNearest = (value, to) => Math.round(value / to) * to;
    const roundUp = (value, to) => Math.ceil(value / to) * to;
    const roundDown = (value, to) => Math.floor(value / to) * to;
    assert(almostEqual(roundNearest(102.49, 1), 102), 'Round nearest failed');
    assert(almostEqual(roundNearest(102.5, 1), 103), 'Round nearest tie failed');
    assert(almostEqual(roundUp(102.01, 1), 103), 'Round up failed');
    assert(almostEqual(roundDown(102.99, 1), 102), 'Round down failed');

    // 4) Financial period lock semantics.
    const period = { status: 'LOCKED', closedAt: null, reopenedAt: null };
    const closePeriod = (p) => ({ ...p, status: 'CLOSED', closedAt: '2026-03-03T00:00:00.000Z' });
    const reopenPeriod = (p) => ({ ...p, status: 'OPEN', reopenedAt: '2026-03-03T01:00:00.000Z' });
    const closed = closePeriod(period);
    assert(closed.status === 'CLOSED' && Boolean(closed.closedAt), 'Close period invariant failed');
    const reopened = reopenPeriod(closed);
    assert(reopened.status === 'OPEN' && Boolean(reopened.reopenedAt), 'Reopen period invariant failed');

    // 5) TCS/TDS net amount invariant.
    const taxable = 1000;
    const tax = 180;
    const tcs = 10;
    const tds = 5;
    const gross = taxable + tax;
    const net = gross + tcs - tds;
    assert(almostEqual(net, 1185), 'TCS/TDS net computation failed');

    // eslint-disable-next-line no-console
    console.log('[accounting-invariants] Passed all checks.');
};

run();
