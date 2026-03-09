import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateExpenseQueries } from './useExpenses';
import { useBusinessQueryScope } from './useBusinessQueryScope';
import { ExpenseCategory } from '../constants/enums';
import { expenseRepository } from '../repositories/expenseRepository';

type SaveExpenseInput = {
    id?: string;
    data: Parameters<typeof expenseRepository.create>[0];
};

type BulkExpenseCategoryInput = {
    ids: string[];
    category: ExpenseCategory;
};

export function useExpenseMutations() {
    const queryClient = useQueryClient();
    const businessId = useBusinessQueryScope();

    const saveMutation = useMutation({
        mutationFn: ({ id, data }: SaveExpenseInput) => (
            id ? expenseRepository.update(id, data) : expenseRepository.create(data)
        ),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    const archiveMutation = useMutation({
        mutationFn: (id: string) => expenseRepository.delete(id),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    const restoreMutation = useMutation({
        mutationFn: (id: string) => expenseRepository.restore(id),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    const permanentDeleteMutation = useMutation({
        mutationFn: (id: string) => expenseRepository.permanentDelete(id),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    const bulkArchiveMutation = useMutation({
        mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => expenseRepository.delete(id))),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    const bulkCategoryMutation = useMutation({
        mutationFn: async ({ ids, category }: BulkExpenseCategoryInput) =>
            Promise.all(ids.map((id) => expenseRepository.update(id, { category }))),
        onSuccess: async () => {
            await invalidateExpenseQueries(queryClient, businessId);
        },
    });

    return {
        saveExpense: saveMutation.mutateAsync,
        archiveExpense: archiveMutation.mutateAsync,
        restoreExpense: restoreMutation.mutateAsync,
        permanentlyDeleteExpense: permanentDeleteMutation.mutateAsync,
        archiveExpenses: bulkArchiveMutation.mutateAsync,
        updateExpenseCategories: bulkCategoryMutation.mutateAsync,
        isSavingExpense: saveMutation.isPending,
        isArchivingExpense: archiveMutation.isPending,
        isRestoringExpense: restoreMutation.isPending,
        isDeletingExpensePermanently: permanentDeleteMutation.isPending,
        isArchivingExpenses: bulkArchiveMutation.isPending,
        isUpdatingExpenseCategories: bulkCategoryMutation.isPending,
    };
}
