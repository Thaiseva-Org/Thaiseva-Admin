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
} from "@mui/material";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";
import { db } from "../../../../firebase/firebase.config";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import SearchIcon from "@mui/icons-material/Search";
import ArchiveIcon from "@mui/icons-material/Archive";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const ContactUs = () => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: New, 2: Archived

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "ContusDB"), orderBy("createdAt", "desc"));
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
          m.message?.toLowerCase().includes(term)
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
      await updateDoc(doc(db, "ContusDB", id), {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ConfigHeader
        title="Contact Us Messages"
        subtitle="View messages received from the website. Archive once handled."
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
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
        <TextField
          placeholder="Search by name, email, subject..."
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className="text-gray-400" />
              </InputAdornment>
            ),
            sx: { borderRadius: "20px", backgroundColor: "white", minWidth: 320 },
          }}
        />
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
                <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Received</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
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
                  <TableCell align="right">
                    <Button
                      startIcon={<ArchiveIcon />}
                      size="small"
                      variant="outlined"
                      color="inherit"
                      disabled={item.status === "Archived"}
                      onClick={() => handleArchive(item.id)}
                    >
                      Archive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
};

export default ContactUs;
