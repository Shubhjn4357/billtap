import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { SettingsPageShell, SettingsSectionGroup, SettingsLinkRow } from './SettingsBlocks';
import { SettingsSectionCard } from './SettingsSectionCard';
import { useSmartBack } from '../../hooks/useSmartBack';

type SettingsCategoryScreenProps = {
    title: string;
    subtitle: string;
    sections: {
        key: string;
        subtitle?: string;
    }[];
    utilityLinks?: {
        title: string;
        subtitle: string;
        route: string;
        icon: ComponentProps<typeof SettingsLinkRow>['icon'];
        value?: string;
    }[];
    contextChip?: {
        label: string;
        accent?: string;
    };
    upiPayload?: string | null;
};

export function SettingsCategoryScreen({
    title,
    subtitle,
    sections,
    utilityLinks = [],
    contextChip,
    upiPayload,
}: SettingsCategoryScreenProps) {
    const smartBack = useSmartBack('/(main)/settings');

    return (
        <SettingsPageShell
            title={title}
            subtitle={subtitle}
            onBackPress={smartBack}
            contextChip={contextChip}
        >
            {sections.length > 0 ? (
                <SettingsSectionGroup
                    title="Configuration"
                    subtitle="Direct fields with automatic save feedback."
                >
                    {sections.map((section) => (
                        <SettingsSectionCard
                            key={section.key}
                            section={section.key}
                            subtitle={section.subtitle}
                            upiPayload={upiPayload}
                        />
                    ))}
                </SettingsSectionGroup>
            ) : null}

            {utilityLinks.length > 0 ? (
                <SettingsSectionGroup
                    title="Related pages"
                    subtitle="Supporting screens connected to this category."
                >
                    {utilityLinks.map((item) => (
                        <SettingsLinkRow
                            key={`${item.route}-${item.title}`}
                            icon={item.icon}
                            title={item.title}
                            subtitle={item.subtitle}
                            value={item.value}
                            onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                        />
                    ))}
                </SettingsSectionGroup>
            ) : null}
        </SettingsPageShell>
    );
}
