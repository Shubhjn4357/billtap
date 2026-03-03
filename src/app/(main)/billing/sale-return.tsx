import { Redirect } from 'expo-router';

export default function SaleReturnScreen() {
    return <Redirect href="/(main)/billing/create?type=CREDIT_NOTE_DOC" />;
}
