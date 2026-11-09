import * as Tabs from '@radix-ui/react-tabs';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '@/hooks/queries';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { apiError } from '@/lib/api';
import { AccountSection, AppearanceSection, CareerSection, DashboardSection, PersonalSection, RemindersSection, ResetSection, ScheduleSection, TargetsSection } from './sections';

const TABS = [
  { v: 'account', label: 'Account' }, { v: 'personal', label: 'Personal & body' }, { v: 'targets', label: 'Targets' },
  { v: 'schedule', label: 'Schedule' }, { v: 'career', label: 'Career focus' }, { v: 'dashboard', label: 'Dashboard' },
  { v: 'reminders', label: 'Reminders' }, { v: 'appearance', label: 'Appearance' }, { v: 'reset', label: 'Reset' },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.v === params.get('tab')) ? params.get('tab')! : 'account';
  const q = useSettings();

  return (
    <div>
      <PageHeader title="Settings" subtitle="Every target, timing and default lives here." />
      <Tabs.Root value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} orientation="vertical" className="grid md:grid-cols-[200px_1fr] gap-6">
        <Tabs.List aria-label="Settings sections" className="flex md:flex-col gap-1 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.v} value={t.v}
              className="shrink-0 text-left text-sm px-3 h-9 rounded-lg text-muted hover:text-ink hover:bg-sunken data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:font-medium data-[state=active]:border data-[state=active]:border-line">
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="min-w-0 max-w-3xl">
          {q.isLoading ? <Skeleton className="h-80" /> : q.isError || !q.data ? <ErrorState message={apiError(q.error)} onRetry={() => q.refetch()} /> : (
            <>
              <Tabs.Content value="account"><AccountSection /></Tabs.Content>
              <Tabs.Content value="personal"><PersonalSection profile={q.data.profile} /></Tabs.Content>
              <Tabs.Content value="targets"><TargetsSection profile={q.data.profile} /></Tabs.Content>
              <Tabs.Content value="schedule"><ScheduleSection profile={q.data.profile} /></Tabs.Content>
              <Tabs.Content value="career"><CareerSection profile={q.data.profile} /></Tabs.Content>
              <Tabs.Content value="dashboard"><DashboardSection prefs={q.data.preferences} /></Tabs.Content>
              <Tabs.Content value="reminders"><RemindersSection /></Tabs.Content>
              <Tabs.Content value="appearance"><AppearanceSection /></Tabs.Content>
              <Tabs.Content value="reset"><ResetSection /></Tabs.Content>
            </>
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}
