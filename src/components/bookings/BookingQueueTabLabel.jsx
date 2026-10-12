import { Badge, Box, Tooltip } from '@mui/material';

export default function BookingQueueTabLabel({ label, count, icon }) {
  return (
    <Tooltip title={`${count} ${label.toLowerCase()} bookings`}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, pr: 1 }}>
        <Badge badgeContent={count} max={9} color="warning">
          {icon}
        </Badge>
        <span>{label}</span>
      </Box>
    </Tooltip>
  );
}
