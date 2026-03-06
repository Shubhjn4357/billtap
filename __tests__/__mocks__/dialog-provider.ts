export const useAppDialog = () => ({
    alert: () => {},
    confirm: async () => false,
});
export const DialogProvider = ({ children }: { children: unknown }) => children;
