import { Redirect } from 'expo-router';

export default function PurchaseReturnScreen() {
    return <Redirect href="/(main)/billing/create?type=DEBIT_NOTE_DOC" />;
}
