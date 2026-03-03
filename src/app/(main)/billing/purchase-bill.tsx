import { Redirect } from 'expo-router';

export default function PurchaseBillScreen() {
    return <Redirect href="/(main)/billing/create?type=PURCHASE_BILL" />;
}
