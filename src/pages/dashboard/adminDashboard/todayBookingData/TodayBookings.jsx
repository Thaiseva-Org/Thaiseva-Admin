import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from "@mui/material";
import { useState, useEffect, useContext } from "react";
// import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import {
  fetchBookingsTotalPages,
  fetchTodayBooking,
  handleClear,
} from "../../../../services/DailyRecords";
import { CSVLink } from "react-csv";
import { PDFDownloadLink } from "@react-pdf/renderer";
import PartnerInvoice from "../../../../components/reports/PartnerInvoice";
import UserInvoice from "../../../../components/reports/UserInvoice";
import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";
import { AuthContext } from "../../../../contextAPIs/AuthProvider";

const TodayBookings = () => {
  const { isAdmin, isSubAdmin } = useContext(AuthContext);
  const { contactInfo } = useContext(PartnerContext);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [lastDocs, setLastDocs] = useState([]);
  const [refetch, setRefetch] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [queryCategory, setQueryCategory] = useState("Room Bookings");
  const [loadingReq, setLoadingReq] = useState(false);
  const [matchedRequirements, setMatchedRequirements] = useState([]);
  const [csvData, setCsvData] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [generationUserInvoices, setGenerationUserInvoices] = useState({});
  const [generationPartnerInvoices, setGenerationPartnerInvoices] = useState(
    {}
  );

  const toggleUserInvoiceGeneration = (rowId) => {
    setGenerationUserInvoices((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  const togglePartnerInvoiceGeneration = (rowId) => {
    setGenerationPartnerInvoices((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  const columns = [
    { id: "provider", label: "Provider", width: "15%" },
    { id: "phone", label: "User Contact", width: "10%" },
    { id: "name", label: "Guest Name", width: "12%" },
    { id: "timestamp", label: "Booking Time", width: "13%" },
    { id: "userAmount", label: "User Amount", width: "10%" },
    { id: "userInvoice", label: "User Invoice", width: "10%" },
    { id: "partnerAmount", label: "Partner Amount", width: "10%" },
    { id: "partnerInvoice", label: "Partner Invoice", width: "10%" },
    { id: "action", label: "Action", width: "10%" },
  ];

  // creating single row
  function createData(
    id,
    isPaymentClear,
    provider,
    providerContact,
    name,
    phone,
    timestamp,
    userAmount,
    comission,
    category,
    status,
    title = ""
  ) {
    // console.log(timestamp);
    const date = new Date(
      timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000
    );
    const invoicedate = new Date();
    const partnerAmount = (userAmount - (userAmount * comission) / 100).toFixed(
      2
    );
    const comissionAmount = ((userAmount * comission) / 100).toFixed(2);
    return {
      id,
      isPaymentClear,
      provider,
      providerContact: String(providerContact),
      name,
      phone,
      timestamp: date.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      userAmount: String(userAmount),
      comission: String(comission),
      partnerAmount: String(partnerAmount),
      category,
      status,
      userInvoce: {
        paymentTo: {
          partnerName: name,
          partnerAddress: "",
          partnerPhone: phone,
          partnerEmail: "",
        },
        paymentDate: date.toLocaleDateString(),
        invoiceDate: invoicedate.toLocaleDateString(),
        paymentTable: {
          description: `${title != "" ? title : ""}${queryCategory}`,
          subTotal: userAmount,
          commission: comission,
          total: userAmount,
          totalCommission: comissionAmount,
        },
        partnerInfo: {
          name: provider,
          contact: providerContact,
        },
      },
      partnerInvoiceInfo: {
        paymentTo: {
          partnerName: provider,
          partnerAddress: "",
          partnerPhone: providerContact,
          partnerEmail: "",
        },
        paymentDate: date.toLocaleDateString(),
        invoiceDate: invoicedate.toLocaleDateString(),
        paymentTable: {
          description: `${title != "" ? title : ""}${queryCategory} by ${name}`,
          subTotal: userAmount,
          commission: comission,
          total: partnerAmount,
          totalCommission: comissionAmount,
        },
        partnerInfo: {
          name: name,
          contact: phone,
        },
      },
    };
  }

  const setupDataProperly = (data, queryCategory) => {
    return data.map((item) => {
      if (queryCategory === "Taxi Bookings") {
        return createData(
          item?.id,
          item?.isPaymentClear,
          item?.Driver?.name || "-",
          item?.Driver?.phone || "-",
          item?.name || "-",
          item?.contact || "-",
          item?.timestamp || new Date(),
          item?.AmountOffered || "0",
          item?.comission || "10",
          queryCategory,
          item?.status === "pending" ? "Pending" : item?.status || "Pending"
        );
      }
      if (queryCategory === "Selfdrive Bookings") {
        return createData(
          item?.id,
          item?.isPaymentClear,
          item?.Provider?.name || "-",
          item?.Provider?.phone || "-",
          item?.username || "-",
          item?.phoneNo || "-",
          item?.time || new Date(),
          item?.AmountOffered || "0",
          item?.comission || "10",
          queryCategory,
          item?.status === "pending" ? "Pending" : item?.status || "Pending"
        );
      }
      if (queryCategory === "Room Bookings") {
        return createData(
          item?.id,
          item?.isPaymentClear,
          item?.hotelName || "-",
          item?.managerPhone || "-",
          item?.guestDetails?.name || "-",
          item?.guestDetails?.phone || "-",
          item?.orderedAt || new Date(),
          item?.amount || "0",
          item?.comission || "10",
          queryCategory,
          item?.status
        );
      }
      if (queryCategory === "Sightseeing Bookings") {
        return createData(
          item?.orderId,
          item?.isPaymentClear,
          item?.Provider?.name || "-",
          item?.Provider?.phone || "-",
          item?.guestDetails?.name || "-",
          item?.guestDetails?.phoneNumber || "-",
          item?.orderedAt || new Date(),
          item?.price || "0",
          item?.comission || "10",
          queryCategory,
          item?.status,
          item?.title || "-"
        );
      }
      return createData("-", "-", "-", "-", "-", "0", "0", "", queryCategory);
    });
  };

  const rows = setupDataProperly(matchedRequirements, queryCategory);

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(event.target.value);
    setPage(0);
  };

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      fetchBookingsTotalPages(setTotalPages, startDate, endDate, queryCategory);
      fetchTodayBooking(
        setMatchedRequirements,
        setLoadingReq,
        queryCategory,
        startDate,
        endDate,
        lastDocs,
        setLastDocs,
        rowsPerPage,
        page
      );
    }
  }, [queryCategory, refetch, page, rowsPerPage, isAdmin, isSubAdmin]);

  const createExportData = async (startDate, endDate) => {
    let completeData = [];

    const categories = [
      "Room Bookings",
      "Sightseeing Bookings",
      "Taxi Bookings",
      "Selfdrive Bookings",
    ];

    const results = await Promise.all(
      categories.map(async (category) => {
        const rawData = await fetchTodayBooking(
          () => {},
          () => {},
          category,
          startDate,
          endDate
        );

        return setupDataProperly(rawData, category);
      })
    );

    completeData = results.flat();
    // console.log(completeData);
    setCsvData(completeData);
    return completeData;
  };

  const headers = [
    { label: "Provider Name", key: "provider" },
    { label: "Provider Contact", key: "providerContact" },
    { label: "User Name", key: "name" },
    { label: "User Contact", key: "phone" },
    { label: "Booking At", key: "timestamp" },
    { label: "Booking Amount", key: "userAmount" },
    { label: "Comission", key: "comission" },
    { label: "Partner Amount", key: "partnerAmount" },
    { label: "Booking Category", key: "category" },
  ];

  const handleDownload = async () => {
    setIsDownloading(true);
    const data = await createExportData(startDate, endDate);
    setCsvData(data);
    setIsDownloading(false);
  };

  const handleDateRangeSubmit = (event) => {
    event.preventDefault();
    if (endDate == "") {
      alert("Please select both start and end!!");
      return;
    }
    setRefetch((p) => !p);
  };

  const fileName = `Bookings _from_${startDate}_to_${endDate}.csv`;

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        <form
          onSubmit={(e) => {
            handleDateRangeSubmit(e);
          }}
          className="flex items-end justify-between"
        >
          <fieldset className="px-2 pb-2 border border-black rounded-md">
            <legend className="px-1 text-sm">Start</legend>
            <input
              type="date"
              className="bg-transparent w-[7.5rem] outline-none"
              placeholder="Select date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
              }}
              max={new Date().toISOString().split("T")[0]}
            />
          </fieldset>
          <p className="px-2 pt-1 m-auto"> to </p>
          <fieldset className="px-2 pb-2 border border-black rounded-md">
            <legend className="px-1 text-sm">End</legend>
            <input
              type="date"
              className="bg-transparent w-[7.5rem] outline-none"
              placeholder="Select date"
              value={endDate}
              onChange={(event) => {
                if (startDate == "") {
                  alert("Please Select Start Date First!!");
                  return;
                }
                setEndDate(event.target.value);
              }}
              min={startDate}
              max={new Date().toISOString().split("T")[0]}
            />
          </fieldset>

          <button
            type="submit"
            className="w-24 py-2 mb-1 ml-2 text-sm font-semibold text-white bg-orange-400 rounded hover:bg-orange-500 focus:outline-none focus:shadow-outline"
          >
            Apply
          </button>
        </form>

        <div className="mb-1 flex items-end">
          {!csvData ? (
            <button
              className={` py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
              onClick={handleDownload}
            >
              {isDownloading ? "Generating..." : "Generate CSV"}
            </button>
          ) : (
            <CSVLink
              className={`py-2 px-4 rounded text-white font-semibold bg-orange-400 hover:bg-orange-500 focus:outline-none focus:shadow-outline text-sm`}
              data={csvData}
              onClick={() => setCsvData(null)}
              headers={headers}
              filename={fileName}
            >
              Export
            </CSVLink>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          "Room Bookings",
          "Sightseeing Bookings",
          "Taxi Bookings",
          "Selfdrive Bookings",
        ].map((serviceCategory, i) => (
          <div className="mb-1 flex items-end" key={i}>
            <button
              onClick={() => {
                setQueryCategory(serviceCategory);
                setPage(0);
              }}
              className={` py-2 px-4 rounded text-white font-semibold bg-[var(--categories-bg-color)] focus:outline-none focus:shadow-outline ${
                queryCategory !== serviceCategory &&
                "opacity-40 font-normal hover:opacity-70"
              }`}
            >
              {serviceCategory}
            </button>
          </div>
        ))}
      </div>

      <Paper sx={{ width: "100%", overflowX: "hidden" }}>
        <TableContainer>
          {loadingReq ? (
            <LoadingContent />
          ) : (
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align="center"
                      style={{
                        width: column.width,
                        color: "var(--primary-bg)",
                        fontWeight: "bold",
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  return (
                    <TableRow hover role="checkbox" tabIndex={-1} key={i}>
                      {columns.map((column) => {
                        let value = row[column.id];

                        return (
                          <TableCell key={column.id} align="center">
                            {(column?.id === "timestamp" && value) ||
                              (column.id === "action" && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    className={`add-new-btn !bg-blue-500 ${
                                      row.isPaymentClear && "opacity-50"
                                    }`}
                                    onClick={() =>
                                      handleClear(
                                        queryCategory,
                                        row.id,
                                        setRefetch
                                      )
                                    }
                                  >
                                    {row.isPaymentClear ? "Done" : "Clear"}
                                  </button>
                                </div>
                              )) ||
                              (column.id === "userInvoice" && (
                                <div className="flex items-center justify-center gap-1">
                                  {!generationUserInvoices[row.id] ? (
                                    <button
                                      className="bg-[var(--primary-bg)] text-white p-1 rounded-full mr-1"
                                      onClick={() =>
                                        toggleUserInvoiceGeneration(row.id)
                                      }
                                    >
                                      <DescriptionRoundedIcon />
                                    </button>
                                  ) : (
                                    <PDFDownloadLink
                                      document={
                                        <UserInvoice
                                          invoice={row?.userInvoce}
                                          contactInfo={contactInfo}
                                        />
                                      }
                                      fileName="userinvoice.pdf"
                                    >
                                      {({ loading }) =>
                                        loading ? (
                                          "Loading..."
                                        ) : (
                                          <button className="bg-[var(--primary-bg)] text-white p-1 rounded-full mr-1">
                                            <FileDownloadIcon />
                                          </button>
                                        )
                                      }
                                    </PDFDownloadLink>
                                  )}
                                </div>
                              )) ||
                              (column.id === "partnerInvoice" && (
                                <div className="flex items-center justify-center gap-1">
                                  {!generationPartnerInvoices[row.id] ? (
                                    <button
                                      className="bg-[var(--primary-bg)] text-white p-1 rounded-full mr-1"
                                      onClick={() =>
                                        togglePartnerInvoiceGeneration(row.id)
                                      }
                                    >
                                      <DescriptionRoundedIcon />
                                    </button>
                                  ) : (
                                    <PDFDownloadLink
                                      document={
                                        <PartnerInvoice
                                          invoice={row?.partnerInvoiceInfo}
                                          contactInfo={contactInfo}
                                        />
                                      }
                                      fileName="partnerinvoice.pdf"
                                    >
                                      {({ loading }) =>
                                        loading ? (
                                          "Loading..."
                                        ) : (
                                          <button className="bg-[var(--primary-bg)] text-white p-1 rounded-full mr-1">
                                            <FileDownloadIcon />
                                          </button>
                                        )
                                      }
                                    </PDFDownloadLink>
                                  )}
                                </div>
                              )) ||
                              value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="w-full text-center my-5 light-text">
                        No {queryCategory}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 25, 100]}
          component="div"
          count={totalPages}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </div>
  );
};

export default TodayBookings;
