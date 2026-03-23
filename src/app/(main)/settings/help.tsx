import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsStatusPill,
} from '../../../components/settings/SettingsBlocks';
import { useSmartBack } from '../../../hooks/useSmartBack';

export default function HelpSettingsScreen() {
    const smartBack = useSmartBack('/(main)/settings');
    const version = Constants.expoConfig?.version ?? '0.0.0';

    return (
        <SettingsPageShell
            title="Help & Support"
            subtitle="Legal pages, release notes, and product support"
            onBackPress={smartBack}
        >
            <SettingsHeroCard
                title="Help that stays findable"
                subtitle="This category owns the legal and support pages only. Operational routes stay in their own categories."
                primaryLabel="Help"
                secondaryLabel={`v${version}`}
            />

            <SettingsSectionGroup
                title="Documents"
                subtitle="Policy and product information stays grouped under one support category."
                action={<SettingsStatusPill label="4 pages" tone="info" />}
            >
                <SettingsLinkRow
                    icon="scale-balance"
                    title="About Vahi"
                    subtitle="App identity, release references, and public product information."
                    onPress={() => router.push('/legal/about' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="file-document-outline"
                    title="Terms of Service"
                    subtitle="Review product usage terms and responsibilities."
                    onPress={() => router.push('/legal/terms' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="shield-account-outline"
                    title="Privacy Policy"
                    subtitle="See how business and user data is handled."
                    onPress={() => router.push('/legal/privacy' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="history"
                    title="Changelog"
                    subtitle="Read feature history and release updates."
                    onPress={() => router.push('/legal/changelog' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
