import { useQuery } from '@tanstack/react-query';
import { reportRepository } from '../repositories/reportRepository';
import { reportQueryKeys } from '../state/domainQueryKeys';
import { useBusinessQueryScope } from './useBusinessQueryScope';

export function useReportSummary(
    params: { from: string; to: string },
    options?: { enabled?: boolean; staleTime?: number }
) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.summary(businessId, params),
        queryFn: () => reportRepository.getSummary(params),
        enabled,
        staleTime,
    });

    return {
        ...query,
        summary: query.data?.data ?? null,
    };
}

export function useGstSummaryReport(
    params: { month: number; year: number },
    options?: { enabled?: boolean; staleTime?: number }
) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.gstSummary(businessId, params),
        queryFn: () => reportRepository.getGstSummary(params),
        enabled,
        staleTime,
    });

    return {
        ...query,
        rows: query.data?.data?.rows ?? [],
    };
}

export function useGstr1Report(
    params: { month: number; year: number },
    options?: { enabled?: boolean; staleTime?: number }
) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.gstr1(businessId, params),
        queryFn: () => reportRepository.getGstr1(params),
        enabled,
        staleTime,
    });

    return {
        ...query,
        rows: query.data?.data?.rows ?? [],
    };
}

export function useGstr3bReport(
    params: { month: number; year: number },
    options?: { enabled?: boolean; staleTime?: number }
) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.gstr3b(businessId, params),
        queryFn: () => reportRepository.getGstr3b(params),
        enabled,
        staleTime,
    });

    return {
        ...query,
        rows: query.data?.data?.rows ?? [],
    };
}

export function useBalanceSheet(options?: { enabled?: boolean; staleTime?: number }) {
    const businessId = useBusinessQueryScope();
    const enabled = options?.enabled ?? true;
    const staleTime = options?.staleTime ?? 60_000;

    const query = useQuery({
        queryKey: reportQueryKeys.balanceSheet(businessId),
        queryFn: () => reportRepository.getBalanceSheet(),
        enabled,
        staleTime,
    });

    return {
        ...query,
        assets: query.data?.data?.assets ?? [],
        liabilities: query.data?.data?.liabilities ?? [],
        equity: query.data?.data?.equity ?? [],
        totals: query.data?.data?.totals ?? { assets: 0, liabilities: 0, equity: 0 },
    };
}
