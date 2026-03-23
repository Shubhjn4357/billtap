import { router } from 'expo-router';
import {
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
} from '../../../components/settings/SettingsBlocks';
import { useSmartBack } from '../../../hooks/useSmartBack';

export default function HelpSettingsScreen() {
    const smartBack = useSmartBack('/(main)/settings');

    return (
        <SettingsPageShell
            title="Help & Support"
            subtitle="Legal, product help, release details, and support shortcuts"
            onBackPress={smartBack}
        >
            <SettingsHeroCard
                title="Help that stays findable"
                subtitle="Support links, legal pages, subscription state, and announcement history stay inside Settings instead of a separate More hub."
                primaryLabel="Help"
                secondaryLabel="Support"
            />

            <SettingsSectionGroup
                title="Support and policy"
                subtitle="The core places users usually look for trust, policy, and release details."
            >
                <SettingsLinkRow
                    icon="file-document-outline"
                    title="Legal center"
                    subtitle="Terms, privacy policy, changelog, and about pages."
                    onPress={() => router.push('/legal' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="crown-outline"
                    title="Subscription"
                    subtitle="Review plan state before diagnosing premium or sync restrictions."
                    onPress={() => router.push('/(main)/settings/subscription' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="bullhorn-outline"
                    title="Announcements"
                    subtitle="Open the latest product notices and communication cards."
                    onPress={() => router.push('/(main)/settings/announcements' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="cloud-sync-outline"
                    title="Sync diagnostics"
                    subtitle="Use this when support needs current queue and connectivity state."
                    onPress={() => router.push('/(main)/settings/sync' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
