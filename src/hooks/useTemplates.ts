import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Template } from "@/types";
import { templateService } from "@/services/templateService";

export function useTemplates() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["templates"],
        queryFn: templateService.getAll,
    });

    const createTemplate = useMutation({
        mutationFn: (newTemplate: Partial<Template>) => templateService.create(newTemplate),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
        },
    });

    const updateTemplate = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<Template> }) => templateService.update(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
        },
    });

    const deleteTemplate = useMutation({
        mutationFn: (id: string) => templateService.remove(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
        },
    });

    return { ...query, createTemplate, updateTemplate, deleteTemplate };
}
