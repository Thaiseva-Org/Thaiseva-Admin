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

export function StatusSummary({ records = [], noun = 'Items', activeFilter, onSelectFilter, icon }) {
  const active = records.filter(isListingActive).length;
  const inactive = records.length - active;

  const getNounIcon = (n) => {
    if (icon) return icon;
    const lower = String(n || '').toLowerCase();
    if (lower.includes('hotel')) return '🏨';
    if (lower.includes('tour') || lower.includes('travel')) return '🗺️';
    if (lower.includes('room')) return '🛏️';
    return '📊';
  };

  const cards = [
    {
      key: 'all',
      label: `Total ${noun}`,
      count: records.length,
      gradient: 'from-primary-500 to-primary-600',
      textColor: 'text-primary-100',
      icon: getNounIcon(noun),
    },
    {
      key: 'active',
      label: `Active ${noun}`,
      count: active,
      gradient: 'from-success-500 to-success-600',
      textColor: 'text-success-100',
      icon: '✅',
    },
    {
      key: 'inactive',
      label: `Inactive ${noun}`,
      count: inactive,
      gradient: 'from-danger-500 to-danger-600',
      textColor: 'text-danger-100',
      icon: '❌',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => {
        const isSelected = activeFilter && activeFilter === card.key;
        return (
          <div
            key={card.key}
            onClick={() => onSelectFilter && onSelectFilter(card.key)}
            className={`bg-gradient-to-br ${card.gradient} rounded-xl p-6 text-white shadow-lg ${
              onSelectFilter
                ? 'cursor-pointer transform transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl active:scale-95'
                : 'transition-transform duration-200 hover:scale-[1.02]'
            } ${isSelected ? 'ring-4 ring-white/60 ring-offset-2 ring-offset-transparent' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`${card.textColor} text-sm font-medium mb-1`}>
                  {card.label}
                </p>
                <p className="text-3xl font-bold">{card.count}</p>
              </div>
              <div className="bg-white/20 p-3 rounded-lg flex items-center justify-center">
                <span className="text-3xl">{card.icon}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

