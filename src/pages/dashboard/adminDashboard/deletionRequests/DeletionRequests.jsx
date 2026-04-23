import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, deletionRequestsCollection } from "../../../../firebase/firebase.config";
import PageHeading from "../../../../components/PageHeading";
import LoadingContent from "../../../../components/LoadingContent";
import { format } from "timeago.js";
import Swal from "sweetalert2";
import ActionButtons from "../../../../components/ActionButtons";

const DeletionRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(deletionRequestsCollection);
      const reqData = [];
      querySnapshot.forEach((doc) => {
        reqData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by createdAt descending (fallback to requestedAt)
      reqData.sort((a, b) => {
        const timeA = (a.createdAt || a.requestedAt);
        const timeB = (b.createdAt || b.requestedAt);
        const dateA = timeA?.toDate ? timeA.toDate() : new Date(timeA || 0);
        const dateB = timeB?.toDate ? timeB.toDate() : new Date(timeB || 0);
        return dateB - dateA;
      });
      setRequests(reqData);
    } catch (error) {
      console.error("Error fetching deletion requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleCancelAutoDeletion = async (id) => {
    try {
      const result = await Swal.fire({
        title: "Cancel Auto-deletion?",
        text: "Are you sure you want to cancel the deletion request for this user?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, cancel it!",
      });

      if (result.isConfirmed) {
        setLoading(true);
        const requestRef = doc(db, "DeletionRequests", id);
        await updateDoc(requestRef, {
          status: "Cancelled",
          cancelledAt: new Date().toISOString(),
        });
        
        Swal.fire(
          "Cancelled!",
          "The deletion request has been cancelled.",
          "success"
        );
        fetchRequests();
      }
    } catch (error) {
      console.error("Error cancelling deletion request:", error);
      Swal.fire("Error!", "Failed to cancel the deletion request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysRemaining = (createdAt) => {
    if (!createdAt) return "N/A";
    const requestDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const deleteAfterDays = 30;
    const now = new Date();
    const diffTime = now - requestDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remaining = deleteAfterDays - diffDays;
    
    if (remaining < 0) return 0;
    return remaining;
  };

  if (loading && requests.length === 0) {
    return <LoadingContent />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeading text="Account Deletion Requests" />
      
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-sm md:text-base border-b">
              <th className="py-3 px-4 xl:px-6">User/Email</th>
              <th className="py-3 px-4 xl:px-6">Reason</th>
              <th className="py-3 px-4 xl:px-6">Requested At</th>
              <th className="py-3 px-4 xl:px-6">Days Left</th>
              <th className="py-3 px-4 xl:px-6">Status</th>
              <th className="py-3 px-4 xl:px-6 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length > 0 ? (
              requests.map((req, i) => {
                const reqDate = req.createdAt || req.requestedAt;
                const daysRemaining = calculateDaysRemaining(reqDate);
                const isCancelled = req.status === "Cancelled";
                const isCompleted = req.status === "Completed";
                
                return (
                  <tr
                    key={req.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="py-3 px-4 xl:px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">
                          {req.email || "Unknown User"}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {req.source || req.method || "WEB"}
                          </span>
                          {req.verifiedViaGoogle && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                              <i className="fa-brands fa-google text-[10px]"></i> Google Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 xl:px-6 max-w-[200px]">
                      <p className="text-sm text-gray-600 truncate" title={req.reason}>
                        {req.reason || "No reason provided"}
                      </p>
                    </td>
                    <td className="py-3 px-4 xl:px-6 whitespace-nowrap text-sm">
                      {reqDate ? format(reqDate.toDate ? reqDate.toDate() : reqDate) : "N/A"}
                    </td>
                    <td className="py-3 px-4 xl:px-6">
                      {!isCancelled && !isCompleted ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          daysRemaining <= 7 ? "bg-red-100 text-red-700" :
                          daysRemaining <= 15 ? "bg-orange-100 text-orange-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {daysRemaining} Days
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 xl:px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        isCancelled ? "bg-red-100 text-red-700" :
                        isCompleted ? "bg-green-100 text-green-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {req.status || "Pending"}
                      </span>
                    </td>
                    <td className="py-3 px-4 xl:px-6 text-center">
                      {!isCancelled && !isCompleted ? (
                        <button
                          onClick={() => handleCancelAutoDeletion(req.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 italic">Action unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="py-10 text-center text-gray-500 italic">
                  No deletion requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && requests.length > 0 && (
         <div className="flex justify-center p-4">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
         </div>
      )}
    </div>
  );
};

export default DeletionRequests;
