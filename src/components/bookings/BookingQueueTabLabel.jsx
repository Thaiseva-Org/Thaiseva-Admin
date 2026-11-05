import PropTypes from 'prop-types';
import { Badge, Box, Tooltip } from '@mui/material';

export default function BookingQueueTabLabel({
  label,
  count,
  icon,
  showBadge = false,
  badgeColor = "warning",
  max = 99,
}) {
  const hasNotification = Boolean(showBadge && typeof count === 'number' && count > 0);
  const tooltipText = typeof count === 'number'
    ? `${count} ${label.toLowerCase()} bookings`
    : label;

  return (
    <Tooltip title={tooltipText}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
        {hasNotification ? (
          <Badge
            badgeContent={count}
            max={max}
            color={badgeColor}
            sx={{
              '& .MuiBadge-badge': {
                fontWeight: 700,
                fontSize: '0.72rem',
                height: 18,
                minWidth: 18,
                padding: '0 4px',
              },
            }}
          >
            {icon}
          </Badge>
        ) : (
          icon
        )}
        <span>{label}</span>
      </Box>
    </Tooltip>
  );
}

BookingQueueTabLabel.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number,
  icon: PropTypes.node,
  showBadge: PropTypes.bool,
  badgeColor: PropTypes.string,
  max: PropTypes.number,
};
