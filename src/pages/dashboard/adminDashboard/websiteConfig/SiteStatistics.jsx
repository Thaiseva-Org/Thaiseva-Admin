/**
 * @file SiteStatistics.jsx
 * @description Administrative configuration interface for dynamic marketing metric counters.
 *
 * Architecture & Features:
 * - Real-time synchronization with Firestore document `image/stats` via {@link subscribeToMedia}
 * - Direct control over About Us metrics (`happyTravelers`, `verifiedHotels`, `curatedTours`, `localPartners`)
 * - Instant toggle between active custom counters and default fallback values
 * - Live in-portal preview strips simulating the customer-facing presentation
 * - Atomic persistence with server timestamps via {@link updateSiteStats}
 *
 * @module AdminDashboard/WebsiteConfig/SiteStatistics
 */

import { useState, useEffect } from "react";
import { Button, Switch, TextField } from "@mui/material";
import Swal from "sweetalert2";
import ConfigHeader from "../../../../components/websiteConfig/ConfigHeader";
import { DEFAULT_SITE_STATS } from "../../../../data/websiteMediaSlots";
import {
  subscribeToMedia,
  updateSiteStats,
} from "../../../../services/WebsiteMediaService";
import { SaveIcon } from "@icons";

/**
 * SiteStatistics Component.
 *
 * Provides marketing administrators with live controls over published statistics
 * displayed on the platform's public About Us page.
 */
const SiteStatistics = () => {
  const [statsForm, setStatsForm] = useState({ ...DEFAULT_SITE_STATS });
  const [statsSaving, setStatsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToMedia(
      ({ stats: newStats }) => {
        setStatsForm(newStats);
      },
      (error) => {
        console.error("Firestore listener failed:", error);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  /**
   * Updates an individual counter or configuration property in local state.
   *
   * @param {string} field - Target property name.
   * @param {string} value - New value string.
   */
  const handleStatsInputChange = (field, value) => {
    setStatsForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Persists modified site statistics counters to Firestore document `image/stats`.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleSaveStats = async () => {
    setStatsSaving(true);
    try {
      await updateSiteStats(statsForm, statsForm.status || "active");
      Swal.fire({
        icon: "success",
        title: "Site Statistics Updated!",
        text: "The About Us counters have been synchronized in real time.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Save stats error:", err);
      Swal.fire("Error", "Failed to update statistics: " + err.message, "error");
    } finally {
      setStatsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      <ConfigHeader
        title="Site Statistics"
        subtitle="Manage dynamic counters for the About Us Page."
        showAdd={false}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              <h2 className="text-xl font-bold text-slate-800">
                Dynamic Site Statistics Editor
              </h2>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              These statistics animate live counters on the{" "}
              <strong>About Us Page</strong>. Values can be formatted strings (e.g. <code>100+</code>, <code>5</code>) or numbers.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Status:</span>
              <Switch
                checked={statsForm.status === "active"}
                onChange={(e) =>
                  handleStatsInputChange("status", e.target.checked ? "active" : "inactive")
                }
                color="warning"
              />
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                  statsForm.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {statsForm.status === "active" ? "Active" : "Inactive (Default)"}
              </span>
            </div>

            <Button
              variant="contained"
              onClick={handleSaveStats}
              disabled={statsSaving}
              startIcon={<SaveIcon />}
              sx={{
                backgroundColor: "#f97316",
                textTransform: "none",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "10px 24px",
                "&:hover": { backgroundColor: "#ea580c" },
              }}
            >
              {statsSaving ? "Saving..." : "Save Statistics"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 mt-6">
          {/* ABOUT US PAGE COUNTERS */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-800 text-base">About Us Page Counters</h3>
                <p className="text-xs text-slate-500">Rendered in the Frame 6 Statistics bar on About Us</p>
              </div>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md">
                Page: `/about`
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Happy Travelers (`happyTravelers`)
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={statsForm.happyTravelers}
                  onChange={(e) => handleStatsInputChange("happyTravelers", e.target.value)}
                  placeholder="0+"
                  helperText="Default: 0+"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verified Hotels (`verifiedHotels`)
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={statsForm.verifiedHotels}
                  onChange={(e) => handleStatsInputChange("verifiedHotels", e.target.value)}
                  placeholder="5"
                  helperText="Default: 5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curated Tours (`curatedTours`)
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={statsForm.curatedTours}
                  onChange={(e) => handleStatsInputChange("curatedTours", e.target.value)}
                  placeholder="1"
                  helperText="Default: 1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Local Partners (`localPartners`)
                </label>
                <TextField
                  fullWidth
                  size="small"
                  value={statsForm.localPartners}
                  onChange={(e) => handleStatsInputChange("localPartners", e.target.value)}
                  placeholder="0+"
                  helperText="Default: 0+"
                />
              </div>
            </div>

            {/* Live simulation strip */}
            <div className="mt-4 p-4 bg-orange-500 rounded-xl text-white">
              <p className="text-[11px] text-orange-100 uppercase tracking-wider mb-2 font-medium">
                Live About Us Preview:
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-extrabold text-white">{statsForm.happyTravelers}</p>
                  <p className="text-[10px] text-orange-100">Travelers</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{statsForm.verifiedHotels}</p>
                  <p className="text-[10px] text-orange-100">Hotels</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{statsForm.curatedTours}</p>
                  <p className="text-[10px] text-orange-100">Tours</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">{statsForm.localPartners}</p>
                  <p className="text-[10px] text-orange-100">Partners</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteStatistics;
