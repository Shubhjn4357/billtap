import { Redirect } from 'expo-router';

// Purchase Order is routed through estimate/proforma flow until a dedicated PO form is introduced.
export default function PurchaseOrderScreen() {
    return <Redirect href="/(main)/billing/create?type=PROFORMA" />;
}
