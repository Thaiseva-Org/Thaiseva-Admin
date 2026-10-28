import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  TextField,
  Typography,
  Paper,
  Skeleton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
} from "@mui/material";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../../../../firebase/firebase.config";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import { SearchIcon, ArchiveIcon, ContentCopyIcon, VisibilityIcon, CloseIcon, ScheduleIcon, MailOutlineIcon, PersonOutlineIcon, PhoneIphoneIcon, PublicIcon, DeleteIcon, DownloadIcon } from "@icons";

const ContactUs = () => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: New, 2: Archived
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "ContactMessages"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(data);
    } catch (error) {
      console.error("Failed to load contact messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const filtered = useMemo(() => {
    let data = [...messages];
    if (tabValue === 1) data = data.filter((m) => m.status === "New");
    if (tabValue === 2) data = data.filter((m) => m.status === "Archived");
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (m) =>
          m.fullName?.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.subject?.toLowerCase().includes(term) ||
          m.message?.toLowerCase().includes(term) ||
          m.ipAddress?.toLowerCase().includes(term)
      );
    }
    return data;
  }, [messages, searchTerm, tabValue]);

  const copyToClipboard = async (value, label = "Copied") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      Swal.fire({
        icon: "success",
        title: label,
        timer: 800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Error", "Could not copy to clipboard.", "error");
    }
  };

  const handleArchive = async (id) => {
    try {
      await updateDoc(doc(db, "ContactMessages", id), {
        status: "Archived",
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "Archived" } : m))
      );
      Swal.fire({
        icon: "success",
        title: "Archived",
        timer: 900,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Error", "Could not archive this message.", "error");
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "Unknown";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  };

  const exportToCsv = (messageList, filename = "contact_messages.csv") => {
    if (!messageList || messageList.length === 0) return;
    const headers = [
      "ID",
      "Status",
      "Full Name",
      "Email",
      "Phone Number",
      "IP Address",
      "Subject",
      "Message",
      "Source",
      "Received At"
    ];
    const rows = messageList.map((m) => [
      `"${(m.id || "").replace(/"/g, '""')}"`,
      `"${(m.status || "New").replace(/"/g, '""')}"`,
      `"${(m.fullName || "").replace(/"/g, '""')}"`,
      `"${(m.email || "").replace(/"/g, '""')}"`,
      `"${(m.mobileNumber || "").replace(/"/g, '""')}"`,
      `"${(m.ipAddress || "").replace(/"/g, '""')}"`,
      `"${(m.subject || "").replace(/"/g, '""')}"`,
      `"${(m.message || "").replace(/"/g, '""')}"`,
      `"${(m?.metadata?.source || m.source || "Website").replace(/"/g, '""')}"`,
      `"${formatDate(m.createdAt).replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteSingle = async (id) => {
    const result = await Swal.fire({
      title: "Delete message?",
      text: "This message will be permanently deleted from the database.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "ContactMessages", id));
        setMessages((prev) => prev.filter((m) => m.id !== id));
        if (selectedMessage?.id === id) {
          handleCloseModal();
        }
        Swal.fire({
          icon: "success",
          title: "Deleted",
          text: "Message has been deleted.",
          timer: 1200,
          showConfirmButton: false,
        });
      } catch (error) {
        Swal.fire("Error", "Could not delete this message: " + error.message, "error");
      }
    }
  };

  const handleExportAndDeleteAll = async () => {
    const targets = filtered;
    if (!targets || targets.length === 0) {
      Swal.fire("No Messages", "There are no messages to export or delete.", "info");
      return;
    }

    const tabLabel = tabValue === 1 ? "New" : tabValue === 2 ? "Archived" : "All";
    const result = await Swal.fire({
      title: `Export & Delete ${targets.length} ${tabLabel} Message(s)?`,
      text: "A CSV backup file will download to your computer, and these messages will then be permanently deleted from the database.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, Export & Delete All",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        // 1. Export CSV backup
        const dateStr = new Date().toISOString().slice(0, 10);
        exportToCsv(targets, `contact_messages_${tabLabel.toLowerCase()}_backup_${dateStr}.csv`);

        // 2. Batch delete in chunks of 400
        const chunkSize = 400;
        for (let i = 0; i < targets.length; i += chunkSize) {
          const chunk = targets.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((item) => {
            batch.delete(doc(db, "ContactMessages", item.id));
          });
          await batch.commit();
        }

        const deletedIds = new Set(targets.map((t) => t.id));
        setMessages((prev) => prev.filter((m) => !deletedIds.has(m.id)));
        handleCloseModal();

        Swal.fire({
          icon: "success",
          title: "Backup Exported & Deleted",
          text: `Successfully exported CSV backup and permanently deleted ${targets.length} message(s).`,
        });
      } catch (error) {
        Swal.fire("Error", "Failed to delete messages: " + error.message, "error");
      }
    }
  };

  const handleOpenModal = (message) => {
    setSelectedMessage(message);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMessage(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfigHeader
        title="Contact Us Messages"
        subtitle="View messages received from the website. Archive once handled."
        showAdd={false}
      />

      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6">
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={(e, val) => setTabValue(val)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="All" />
            <Tab label="New" />
            <Tab label="Archived" />
          </Tabs>
        </Box>
        <div className="flex flex-wrap items-center gap-3">
          <TextField
            placeholder="Search by name, email, IP..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className="text-gray-400" />
                </InputAdornment>
              ),
              sx: { borderRadius: "20px", backgroundColor: "white", minWidth: 260 },
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            disabled={filtered.length === 0}
            onClick={() => exportToCsv(filtered, `contact_messages_${new Date().toISOString().slice(0, 10)}.csv`)}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            disabled={filtered.length === 0}
            onClick={handleExportAndDeleteAll}
            sx={{
              borderRadius: "10px",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Export & Delete All
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Typography className="text-gray-400">No messages found.</Typography>
        </div>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "var(--secondary-bg)" }}>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Received</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status || "New"}
                      color={item.status === "Archived" ? "default" : "success"}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>{item.fullName || "Unknown"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: "none", color: "var(--primary-600)" }}
                        onClick={() => copyToClipboard(item.email, "Email copied")}
                      >
                        {item.email || "-"}
                      </Button>
                      {item.email && (
                        <Tooltip title="Copy email">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(item.email, "Email copied")}
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="text"
                        size="small"
                        sx={{ textTransform: "none", color: "var(--primary-600)" }}
                        onClick={() =>
                          copyToClipboard(item.mobileNumber, "Phone copied")
                        }
                      >
                        {item.mobileNumber || "-"}
                      </Button>
                      {item.mobileNumber && (
                        <Tooltip title="Copy phone">
                          <IconButton
                            size="small"
                            onClick={() =>
                              copyToClipboard(item.mobileNumber, "Phone copied")
                            }
                          >
                            <ContentCopyIcon fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.ipAddress || "-"}</TableCell>
                  <TableCell>{item.subject || "General Inquiry"}</TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.message || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>{item?.metadata?.source || item.source || "-"}</TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell align="center">
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip title="View Message">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleOpenModal(item)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Archive">
                        <span>
                          <IconButton
                            size="small"
                            color="inherit"
                            disabled={item.status === "Archived"}
                            onClick={() => handleArchive(item.id)}
                          >
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteSingle(item.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Message Modal */}
      <Dialog
        open={isModalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 },
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Message Details
          </Typography>
          <IconButton onClick={handleCloseModal}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {selectedMessage && (
            <Grid container spacing={3}>
              {/* Header Info */}
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonOutlineIcon fontSize="small" /> FROM
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {selectedMessage.fullName || "Unknown User"}
                  </Typography>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MailOutlineIcon fontSize="small" /> EMAIL
                  </Typography>
                  <div className="flex items-center gap-2">
                    <Typography variant="body1">{selectedMessage.email || "-"}</Typography>
                    {selectedMessage.email && (
                      <IconButton size="small" onClick={() => copyToClipboard(selectedMessage.email, "Email copied")}>
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    )}
                  </div>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIphoneIcon fontSize="small" /> PHONE
                  </Typography>
                  <div className="flex items-center gap-2">
                    <Typography variant="body1">{selectedMessage.mobileNumber || "-"}</Typography>
                    {selectedMessage.mobileNumber && (
                      <IconButton size="small" onClick={() => copyToClipboard(selectedMessage.mobileNumber, "Phone copied")}>
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    )}
                  </div>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon fontSize="small" /> RECEIVED AT
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(selectedMessage.createdAt)}
                  </Typography>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PublicIcon fontSize="small" /> SOURCE
                  </Typography>
                  <Typography variant="body1">
                    {selectedMessage?.metadata?.source || selectedMessage.source || "Website"}
                  </Typography>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PublicIcon fontSize="small" /> IP ADDRESS
                  </Typography>
                  <Typography variant="body1">
                    {selectedMessage.ipAddress || "-"}
                  </Typography>
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                    STATUS
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={selectedMessage.status || "New"}
                      color={selectedMessage.status === "Archived" ? "default" : "success"}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                  SUBJECT
                </Typography>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'var(--primary-700)' }}>
                  {selectedMessage.subject || "General Inquiry"}
                </Typography>

                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                  MESSAGE
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: "var(--secondary-bg)",
                    borderRadius: 2,
                    mt: 1,
                    whiteSpace: "pre-wrap",
                    minHeight: "100px",
                  }}
                >
                  <Typography variant="body1">
                    {selectedMessage.message || "No message content."}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseModal} color="inherit">
            Close
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => handleDeleteSingle(selectedMessage.id)}
          >
            Delete Message
          </Button>
          {selectedMessage?.status !== "Archived" && (
            <Button
              variant="contained"
              startIcon={<ArchiveIcon />}
              color="warning"
              onClick={() => {
                handleArchive(selectedMessage.id);
                handleCloseModal();
              }}
              sx={{ px: 3 }}
            >
              Archive Message
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ContactUs;
