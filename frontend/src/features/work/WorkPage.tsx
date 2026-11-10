import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/misc';
import { PageTabs, TabPanel } from '@/components/ui/kit';
import Board from './Board';
import Projects from './Projects';
import Requirements from './Requirements';
import Meetings from './Meetings';
import WorkLog from './WorkLog';
import ReportTab from './Report';
import Changes from './Changes';
import People from './People';

const TABS = [
  { v: 'board', label: 'Board' }, { v: 'projects', label: 'Projects' }, { v: 'requirements', label: 'Requirements' },
  { v: 'meetings', label: 'Meetings' }, { v: 'log', label: 'Work log' }, { v: 'report', label: 'Weekly report' },
  { v: 'changes', label: 'Change log' }, { v: 'people', label: 'People' },
];

export default function WorkPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.v === params.get('tab')) ? params.get('tab')! : 'board';
  return (
    <div>
      <PageHeader title="Work" subtitle="Projects, asks, meetings and time — private to you." />
      <PageTabs value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={TABS}>
        <TabPanel value="board"><Board /></TabPanel>
        <TabPanel value="projects"><Projects /></TabPanel>
        <TabPanel value="requirements"><Requirements /></TabPanel>
        <TabPanel value="meetings"><Meetings /></TabPanel>
        <TabPanel value="log"><WorkLog /></TabPanel>
        <TabPanel value="report"><ReportTab /></TabPanel>
        <TabPanel value="changes"><Changes /></TabPanel>
        <TabPanel value="people"><People /></TabPanel>
      </PageTabs>
    </div>
  );
}
