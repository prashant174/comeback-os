import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';

const fields: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true, min: 1, max: 100 },
  { name: 'tags', label: 'Tags', type: 'tags' },
  { name: 'note', label: 'Note', type: 'text' },
];

describe('FormDialog', () => {
  it('validates required, numeric range and converts types', async () => {
    const onSubmit = vi.fn();
    render(<FormDialog open onOpenChange={() => {}} title="Test" fields={fields} submitLabel="Save" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Required')).length).toBe(2);
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Title'), 'Shirt');
    await userEvent.type(screen.getByLabelText('Amount'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Max 100')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), '42');
    await userEvent.type(screen.getByLabelText('Tags (optional)'), 'a, b ,, c');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Shirt', amount: 42, tags: ['a', 'b', 'c'] });
  });
});
