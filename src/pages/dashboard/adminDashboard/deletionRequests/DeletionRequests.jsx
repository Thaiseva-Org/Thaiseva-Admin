import { useEffect, useState, useMemo } from "react";
import { getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  db,
  deleteUserFromAuth,
  deletionRequestsCollection,
} from "../../../../firebase/firebase.config";
import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import { format } from "timeago.js";
import Swal from "sweetalert2";
import AccountErasureDetails from "../../../../components/AccountErasureDetails";
import useRecentAuthAction from "../../../../hooks/useRecentAuthAction";

/**
 * Safely parses any date representation from Firestore or JS (Timestamp, ISO string, seconds obj, etc.)
 * @param {any} dateVal - Input date representation from Firestore or JS Date/String
 * @returns {Date|null} Parsed JavaScript Date object, or null if invalid
 */
const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal.toDate === "function") {
    return dateVal.toDate();
  }
  if (typeof dateVal === "object" && (dateVal.seconds !== undefined || dateVal._seconds !== undefined)) {
    const sec = dateVal.seconds !== undefined ? dateVal.seconds : dateVal._seconds;
    return new Date(sec * 1000);
  }
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Normalizes request status string across legacy and modern variants.
 * @param {string} statusStr - Raw status from Firestore
 * @returns {'Pending' | 'Erasure Pending' | 'Completed' | 'Cancelled'} Normalized status enum
 */
const getNormalizedStatus = (statusStr) => {
  if (!statusStr) return "Pending";
  const lower = String(statusStr).trim().toLowerCase();
  if (lower === "erasure pending") return "Erasure Pending";
  if (["completed", "approved", "accepted", "deleted"].includes(lower)) {
    return "Completed";
  }
  if (["cancelled", "canceled", "rejected"].includes(lower)) {
    return "Cancelled";
  }
  return "Pending";
};

// SVG Icon Components for reliable native rendering
const InboxSvg = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

const ClockSvg = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningSvg = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckCircleSvg = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BanSvg = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

const TrashSvg = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RotateSvg = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SearchSvg = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const XMarkSvg = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EyeSvg = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const UserXMarkSvg = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
  </svg>
);

const FolderSvg = ({ className = "w-10 h-10" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const UserGearSvg = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

/** Tracks automatic customer cleanup and the remaining retained-record review. */
const DeletionRequests = () => {
  const recentAuth = useRecentAuthAction();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'pending', 'erasure', 'completed', 'cancelled'
  const [selectedRequest, setSelectedRequest] = useState(null); // For Details Modal

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(deletionRequestsCollection);
      const reqData = [];
      querySnapshot.forEach((doc) => {
        reqData.push({ id: doc.id, ...doc.data() });
      });

      // Sort by createdAt descending
      reqData.sort((a, b) => {
        const dateA = parseFirestoreDate(a.createdAt || a.requestedAt) || new Date(0);
        const dateB = parseFirestoreDate(b.createdAt || b.requestedAt) || new Date(0);
        return dateB - dateA;
      });

      setRequests(reqData);
    } catch (error) {
      console.error("Error fetching deletion requests:", error);
      Swal.fire("Error!", "Failed to fetch account deletion requests.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  /**
   * Prompts admin confirmation and executes permanent account deletion.
   * Invokes the backend Cloud Function `deleteUserFunction` to delete the Firebase Auth user,
   * then leaves the request as 'Erasure Pending' for retained-record review.
   * 
   * @async
   * @param {Object} request - Deletion request document
   * @param {string} request.id - Firestore document ID in DeletionRequests
   * @param {string} request.uid - Target user Firebase Auth UID
   * @param {string} [request.email] - Target user email address
   */
  const handleAcceptDeletion = async (request) => {
    if (!request) return;

    try {
      const result = await Swal.fire({
        title: "Approve Account Deletion?",
        html: `
          <div class="text-left text-sm space-y-2">
            <p>You are about to start account erasure for:</p>
            <p class="font-bold text-gray-800 bg-gray-100 p-2 rounded">${String(request.email || request.uid || "Unknown User").replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]))}</p>
            <p class="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
              <i class="fa-solid fa-triangle-exclamation mr-1"></i>
              <b>Note:</b> Login, profile and private user uploads will be removed. Retained business records need review before erasure is complete.
            </p>
          </div>
        `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Start account erasure",
      });

      if (!result.isConfirmed) return;

      setLoading(true);

      // The server validates identity and owns cleanup results.
      await recentAuth.run(() => deleteUserFromAuth({
        uid: request.uid,
        requestId: request.id,
      }));

      // The server owns erasure status and records unfinished review work.

      Swal.fire(
        "Erasure started",
        "Account cleanup ran. Uploads covered by a retention hold may be preserved. Retained business records still require review before erasure is complete.",
        "success"
      );
      if (selectedRequest?.id === request.id) {
        setSelectedRequest(null);
      }
      fetchRequests();
    } catch (error) {
      console.error("Error accepting deletion request:", error);
      Swal.fire(
        "Error!",
        error?.message || "Failed to approve the deletion request.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cancels a pending deletion request upon user request or staff discretion.
   * Updates status to 'Cancelled' with a cancellation timestamp.
   * 
   * @async
   * @param {string} id - Deletion request document ID in DeletionRequests
   */
  const handleCancelAutoDeletion = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Cancel Deletion Request?",
        text: "Are you sure you want to cancel the deletion request for this user?",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#4f46e5",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, Cancel Request",
      });

      if (!result.isConfirmed) return;

      setLoading(true);
      const requestRef = doc(db, "DeletionRequests", id);
      await updateDoc(requestRef, {
        status: "Cancelled",
        cancelledAt: new Date().toISOString(),
      });

      Swal.fire(
        "Cancelled!",
        "The account deletion request has been cancelled.",
        "success"
      );
      if (selectedRequest?.id === id) {
        setSelectedRequest(null);
      }
      fetchRequests();
    } catch (error) {
      console.error("Error cancelling deletion request:", error);
      Swal.fire("Error!", "Failed to cancel the deletion request.", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Permanently deletes a single deletion request record from Firestore.
   * 
   * @async
   * @param {Object} request - Deletion request object
   */
  const handleDeleteRecord = async (request) => {
    if (!request?.id || !["Completed", "Cancelled"].includes(getNormalizedStatus(request.status))) return;

    try {
      const result = await Swal.fire({
        title: "Delete Record?",
        text: `Permanently delete this deletion record for ${request.email || request.uid || "this user"}? This action cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, Delete Record",
      });

      if (!result.isConfirmed) return;

      setLoading(true);
      await deleteDoc(doc(db, "DeletionRequests", request.id));

      Swal.fire(
        "Deleted!",
        "The deletion request record has been permanently removed.",
        "success"
      );
      if (selectedRequest?.id === request.id) {
        setSelectedRequest(null);
      }
      fetchRequests();
    } catch (error) {
      console.error("Error deleting record:", error);
      Swal.fire("Error!", error?.message || "Failed to delete the record.", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clears all cancelled records from Firestore.
   * 
   * @async
   */
  const handleClearCancelled = async () => {
    const cancelledRequests = requests.filter(r => getNormalizedStatus(r.status) === "Cancelled");
    if (cancelledRequests.length === 0) return;

    try {
      const result = await Swal.fire({
        title: "Clear All Cancelled Records?",
        text: `Permanently remove all ${cancelledRequests.length} cancelled deletion request records?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: `Yes, Clear (${cancelledRequests.length})`,
      });

      if (!result.isConfirmed) return;

      setLoading(true);
      await Promise.all(cancelledRequests.map(r => deleteDoc(doc(db, "DeletionRequests", r.id))));

      Swal.fire("Cleared!", "All cancelled records have been removed.", "success");
      fetchRequests();
    } catch (error) {
      console.error("Error clearing cancelled records:", error);
      Swal.fire("Error!", error?.message || "Failed to clear records.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Summary Metrics
  const stats = useMemo(() => {
    let pending = 0;
    let erasurePending = 0;
    let completed = 0;
    let cancelled = 0;

    requests.forEach((req) => {
      const status = getNormalizedStatus(req.status);
      if (status === "Pending") {
        pending++;
      } else if (status === "Erasure Pending") {
        erasurePending++;
      } else if (status === "Completed") {
        completed++;
      } else if (status === "Cancelled") {
        cancelled++;
      }
    });

    return {
      total: requests.length,
      pending,
      erasurePending,
      completed,
      cancelled,
    };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const status = getNormalizedStatus(req.status);

      // Tab filter
      if (activeTab === "pending" && status !== "Pending") return false;
      if (activeTab === "erasure" && status !== "Erasure Pending") return false;
      if (activeTab === "completed" && status !== "Completed") return false;
      if (activeTab === "cancelled" && status !== "Cancelled") return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const email = (req.email || "").toLowerCase();
        const uid = (req.uid || "").toLowerCase();
        const reason = (req.reason || "").toLowerCase();
        const source = (req.source || req.method || "").toLowerCase();

        return (
          email.includes(query) ||
          uid.includes(query) ||
          reason.includes(query) ||
          source.includes(query)
        );
      }

      return true;
    });
  }, [requests, activeTab, searchQuery]);

  if (loading && requests.length === 0) {
    return <LoadingContent />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PageHeading text="Account Auto-Deletion Requests" />
          <p className="text-sm text-gray-500 mt-1">
            New web and mobile requests start account cleanup automatically, without a 30-day wait. Retained business records and held data still require review.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          {stats.cancelled > 0 && (
            <button
              onClick={handleClearCancelled}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <TrashSvg className="w-4 h-4" />
              Clear Cancelled ({stats.cancelled})
            </button>
          )}
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 shadow-sm text-sm font-medium transition-colors cursor-pointer"
          >
            <RotateSvg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div
          onClick={() => setActiveTab("all")}
          className={`bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "all" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-xs font-semibold uppercase tracking-wider mb-1">Total Requests</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white">
              <InboxSvg className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("pending")}
          className={`bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "pending" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-warning-100 text-xs font-semibold uppercase tracking-wider mb-1">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white">
              <ClockSvg className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("erasure")}
          className={`bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "erasure" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-xs font-semibold uppercase tracking-wider mb-1">Erasure Pending</p>
              <p className="text-2xl font-bold">{stats.erasurePending}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white">
              <WarningSvg className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("completed")}
          className={`bg-gradient-to-br from-success-500 to-success-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "completed" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-success-100 text-xs font-semibold uppercase tracking-wider mb-1">Completed</p>
              <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white">
              <CheckCircleSvg className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("cancelled")}
          className={`bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "cancelled" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-xs font-semibold uppercase tracking-wider mb-1">Cancelled</p>
              <p className="text-2xl font-bold">{stats.cancelled}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white">
              <BanSvg className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <SearchSvg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search email, UID, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                <XMarkSvg className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto bg-gray-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "pending" ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setActiveTab("erasure")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "erasure" ? "bg-white text-red-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Erasure Pending ({stats.erasurePending})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "completed" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Completed ({stats.completed})
            </button>
            <button
              onClick={() => setActiveTab("cancelled")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "cancelled" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cancelled ({stats.cancelled})
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold tracking-wider border-b border-gray-200">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Requested At</th>
                <th className="py-3 px-4">Cleanup / Review</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req, i) => {
                  const reqDate = parseFirestoreDate(req.createdAt || req.requestedAt);
                  const normalizedStatus = getNormalizedStatus(req.status);
                  const isPending = normalizedStatus === "Pending";
                  const isCompleted = normalizedStatus === "Completed";
                  const isCancelled = normalizedStatus === "Cancelled";
                  const isErasurePending = normalizedStatus === "Erasure Pending";

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isErasurePending ? "bg-amber-50/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 break-all">
                            {req.email || "No Email Provided"}
                          </span>
                          <span className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-[180px]" title={req.uid}>
                            UID: {req.uid || req.id}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
                              {req.source || req.method || "WEB"}
                            </span>
                            {req.verifiedViaGoogle && (
                              <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                <i className="fa-brands fa-google text-[10px]"></i> Google
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <p className="text-sm text-gray-600 line-clamp-2" title={req.reason}>
                          {req.reason || <span className="text-gray-400 italic">No reason specified</span>}
                        </p>
                      </td>

                      {/* Requested At */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {reqDate ? (
                          <div className="flex flex-col">
                            <span className="text-gray-800 font-medium">
                              {reqDate.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-xs text-gray-400">{format(reqDate)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-[250px]">
                        <p className="text-xs text-gray-600">
                          {req.processingError || (isErasurePending
                            ? req.loginDeletedAt
                              ? "Login removed; open details for cleanup evidence and retained data."
                              : "Cleanup is processing or awaiting review/retry."
                            : isPending ? "Queued for automatic cleanup; holds and staff accounts need review." : "-")}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : isCancelled
                              ? "bg-gray-100 text-gray-700 border border-gray-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCompleted ? "bg-emerald-500" : isCancelled ? "bg-gray-400" : "bg-amber-500"
                            }`}
                          ></span>
                          {normalizedStatus}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedRequest(req)}
                            title="View Full Details"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <EyeSvg className="w-4 h-4" />
                          </button>

                          {(isPending || isErasurePending) && (
                            <>
                              <button
                                onClick={() => handleAcceptDeletion(req)}
                                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                              >
                                <UserXMarkSvg className="w-3.5 h-3.5" /> {req.loginDeletedAt ? "Retry Cleanup" : "Start Cleanup"}
                              </button>
                              {isPending && <button
                                onClick={() => handleCancelAutoDeletion(req.id)}
                                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                              >
                                <BanSvg className="w-3.5 h-3.5" /> Cancel
                              </button>}
                            </>
                          )}

                          {(isCompleted || isCancelled) && <button
                            onClick={() => handleDeleteRecord(req)}
                            title="Delete Record"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <TrashSvg className="w-4 h-4" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FolderSvg className="w-12 h-12 text-gray-300 mx-auto" />
                      <p className="font-medium text-gray-600">No account deletion requests found.</p>
                      {searchQuery && (
                        <p className="text-xs text-gray-400">
                          Try clearing your search term &quot;{searchQuery}&quot;.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <UserGearSvg className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Deletion Request Details</h3>
                  <p className="text-xs text-gray-500">ID: {selectedRequest.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <XMarkSvg className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto text-sm">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">User Email</span>
                <p className="font-bold text-gray-900 break-all">{selectedRequest.email || "N/A"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase">User UID</span>
                  <p className="font-mono text-xs text-gray-800 truncate" title={selectedRequest.uid}>{selectedRequest.uid || "N/A"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                  <p className="font-semibold text-indigo-700">{getNormalizedStatus(selectedRequest.status)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Source</span>
                  <p className="font-medium text-gray-800">{selectedRequest.source || selectedRequest.method || "WEB"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Google Auth</span>
                  <p className="font-medium text-gray-800">{selectedRequest.verifiedViaGoogle ? "Yes (Google Verified)" : "No"}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">Reason Provided</span>
                <p className="text-gray-800 text-sm whitespace-pre-wrap">{selectedRequest.reason || "No reason specified"}</p>
              </div>

              <AccountErasureDetails uid={selectedRequest.uid} />
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">Date Submitted</span>
                <p className="text-gray-800">
                  {parseFirestoreDate(selectedRequest.createdAt || selectedRequest.requestedAt)?.toLocaleString() || "N/A"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
              {["Completed", "Cancelled"].includes(getNormalizedStatus(selectedRequest.status)) && <button
                onClick={() => handleDeleteRecord(selectedRequest)}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <TrashSvg className="w-3.5 h-3.5" />
                Delete Record
              </button>}

              <div className="flex items-center gap-2">
                {["Pending", "Erasure Pending"].includes(getNormalizedStatus(selectedRequest.status)) && (
                  <>
                    <button
                      onClick={() => handleAcceptDeletion(selectedRequest)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {selectedRequest.loginDeletedAt ? "Retry Cleanup" : "Start Cleanup"}
                    </button>
                    {getNormalizedStatus(selectedRequest.status) === "Pending" && <button
                      onClick={() => handleCancelAutoDeletion(selectedRequest.id)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel Request
                    </button>}
                  </>
                )}
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {recentAuth.dialog}
    </div>
  );
};

export default DeletionRequests;

