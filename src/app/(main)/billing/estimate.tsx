import { Redirect } from 'expo-router';

export default function EstimateScreen() {
    return <Redirect href="/(main)/billing/create?type=ESTIMATE" />;
}
