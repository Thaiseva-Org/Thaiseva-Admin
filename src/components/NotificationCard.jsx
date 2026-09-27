import { NotificationsRounded } from "@icons";
import { DeleteForeverIcon } from "@icons";
import { AccessTimeIcon } from "@icons";
import { EventBusyIcon } from "@icons";
import { removeNotification } from "../services/Notification";
import { format } from "timeago.js";
import { Card, Box, Typography, IconButton, Chip, alpha } from "@mui/material";

const NotificationCard = ({ notification, length, setNotifications }) => {
  const deleteNotification = async (e) => {
    e.stopPropagation(); // Prevent card click if added later
    await removeNotification(notification.id, setNotifications);
  };

  const isExpired = notification.expiryDate && new Date(notification.expiryDate) <= new Date();

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        width: length ? '100%' : { xs: '100%', xl: '48%' },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#fff',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.15)',
          borderColor: 'primary.main',
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* Icon/Image Section */}
        <Box
          sx={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: notification.imageUrl ? 'transparent' : 'action.hover',
            backgroundImage: notification.imageUrl ? `url(${notification.imageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: notification.imageUrl ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
        >
          {!notification.imageUrl && (
            <NotificationsRounded sx={{ color: 'text.secondary', fontSize: 28 }} />
          )}
        </Box>

        {/* Content Section */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap title={notification.title}>
              {notification.title}
            </Typography>

            {/* Status Badge */}
            <Chip
              label={isExpired ? "Expired" : "Live"}
              size="small"
              color={isExpired ? "default" : "success"}
              variant={isExpired ? "outlined" : "filled"}
              sx={{
                height: 24,
                fontSize: '0.7rem',
                fontWeight: 600,
                ml: 1,
                flexShrink: 0
              }}
            />
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5
            }}
          >
            {notification.desc}
          </Typography>

          {/* Footer Metadata */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" fontWeight={500}>
                {notification.datetime?.seconds ? format(notification.datetime.toDate()) : format(notification.datetime)}
              </Typography>
            </Box>

            {notification.expiryDate && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: isExpired ? 'error.main' : 'warning.main' }}>
                <EventBusyIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={500}>
                  {isExpired ? 'Expired on ' : 'Expires '}
                  {new Date(notification.expiryDate).toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Action Buttons */}
      <IconButton
        onClick={deleteNotification}
        size="small"
        sx={{
          position: 'absolute',
          top: 8,
          right: 36, // Moved left of the default position slightly or specific area? Actually relative parent works better.
          // Wait, design-wise, a corner delete button is common.
          // Let's position it absolute top-right but consider text overlap.
          // The title flex container handles space-between, but the delete button might cover if we are not careful.
          // Let's use the Chip for status and maybe put delete below it or beside it?
          // Let's try to put delete in the content status row?
          // Actually, keeping strictly absolute might cover long titles.
          // Let's put it in the flex header.
          display: 'none', // We'll assume the flex header handles it, no, let's keep it separate or integrate.
        }}
      >
        <DeleteForeverIcon fontSize="small" />
      </IconButton>

      {/* Absolute delete button with hover reveal or consistent placement */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          opacity: 0.8,
          '&:hover': { opacity: 1 }
        }}
      >
        <IconButton
          size="small"
          onClick={deleteNotification}
          sx={{
            color: 'error.main',
            bgcolor: alpha('#ef4444', 0.1),
            '&:hover': { bgcolor: alpha('#ef4444', 0.2) }
          }}
        >
          <DeleteForeverIcon fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  );
};

export default NotificationCard;
