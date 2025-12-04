import {
  TablePagination,
} from "@mui/material";
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
    { id: "name", label: "Name", width: "18%" },
    { id: "contact", label: "Contact", width: "12%" },
    { id: "email", label: "Email", width: "15%" },
    { id: "location", label: "Location", width: "25%" },
    { id: "createdAt", label: "Registered On", width: "20%" },
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

  return (
    <div className="animate-fade-in">
      <PageHeading 
        text="User Data" 
        subtitle="Manage and view all registered users"
        icon="👥"
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-sm font-medium mb-1">Total Users</p>
              <p className="text-3xl font-bold">{totalPages}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">👥</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-sm font-medium mb-1">Current Page</p>
              <p className="text-3xl font-bold">{page + 1}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📄</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm font-medium mb-1">Showing</p>
              <p className="text-3xl font-bold">{matchedRequirements.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-lg">
              <span className="text-3xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap mb-6">
        {!csvData && (
          <button
            className="btn-gradient-primary shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Generating...
              </>
            ) : (
              <>
                <span className="mr-2">📥</span>
                Generate CSV
              </>
            )}
          </button>
        )}
        {csvData && (
          <CSVLink
            className="btn-gradient-secondary shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
            data={csvData}
            headers={headers}
            filename={fileName}
          >
            <span className="mr-2">📤</span>
            Export to CSV
          </CSVLink>
        )}
      </div>

      {/* Modern Table Container */}
      <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loadingReq ? (
            <LoadingContent variant="skeleton" />
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className="px-6 py-4 text-center text-sm font-semibold uppercase tracking-wider"
                      style={{ width: column.width }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((row, i) => (
                  <tr 
                    key={i} 
                    className="hover:bg-primary-50 transition-colors duration-200"
                  >
                    {columns.map((column) => {
                      let value = row[column.id];

                      return (
                        <td key={column.id} className="px-6 py-4 text-center">
                          {column?.id === "createdAt" ? (
                            <span className="text-sm text-neutral-600">
                              {value.toLocaleString()}
                            </span>
                          ) : column?.id === "profile" ? (
                            <div className="flex items-center justify-center w-full">
                              <img
                                loading="lazy"
                                src={value}
                                alt="User profile"
                                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full object-cover border-2 border-primary-200 shadow-md"
                              />
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-700">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <span className="text-6xl mb-4">👤</span>
                        <p className="text-lg font-medium text-neutral-500">No Users Found</p>
                        <p className="text-sm text-neutral-400 mt-2">There are no registered users at this time.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Modern Pagination */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4">
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={totalPages}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '& .MuiTablePagination-toolbar': {
                color: 'var(--text-primary)',
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                margin: 0,
                fontWeight: 500,
              },
              '& .MuiTablePagination-select': {
                borderRadius: '8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                padding: '4px 8px',
              },
              '& .MuiTablePagination-actions button': {
                borderRadius: '8px',
                '&:hover': {
                  backgroundColor: 'var(--primary-bg-light)',
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default UserData;
