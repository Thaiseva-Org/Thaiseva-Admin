import { useEffect, useState, useMemo } from "react";
import { getDocs, doc, updateDoc } from "firebase/firestore";
import {
  db,
  deleteUserFromAuth,
  deletionRequestsCollection,
} from "../../../../firebase/firebase.config";
import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import { format } from "timeago.js";
import Swal from "sweetalert2";
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
 * Calculates days remaining in 30-day auto-deletion grace period under Thailand PDPA.
 * @param {any} createdAt - Date when deletion was requested
 * @returns {number|null} Days remaining (positive = active grace period, <= 0 = overdue/due now)
 */
const calculateDaysRemaining = (createdAt) => {
  const requestDate = parseFirestoreDate(createdAt);
  if (!requestDate) return null;
  
  const deleteAfterDays = 30;
  const now = new Date();
  const diffTime = now.getTime() - requestDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return deleteAfterDays - diffDays;
};

/**
 * Normalizes request status string across legacy and modern variants.
 * @param {string} statusStr - Raw status from Firestore
 * @returns {'Pending' | 'Completed' | 'Cancelled'} Normalized status enum
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

/**
 * DeletionRequests Administrative Dashboard Component
 * 
 * Manages user account deletion requests in statutory compliance with the
 * Thailand Personal Data Protection Act B.E. 2562 (Section 33 - Right to Erasure)
 * and Google Play / Apple App Store account deletion policies.
 * 
 * Architectural Characteristics:
 * - 30-Day Grace Period: Tracks remaining days before permanent deletion is required.
 * - Multi-Tab Categorization: All, Pending, Due Now (<= 0 days left), Completed, and Cancelled.
 * - Cloud Function Integration: Calls `deleteUserFunction` (via deleteUserFromAuth) to
 *   destroy the Firebase Auth login profile while retaining financial order ledgers.
 * - Real-Time Audit Trail: Updates Firestore DeletionRequests with completion timestamps.
 * 
 * @component
 * @returns {JSX.Element}
 */
const DeletionRequests = () => {
  const recentAuth = useRecentAuthAction();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'pending', 'due', 'completed', 'cancelled'
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
   * then marks the deletion request as 'Completed' with audit timestamps.
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

      // Call cloud function to delete user from Firebase Auth if uid is present
      if (request.uid) {
        await recentAuth.run(() => deleteUserFromAuth({
          uid: request.uid,
          requestId: request.id,
        }));
      }

      // The server owns erasure status and records unfinished review work.

      Swal.fire(
        "Erasure started",
        "Login, profile and private user uploads were removed. Retained business records still require review before erasure is complete.",
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

  // Summary Metrics
  const stats = useMemo(() => {
    let pending = 0;
    let dueForDeletion = 0;
    let completed = 0;
    let cancelled = 0;

    requests.forEach((req) => {
      const status = getNormalizedStatus(req.status);
      if (status === "Pending") {
        pending++;
        const reqDate = req.createdAt || req.requestedAt;
        const daysLeft = calculateDaysRemaining(reqDate);
        if (daysLeft !== null && daysLeft <= 0) {
          dueForDeletion++;
        }
      } else if (status === "Completed") {
        completed++;
      } else if (status === "Cancelled") {
        cancelled++;
      }
    });

    return {
      total: requests.length,
      pending,
      dueForDeletion,
      completed,
      cancelled,
    };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const status = getNormalizedStatus(req.status);
      const reqDate = req.createdAt || req.requestedAt;
      const daysLeft = calculateDaysRemaining(reqDate);

      // Tab filter
      if (activeTab === "pending" && status !== "Pending") return false;
      if (activeTab === "due" && (status !== "Pending" || daysLeft === null || daysLeft > 0)) return false;
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
            Manage user account deletion requests submitted via web and mobile apps in compliance with Store policies.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 shadow-sm text-sm font-medium transition-colors self-start md:self-auto cursor-pointer"
        >
          <i className={`fa-solid fa-rotate-right ${loading ? "animate-spin" : ""}`}></i>
          Refresh Data
        </button>
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
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white text-xl">
              <i className="fa-solid fa-inbox"></i>
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
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white text-xl">
              <i className="fa-solid fa-clock"></i>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("due")}
          className={`bg-gradient-to-br from-danger-500 to-danger-600 rounded-xl p-5 text-white shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            activeTab === "due" ? "ring-4 ring-white/60 shadow-2xl scale-[1.02]" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-danger-100 text-xs font-semibold uppercase tracking-wider mb-1">Due Now (30d+)</p>
              <p className="text-2xl font-bold">{stats.dueForDeletion}</p>
            </div>
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white text-xl">
              <i className="fa-solid fa-triangle-exclamation"></i>
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
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white text-xl">
              <i className="fa-solid fa-circle-check"></i>
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
            <div className="bg-white/20 p-2.5 rounded-lg flex items-center justify-center text-white text-xl">
              <i className="fa-solid fa-ban"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
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
                <i className="fa-solid fa-xmark"></i>
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
              onClick={() => setActiveTab("due")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "due" ? "bg-white text-red-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Due Now ({stats.dueForDeletion})
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
                <th className="py-3 px-4">Countdown / Grace</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req, i) => {
                  const reqDate = parseFirestoreDate(req.createdAt || req.requestedAt);
                  const daysRemaining = calculateDaysRemaining(req.createdAt || req.requestedAt);
                  const normalizedStatus = getNormalizedStatus(req.status);
                  const isPending = normalizedStatus === "Pending";
                  const isCompleted = normalizedStatus === "Completed";
                  const isCancelled = normalizedStatus === "Cancelled";
                  const isDueNow = isPending && daysRemaining !== null && daysRemaining <= 0;

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isDueNow ? "bg-red-50/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
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

                      {/* Days Left / Countdown */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isPending ? (
                          daysRemaining !== null ? (
                            daysRemaining <= 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                                <i className="fa-solid fa-triangle-exclamation"></i> Due Now ({Math.abs(daysRemaining)}d overdue)
                              </span>
                            ) : daysRemaining <= 7 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                <i className="fa-solid fa-clock"></i> {daysRemaining} Days Left
                              </span>
                            ) : daysRemaining <= 15 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                                <i className="fa-solid fa-clock"></i> {daysRemaining} Days Left
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <i className="fa-solid fa-clock"></i> {daysRemaining} Days Left
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs font-mono">-</span>
                        )}
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
                            <i className="fa-solid fa-eye text-base"></i>
                          </button>

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleAcceptDeletion(req)}
                                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                              >
                                <i className="fa-solid fa-user-xmark"></i> Accept
                              </button>
                              <button
                                onClick={() => handleCancelAutoDeletion(req.id)}
                                className="inline-flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
                              >
                                <i className="fa-solid fa-ban"></i> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <i className="fa-solid fa-folder-open text-3xl text-gray-300"></i>
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
                  <i className="fa-solid fa-user-gear"></i>
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
                <i className="fa-solid fa-xmark text-lg"></i>
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

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">Date Submitted</span>
                <p className="text-gray-800">
                  {parseFirestoreDate(selectedRequest.createdAt || selectedRequest.requestedAt)?.toLocaleString() || "N/A"}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
              {getNormalizedStatus(selectedRequest.status) === "Pending" && (
                <>
                  <button
                    onClick={() => handleAcceptDeletion(selectedRequest)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Accept Deletion
                  </button>
                  <button
                    onClick={() => handleCancelAutoDeletion(selectedRequest.id)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Request
                  </button>
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
      )}
      {recentAuth.dialog}
    </div>
  );
};

export default DeletionRequests;

