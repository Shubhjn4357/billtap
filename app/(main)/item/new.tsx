import { Stack } from 'expo-router';
import { ItemDetailScreen } from '../../../src/screens/Stock/ItemDetailScreen';

export default function NewItemRoute() {
    return (
        <>
            <Stack.Screen options={{ title: 'Add Item', headerBackTitle: 'Stock' }} />
            <ItemDetailScreen />
        </>
    );
}
