import { Redirect } from 'expo-router';

export default function DeliveryChallanScreen() {
    return <Redirect href="/(main)/billing/create?type=DELIVERY_CHALLAN_DOC" />;
}
