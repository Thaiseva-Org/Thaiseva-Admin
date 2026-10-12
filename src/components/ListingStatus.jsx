import { Box, Chip, Switch, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { isListingActive } from '../utils/listing-status';

export function StatusBadge({ active }) {
  return <Chip size="small" label={active ? 'Active' : 'Inactive'} sx={{ fontWeight: 700, bgcolor: active ? '#dcfce7' : '#f1f5f9', color: active ? '#166534' : '#475569', '&::before': { content: '""', width: 7, height: 7, borderRadius: '50%', bgcolor: active ? '#16a34a' : '#94a3b8', ml: 1 } }} />;
}

export default function ListingStatus({ active, onChange, disabled, label = 'Listing visibility' }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
    <Switch checked={active} onChange={(_, checked) => onChange(checked)} disabled={disabled} color="success" inputProps={{ 'aria-label': label }} />
    <StatusBadge active={active} />
  </Box>;
}

export function StatusFilters({ records, value, onChange }) {
  const active = records.filter(isListingActive).length;
  return <ToggleButtonGroup exclusive value={value} onChange={(_, next) => next && onChange(next)} aria-label="Filter by listing status" sx={{ my: 2, display: 'flex', flexWrap: 'wrap', '& .MuiToggleButton-root': { textTransform: 'none', px: { xs: 1.5, sm: 3 }, fontWeight: 700 }, '& .Mui-selected': { color: '#166534', bgcolor: '#dcfce7' } }}>
    <ToggleButton value="all">All ({records.length})</ToggleButton>
    <ToggleButton value="active">Active ({active})</ToggleButton>
    <ToggleButton value="inactive">Inactive ({records.length - active})</ToggleButton>
  </ToggleButtonGroup>;
}

export function StatusSummary({ records, noun }) {
  const active = records.filter(isListingActive).length;
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">{[
    [`Total ${noun}`, records.length, 'bg-blue-50 text-blue-900'],
    [`Active ${noun}`, active, 'bg-green-50 text-green-900'],
    [`Inactive ${noun}`, records.length - active, 'bg-slate-100 text-slate-700'],
  ].map(([label, count, color]) => <div key={label} className={`rounded-2xl border border-black/5 p-5 ${color}`}><p className="text-sm font-semibold">{label}</p><p className="text-3xl font-bold mt-2">{count}</p></div>)}</div>;
}
