import { Redirect } from 'expo-router';

// Sale Order is treated as a non-posting order flow and routed through estimate creation.
export default function SaleOrderScreen() {
    return <Redirect href="/(main)/billing/create?type=ESTIMATE" />;
}
