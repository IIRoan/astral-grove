import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { AppearanceSpecimens } from '@/components/settings/AppearanceSpecimens';
import { CredentialsSection } from '@/components/settings/CredentialsSection';
import { EmailVerificationSection } from '@/components/settings/EmailVerificationSection';
import { ScannerEngineSection } from '@/components/settings/ScannerEngineSection';
import { SharedCollectionSection } from '@/components/settings/SharedCollectionSection';
import { UpdateChannelSection } from '@/components/settings/UpdateChannelSection';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text } from '@/components/ui/text';
import { RIOT_DISCLAIMER, SUPPORT_EMAIL } from '@/constants/legal';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { useEmailVerificationRequired } from '@/hooks/useEmailVerificationRequired';
import { authClient } from '@/src/lib/auth-client';
import { FORM_COLUMN_CLASS } from '@/lib/responsive-layout';
import { cn } from '@/lib/utils';

function SettingsSection({
  label,
  children,
  className,
  fill,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Stretch panel to match sibling height in a desktop row. */
  fill?: boolean;
}) {
  return (
    <View className={cn('gap-2', fill && 'min-h-0 min-w-0 flex-1 flex-col', className)}>
      <SectionLabel className="mb-0">{label}</SectionLabel>
      {children}
    </View>
  );
}

function DesignPreviewRow({
  title,
  path,
  onPress,
  divider,
  label = `Open ${title} preview`,
}: {
  title: string;
  path: string;
  onPress: () => void;
  divider?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        'h-11 flex-row items-stretch active:bg-card-panel sm:h-12',
        divider && 'border-t border-border'
      )}
    >
      <View className="min-w-0 flex-1 justify-center px-4">
        <Text
          className="text-sm font-medium leading-5 text-foreground"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="font-mono text-[11px] leading-4 text-muted-foreground"
          numberOfLines={1}
        >
          {path}
        </Text>
      </View>
      <View className="w-11 items-center justify-center border-l border-border bg-card-panel sm:w-12">
        <Text className="font-mono text-xs font-medium text-foreground">→</Text>
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const sessionQuery = authClient.useSession();
  const signedIn = Boolean(sessionQuery.data?.user);
  const showRail = useShowSideRail();
  const showDesign = __DEV__ || Updates.channel === 'preview';
  const accountShareRow = signedIn && showRail;
  const verificationRequired = useEmailVerificationRequired().data === true;
  const emailVerified = sessionQuery.data?.user?.emailVerified === true;
  const showEmailVerification = signedIn && verificationRequired && !emailVerified;

  return (
    <ScreenLayout contentClassName={FORM_COLUMN_CLASS}>
      <ScreenHeader title="Settings" />

      <View className="mt-6 gap-8">
        <View
          className={cn(accountShareRow ? 'flex-row items-stretch gap-4' : 'gap-8')}
        >
          <SettingsSection label="Account" fill={accountShareRow}>
            <AuthPanel className={accountShareRow ? 'min-h-0 flex-1' : undefined} />
          </SettingsSection>

          {signedIn ? (
            <SettingsSection label="Shared collection" fill={accountShareRow}>
              <SharedCollectionSection
                className={accountShareRow ? 'min-h-0 flex-1' : undefined}
              />
            </SettingsSection>
          ) : null}
        </View>

        {showEmailVerification ? (
          <SettingsSection label="Email verification">
            <EmailVerificationSection />
          </SettingsSection>
        ) : null}

        {signedIn ? (
          <SettingsSection label="Credentials">
            <CredentialsSection />
          </SettingsSection>
        ) : null}

        {showRail ? null : (
          <SettingsSection label="Fun">
            <View className="overflow-hidden rounded-[10px] border border-border bg-card">
              <DesignPreviewRow
                title="Deck randomizer"
                path="/fun"
                label="Open deck randomizer"
                onPress={() => router.push('/fun')}
              />
            </View>
          </SettingsSection>
        )}

        <SettingsSection label="Display">
          <AppearanceSpecimens />
        </SettingsSection>

        <SettingsSection label="Card scanner">
          <ScannerEngineSection />
        </SettingsSection>

        <SettingsSection label="App version">
          <UpdateChannelSection />
        </SettingsSection>

        <SettingsSection label="About">
          <View className="overflow-hidden rounded-[10px] border border-border bg-card">
            <DesignPreviewRow
              title="Support"
              path={SUPPORT_EMAIL}
              label="Open support"
              onPress={() => router.push('/support')}
            />
            <DesignPreviewRow
              title="Privacy policy"
              path="/privacy"
              label="Open privacy policy"
              onPress={() => router.push('/privacy')}
              divider
            />
            <DesignPreviewRow
              title="Terms of use"
              path="/terms"
              label="Open terms of use"
              onPress={() => router.push('/terms')}
              divider
            />
          </View>
          <Text className="text-xs leading-5 text-muted-foreground">
            {RIOT_DISCLAIMER}
          </Text>
        </SettingsSection>

        {showDesign ? (
          <SettingsSection label="Design">
            <View className="overflow-hidden rounded-[10px] border border-border bg-card">
              <DesignPreviewRow
                title="Rune charge loader"
                path="/loading"
                onPress={() => router.push('/loading')}
              />
              <DesignPreviewRow
                title="Update dispatch"
                path="/update"
                onPress={() => router.push('/update')}
                divider
              />
            </View>
          </SettingsSection>
        ) : null}
      </View>
    </ScreenLayout>
  );
}
