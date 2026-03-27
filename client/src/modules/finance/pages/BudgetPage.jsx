import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { HiPlus, HiTrash } from 'react-icons/hi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { budgetApi, eventsApi, reportsApi } from '@/shared/api';
import { formatCurrency, formatPercent } from '@/shared/utils/formatters';
import { EXPENSE_CATEGORIES } from '@/shared/constants/enums';
import { PageHeader } from '@/shared/ui';

const CHART_COLORS = ['#FFD600', '#E63946', '#4361EE', '#06D6A0', '#F97316', '#8B5CF6', '#22D3EE', '#A3E635'];

function BudgetBar({ percent, overspend }) {
  const color = percent > 90 ? 'bg-neo-red' : percent > 75 ? 'bg-neo-orange' : 'bg-neo-green';
  return (
    <div className="neo-card p-4">
      <div className="flex justify-between mb-2">
        <span className="font-heading text-xs uppercase">Budget Used</span>
        <span className={`font-heading text-sm ${percent > 90 ? 'text-neo-red' : ''}`}>{formatPercent(percent)}</span>
      </div>
      <div className="h-6 bg-neo-lavender border-3 border-neo-black overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 1, ease: 'easeOut' }} className={`h-full ${color}`} />
      </div>
      {overspend && (
        <p className="font-heading text-[10px] text-neo-red uppercase mt-2 animate-pulse">
          Overspend warning - over 90% budget used
        </p>
      )}
    </div>
  );
}

export default function BudgetPage() {
  const { id: eventId } = useParams();
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseEditDraft, setExpenseEditDraft] = useState({ category: '', description: '', amount: '', expenseDate: '' });
  const [totalAllocatedDraft, setTotalAllocatedDraft] = useState('');
  const queryClient = useQueryClient();

  const { data: eventDetails } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.getById(eventId).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: budget } = useQuery({
    queryKey: ['budget', eventId],
    queryFn: () => budgetApi.get(eventId).then(r => r.data).catch(() => null),
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses', eventId],
    queryFn: () => budgetApi.getExpenses(eventId).then(r => r.data).catch(() => []),
  });

  const { data: report } = useQuery({
    queryKey: ['report', eventId],
    queryFn: () => reportsApi.getEventReport(eventId).then(r => r.data).catch(() => null),
  });

  const { register, handleSubmit, reset } = useForm();

  const createBudgetMutation = useMutation({
    mutationFn: (data) => budgetApi.create(eventId, data),
    onSuccess: () => { toast.success('Budget created!'); queryClient.invalidateQueries({ queryKey: ['budget', eventId] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: (data) => budgetApi.update(eventId, data),
    onSuccess: () => {
      toast.success('Budget updated.');
      queryClient.invalidateQueries({ queryKey: ['budget', eventId] });
      queryClient.invalidateQueries({ queryKey: ['report', eventId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update budget'),
  });

  const addExpenseMutation = useMutation({
    mutationFn: (data) => budgetApi.addExpense(eventId, data),
    onSuccess: () => { toast.success('Expense added!'); reset(); setShowExpenseForm(false);
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['budget', eventId] });
      queryClient.invalidateQueries({ queryKey: ['report', eventId] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => budgetApi.deleteExpense(id),
    onSuccess: () => { toast.success('Deleted'); 
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['budget', eventId] }); },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, payload }) => budgetApi.updateExpense(id, payload),
    onSuccess: () => {
      toast.success('Expense updated.');
      setEditingExpenseId(null);
      setExpenseEditDraft({ category: '', description: '', amount: '', expenseDate: '' });
      queryClient.invalidateQueries({ queryKey: ['expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['budget', eventId] });
      queryClient.invalidateQueries({ queryKey: ['report', eventId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update expense'),
  });

  const summary = budget || report?.summary;
  const expenseList = Array.isArray(expenses) ? expenses : (expenses?.expenses || []);
  const categories = report?.byCategory || [];
  const percent = summary?.percentUsed || (summary?.totalAllocated ? (summary.totalSpent / summary.totalAllocated * 100) : 0);
  const eventSubtitle = eventDetails?.title
    ? `${eventDetails.title}${eventDetails?.eventDate ? ` - ${eventDetails.eventDate}` : ''}`
    : `Event #${eventId}`;

  const handleBudgetUpdate = () => {
    const value = Number(totalAllocatedDraft);
    if (!value || value <= 0) {
      toast.error('Enter a valid total budget amount.');
      return;
    }
    updateBudgetMutation.mutate({ totalAllocated: value });
  };

  const startExpenseEdit = (expense) => {
    setEditingExpenseId(expense._id || expense.id);
    setExpenseEditDraft({
      category: expense.category || '',
      description: expense.description || '',
      amount: expense.amount ?? '',
      expenseDate: expense.expenseDate ? String(expense.expenseDate).slice(0, 10) : '',
    });
  };

  const submitExpenseEdit = () => {
    if (!editingExpenseId) {
      return;
    }
    if (!expenseEditDraft.category || !expenseEditDraft.description || !expenseEditDraft.amount) {
      toast.error('Category, description and amount are required.');
      return;
    }
    const amount = Number(expenseEditDraft.amount);
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than 0.');
      return;
    }

    updateExpenseMutation.mutate({
      id: editingExpenseId,
      payload: {
        category: expenseEditDraft.category,
        description: expenseEditDraft.description,
        amount,
        expenseDate: expenseEditDraft.expenseDate || undefined,
      },
    });
  };

  if (!budget && !report) {
    return (
      <div>
        <PageHeader title="Budget" subtitle={eventSubtitle} />
        <div className="neo-card p-8 text-center">
          <h3 className="font-heading text-lg uppercase mb-4">No Budget Yet</h3>
          <form onSubmit={handleSubmit((d) => createBudgetMutation.mutate(d))} className="max-w-xs mx-auto space-y-4">
            <input type="number" {...register('totalAllocated', { required: true, valueAsNumber: true })}
              className="neo-input" placeholder="Total budget amount" />
            <button type="submit" disabled={createBudgetMutation.isPending} className="w-full neo-btn-primary">
              Create Budget
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Budget & Finance" subtitle={eventSubtitle}
        action={<button onClick={() => setShowExpenseForm(!showExpenseForm)} className="neo-btn bg-neo-yellow neo-btn-sm">
          <HiPlus /> Add Expense
        </button>} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Allocated', value: formatCurrency(summary?.totalAllocated), color: 'bg-neo-blue' },
          { label: 'Spent', value: formatCurrency(summary?.totalSpent || summary?.spent), color: 'bg-neo-pink' },
          { label: 'Remaining', value: formatCurrency(summary?.remaining), color: 'bg-neo-green' },
          { label: 'Used', value: formatPercent(percent), color: percent > 90 ? 'bg-neo-red' : 'bg-neo-yellow' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border-3 border-neo-black shadow-neo p-4 text-center`}>
            <p className="font-heading text-lg sm:text-xl text-white break-words">{s.value}</p>
            <p className="font-heading text-[10px] uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      <BudgetBar percent={percent} overspend={summary?.overspendWarning || percent > 90} />

      <div className="neo-card p-4 mt-4">
        <h3 className="font-heading text-xs uppercase tracking-wider mb-3">Adjust Allocated Budget</h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <input
            type="number"
            className="neo-input w-full sm:max-w-xs"
            placeholder={summary?.totalAllocated ? `Current: ${summary.totalAllocated}` : 'New total allocation'}
            value={totalAllocatedDraft}
            onChange={(e) => setTotalAllocatedDraft(e.target.value)}
          />
          <button
            type="button"
            onClick={handleBudgetUpdate}
            disabled={updateBudgetMutation.isPending}
            className="neo-btn neo-btn-sm bg-neo-blue"
          >
            {updateBudgetMutation.isPending ? 'Updating...' : 'Update Allocation'}
          </button>
          <button
            type="button"
            className="neo-btn neo-btn-sm bg-neo-white"
            onClick={() => setTotalAllocatedDraft(String(summary?.totalAllocated || ''))}
          >
            Use Current
          </button>
        </div>
      </div>

      {/* Add expense form */}
      {showExpenseForm && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="neo-card p-6 mt-6">
          <h3 className="font-heading text-sm uppercase mb-4">New Expense</h3>
          <form onSubmit={handleSubmit((d) => addExpenseMutation.mutate({ ...d, amount: Number(d.amount) }))} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              {...register('category', { required: 'Category is required' })}
              className="neo-select"
              defaultValue=""
            >
              <option value="" disabled>Select category</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <input
              {...register('description', { required: 'Description is required' })}
              className="neo-input"
              placeholder="Description"
            />
            <input
              type="number"
              step="0.01"
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' },
                valueAsNumber: true,
              })}
              className="neo-input"
              placeholder="Amount"
            />
            <input type="date" {...register('expenseDate')} className="neo-input" />
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={addExpenseMutation.isPending} className="neo-btn-primary neo-btn-sm">Add</button>
              <button type="button" onClick={() => setShowExpenseForm(false)} className="neo-btn neo-btn-sm bg-neo-white">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Expense list */}
        <div className="neo-card p-6">
          <h3 className="font-heading text-sm uppercase mb-4">Expenses ({expenseList.length})</h3>
          <p className="font-body text-xs text-neo-black/65 mb-3">
            Tip: use Edit to correct category, description, amount, or expense date without deleting records.
          </p>
          {expenseList.length === 0 ? <p className="font-body text-sm text-neo-black/55">No expenses yet</p> : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenseList.map((exp, i) => (
                <div key={exp._id || exp.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-neo-cream border-2 border-neo-black/10 min-w-0">
                  <div className="min-w-0">
                    {editingExpenseId === (exp._id || exp.id) && !exp.isAutoAllocated ? (
                      <div className="space-y-2">
                        <select
                          className="neo-select"
                          value={expenseEditDraft.category}
                          onChange={(e) => setExpenseEditDraft((s) => ({ ...s, category: e.target.value }))}
                        >
                          <option value="" disabled>Select category</option>
                          {EXPENSE_CATEGORIES.map((categoryItem) => (
                            <option key={categoryItem} value={categoryItem}>{categoryItem.replace('_', ' ')}</option>
                          ))}
                        </select>
                        <input
                          className="neo-input"
                          value={expenseEditDraft.description}
                          onChange={(e) => setExpenseEditDraft((s) => ({ ...s, description: e.target.value }))}
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="number"
                            step="0.01"
                            className="neo-input"
                            value={expenseEditDraft.amount}
                            onChange={(e) => setExpenseEditDraft((s) => ({ ...s, amount: e.target.value }))}
                          />
                          <input
                            type="date"
                            className="neo-input"
                            value={expenseEditDraft.expenseDate}
                            onChange={(e) => setExpenseEditDraft((s) => ({ ...s, expenseDate: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="neo-btn neo-btn-sm bg-neo-green"
                            onClick={submitExpenseEdit}
                            disabled={updateExpenseMutation.isPending}
                          >
                            {updateExpenseMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="neo-btn neo-btn-sm bg-neo-white"
                            disabled={updateExpenseMutation.isPending}
                            onClick={() => {
                              setEditingExpenseId(null);
                              setExpenseEditDraft({ category: '', description: '', amount: '', expenseDate: '' });
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-heading text-xs uppercase">{exp.description}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-body text-[10px] text-neo-black/65">{exp.category?.replace('_', ' ')}</p>
                          {exp.isAutoAllocated && (
                            <span className="neo-badge bg-neo-blue text-white">SYSTEM-LOCKED</span>
                          )}
                          {exp.sourceBookingId && (
                            <span className="neo-badge bg-neo-white text-neo-black">Booking #{exp.sourceBookingId}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <span className="font-heading text-sm text-neo-pink">{formatCurrency(exp.amount)}</span>
                    <button
                      type="button"
                      onClick={() => startExpenseEdit(exp)}
                      className="neo-btn neo-btn-sm bg-neo-white"
                      disabled={updateExpenseMutation.isPending || exp.isAutoAllocated}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExpenseMutation.mutate(exp._id || exp.id)}
                      className={`text-neo-red ${exp.isAutoAllocated ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={exp.isAutoAllocated}
                    >
                      <HiTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category chart */}
        {categories.length > 0 && (
          <div className="neo-card p-6">
            <h3 className="font-heading text-sm uppercase mb-4">By Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90}
                  stroke="#1A1A2E" strokeWidth={2}>
                  {categories.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
