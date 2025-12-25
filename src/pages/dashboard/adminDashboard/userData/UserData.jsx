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
  Tooltip
} from "@mui/material";
import { Download as DownloadIcon, FileDownload as FileDownloadIcon, Person as PersonIcon, Article as ArticleIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import { useState, useEffect, useContext } from "react";
import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import { CSVLink } from "react-csv";
import {
  fetchUserData,
  fetchUserDataPages,
  usersData,
} from "../../../../services/UserRecords";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";

const UserData = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
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
    setRowsPerPage(event.target.value);
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
        data?.createdAt.seconds * 1000 + data?.createdAt.nanoseconds / 1000000
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
    if (isAdmin || isSubAdmin) {
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
    const rowdata = await usersData();
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
    setIsDownloading(false);
  };

  const fileName = `UserData.csv`;

  const StatCard = ({ title, value, icon, color, gradient }) => (
    <Card sx={{
      borderRadius: 4,
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)",
      }
    }}>
      <div
        style={{
          background: gradient,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '6px'
        }}
      />
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" sx={{ color: color, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={800} color="text.primary">
              {value}
            </Typography>
          </Box>
          <Box sx={{
            p: 2,
            borderRadius: '16px',
            background: `${color}15`, // 10% opacity
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px ${color}20`
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <div className="animate-fade-in pb-8">
      <PageHeading
        text="User Data"
        subtitle="Manage and view all registered users"
        icon="👥"
      />

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Users"
            value={totalPages}
            icon={<PersonIcon fontSize="large" />}
            color="#3b82f6" // Blue
            gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Current Page"
            value={page + 1}
            icon={<ArticleIcon fontSize="large" />}
            color="#10b981" // Green
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Showing Records"
            value={matchedRequirements.length}
            icon={<VisibilityIcon fontSize="large" />}
            color="#8b5cf6" // Violet
            gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
          />
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {!csvData ? (
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
        )}
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
