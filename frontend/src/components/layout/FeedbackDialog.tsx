import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';

const FIELDS: FieldDef[] = [
  { name: 'type', label: 'What is it?', type: 'select', options: [{ value: 'bug', label: 'Something is broken' }, { value: 'idea', label: 'Idea / suggestion' }, { value: 'other', label: 'Other' }], full: true },
  { name: 'message', label: 'Details', type: 'textarea', required: true, max: 2000, placeholder: 'What happened? What did you expect? Which phone/browser?' },
];

/** Lets testers report bugs or ideas; the current page is attached automatically. */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const loc = useLocation();
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Send feedback" description="Goes straight to the admin. The page you're on is attached."
      fields={FIELDS} initial={{ type: 'bug' }} submitLabel="Send"
      onSubmit={async (v) => {
        try {
          await api.post('/feedback', { ...v, page: loc.pathname });
          toast.success('Thanks! Feedback sent.');
        } catch (e) {
          toast.error(apiError(e));
          throw e; // keep the dialog open
        }
      }} />
  );
}
