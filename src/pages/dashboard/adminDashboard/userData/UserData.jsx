import {
  TablePagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert
} from "@mui/material";
import { DownloadIcon, FileDownloadIcon, PersonIcon, ArticleIcon, VisibilityIcon } from "@icons";
import { useState, useEffect, useContext } from "react";
import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import { CSVLink } from "react-csv";
import {
  fetchUserData,
  fetchUserDataPages,
} from "../../../../services/UserRecords";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";
import {app} from "../../../../firebase/firebase.config";
import {getFunctions, httpsCallable} from "firebase/functions";
import useRecentAuthAction from "../../../../hooks/useRecentAuthAction";

const UserData = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const recentAuth = useRecentAuthAction();
  const [exportError, setExportError] = useState("");
  const [loadingReq, setLoadingReq] = useState(false);
  const [matchedRequirements, setMatchedRequirements] = useState([]);
  const [csvData, setCsvData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { id: "profile", label: "Profile", width: "10%" },
    { id: "name", label: "Name", width: "20%" },
    { id: "contact", label: "Contact", width: "15%" },
    { id: "email", label: "Email", width: "20%" },
    { id: "location", label: "Location", width: "20%" },
    { id: "createdAt", label: "Registered On", width: "15%" },
  ];

  // creating single row
  function createData(data) {
    return {
      name: data?.firstName,
      contact: data?.phoneNo,
      email: data?.email,
      location: data?.userLocation1,
      profile: data?.profilePic,
      createdAt: new Date(
        data?.createdAt?.seconds * 1000 + data?.createdAt?.nanoseconds / 1000000
      ),
    };
  }

  const rows = matchedRequirements?.map((item) => createData(item));

  const fetchTotalPages = async () => {
    const pages = await fetchUserDataPages();
    setTotalPages(pages);
  };
  const fetchData = async () => {
    setLoadingReq(true);
    const { data: newData, lastDoc } = await fetchUserData(
      page,
      lastDocs,
      rowsPerPage
    );
    setMatchedRequirements(newData);

    setLastDocs((prev) => {
      const updated = [...prev];
      updated[page] = lastDoc;
      return updated;
    });

    setLoadingReq(false);
  };
  useEffect(() => {
    if (isAdmin) {
      fetchTotalPages();
      fetchData();
    }
  }, [isAdmin, isSubAdmin, page, rowsPerPage]);

  const createCsvData = (
    name,
    contact,
    email,
    location,
    profile,
    createdAt
  ) => {
    return {
      name,
      contact,
      email,
      location,
      profile,
      createdAt: new Date(
        createdAt?.seconds * 1000 + createdAt?.nanoseconds / 1000000
      ).toLocaleString(),
    };
  };

  const headers = [
    { label: "Name", key: "name" },
    { label: "Contact", key: "contact" },
    { label: "Email", key: "email" },
    { label: "User Location", key: "location" },
    { label: "Profile Image", key: "profile" },
    { label: "Registered At", key: "createdAt" },
  ];

  const handleDownload = async () => {
    setIsDownloading(true);
    setExportError("");
    try {
    const response = await recentAuth.run(() => httpsCallable(getFunctions(app, "asia-east2"), "exportCustomerData")({}));
    const rowdata = response.data.records;
    const data = rowdata.map((item) =>
      createCsvData(
        item.firstName,
        item.phoneNo,
        item.email,
        item.userLocation1,
        item.profilePic,
        item.createdAt
      )
    );
    setCsvData(data);
    } catch (error) {
      setExportError(error.message || "Export failed. Please sign in again.");
    } finally { setIsDownloading(false); }
  };

  const fileName = `UserData.csv`;

  const StatCard = ({ title, value, icon, gradient = "from-primary-500 to-primary-600", text = "text-primary-100" }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 text-white shadow-lg transition-transform duration-200 hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`${text} text-sm font-medium mb-1`}>{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div className="bg-white/20 p-3 rounded-lg flex items-center justify-center text-white text-3xl">
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in pb-8">
      <PageHeading
        text="User Data"
        subtitle="Manage and view all registered users"
        icon="👥"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Users"
          value={totalPages}
          icon={<PersonIcon fontSize="large" />}
          gradient="from-primary-500 to-primary-600"
          text="text-primary-100"
        />
        <StatCard
          title="Current Page"
          value={page + 1}
          icon={<ArticleIcon fontSize="large" />}
          gradient="from-secondary-500 to-secondary-600"
          text="text-secondary-100"
        />
        <StatCard
          title="Showing Records"
          value={matchedRequirements.length}
          icon={<VisibilityIcon fontSize="large" />}
          gradient="from-success-500 to-success-600"
          text="text-success-100"
        />
      </div>

      {/* Action Buttons */}
      {recentAuth.dialog}
      {exportError && <Alert severity="error">{exportError}</Alert>}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {isAdmin && (!csvData ? (
          <Button
            variant="contained"
            onClick={handleDownload}
            disabled={isDownloading}
            startIcon={isDownloading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DownloadIcon />}
            sx={{
              borderRadius: 3,
              textTransform: 'none',
              px: 3,
              py: 1.2,
              fontWeight: 600,
              boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.2)',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 12px 20px -6px rgba(59, 130, 246, 0.3)',
              }
            }}
          >
            {isDownloading ? "Generating CSV..." : "Generate CSV"}
          </Button>
        ) : (
          <CSVLink
            data={csvData}
            headers={headers}
            filename={fileName}
            style={{ textDecoration: 'none' }}
          >
            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              sx={{
                borderRadius: 3,
                textTransform: 'none',
                px: 3,
                py: 1.2,
                fontWeight: 600,
                boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.2)',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: '0 12px 20px -6px rgba(16, 185, 129, 0.3)',
                }
              }}
            >
              Export to CSV
            </Button>
          </CSVLink>
        ))}
      </Box>

      {/* Modern Table Container */}
      <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          {loadingReq ? (
            <Box sx={{ p: 4 }}>
              <LoadingContent variant="skeleton" />
            </Box>
          ) : (
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow sx={{ background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align="left"
                      sx={{
                        py: 2,
                        px: 3,
                        fontWeight: 600,
                        color: '#f8fafc',
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: 'none'
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={i}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: '#f1f5f9',
                        transform: 'scale(1.002)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                      }
                    }}
                  >
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell key={column.id} align="left" sx={{ py: 2, px: 3 }}>
                          {column.id === "profile" ? (
                            <Avatar
                              src={value}
                              alt={row.name}
                              sx={{
                                width: 48,
                                height: 48,
                                border: '2px solid white',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.1)' }
                              }}
                            />
                          ) : column.id === "createdAt" ? (
                            <Chip
                              label={value.toLocaleDateString()}
                              size="small"
                              sx={{
                                bgcolor: '#eff6ff',
                                color: '#2563eb',
                                fontWeight: 600,
                                borderRadius: '8px',
                                border: '1px solid #bfdbfe'
                              }}
                            />
                          ) : column.id === "email" ? (
                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#475569' }}>
                              {value || "-"}
                            </Typography>
                          ) : column.id === "name" ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                              {value || "-"}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {value || "-"}
                            </Typography>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'text.secondary' }}>
                        <PersonIcon sx={{ fontSize: 60, opacity: 0.2, mb: 2 }} />
                        <Typography variant="h6" color="text.primary" gutterBottom>
                          No Users Found
                        </Typography>
                        <Typography variant="body2">
                          There are no registered users at this time.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* Modern Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={totalPages}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontWeight: 500,
              color: 'text.secondary',
            }
          }}
        />
      </Paper>
    </div>
  );
};

export default UserData;
