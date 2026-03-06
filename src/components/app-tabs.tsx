import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { useAppColors } from '../hooks/useAppColors';

const HOME_TAB_ICON = require('../../assets/images/icon.png');
const EXPLORE_TAB_ICON = require('../../assets/images/icon.png');

export default function AppTabs() {
  const colors = useAppColors();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={HOME_TAB_ICON} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={EXPLORE_TAB_ICON} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
