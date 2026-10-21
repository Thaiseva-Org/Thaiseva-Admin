import ExcelJS from "exceljs";

/**
 * Formats a number as THB currency string for display in text notes.
 */
const formatTHBText = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

/**
 * Applies styled headers, borders, font, and background colors to a range or row.
 */
function styleHeaderRow(row, bgColor = "0F766E", fgColor = "FFFFFF", height = 26) {
  row.height = height;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: fgColor },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium", color: { argb: "0F766E" } },
      bottom: { style: "medium", color: { argb: "0F766E" } },
      left: { style: "thin", color: { argb: "CBD5E1" } },
      right: { style: "thin", color: { argb: "CBD5E1" } },
    };
  });
}

/**
 * Adjusts column widths dynamically based on header and data text lengths.
 */
function autoFitColumns(worksheet, minWidth = 14) {
  worksheet.columns.forEach((column) => {
    let maxLength = minWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      // Ignore merged header banner length for width calculation
      if (cell.row <= 2) return;
      const cellValue = cell.value !== null && cell.value !== undefined ? cell.value.toString() : "";
      if (cellValue.length > maxLength) {
        maxLength = Math.min(cellValue.length + 4, 45);
      }
    });
    column.width = maxLength;
  });
}

/**
 * Exports comprehensive, professional analytical report for Admin Statistics in Excel format (.xlsx).
 */
export async function exportAdminStatisticsExcel(allStatistics, selectedView = "Days") {
  if (!allStatistics) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ThaiSeva Admin Portal";
  workbook.lastModifiedBy = "ThaiSeva Admin Portal";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Extract statistics properties
  const dates = allStatistics.date || [];
  const totals = allStatistics.totals || {};
  const reportingWindow = allStatistics.reportingWindow || {};
  const totalsByType = allStatistics.totalsByType || {};
  const serviceBreakdown = allStatistics.serviceBreakdown || [];

  const totalRevenue = Number(totals.totalRevenue) || 0;
  const averagePerDay = Number(totals.averagePerDay) || 0;
  const averagePerPeriod = Number(totals.averagePerPeriod) || 0;
  const dayCount = reportingWindow.dayCount || dates.length || 1;
  const periodCount = reportingWindow.periodCount || dates.length || 1;
  const fromLabel = reportingWindow.fromLabel || "N/A";
  const toLabel = reportingWindow.toLabel || "N/A";

  // Calculate Peak & Lowest Period Metrics
  let peakPeriod = { label: "N/A", amount: 0, index: -1 };
  let lowestPeriod = { label: "N/A", amount: Infinity, index: -1 };
  const periodTotals = allStatistics.Total || [];

  periodTotals.forEach((val, idx) => {
    const num = Number(val) || 0;
    if (num > peakPeriod.amount) {
      peakPeriod = { label: dates[idx] || `Period ${idx + 1}`, amount: num, index: idx };
    }
    if (num < lowestPeriod.amount) {
      lowestPeriod = { label: dates[idx] || `Period ${idx + 1}`, amount: num, index: idx };
    }
  });

  if (lowestPeriod.amount === Infinity) {
    lowestPeriod = { label: "N/A", amount: 0, index: -1 };
  }

  // Currency & Number Formats
  const CURRENCY_FORMAT = '"฿"#,##0.00';
  const PERCENT_FORMAT = '0.0%';
  const NUMBER_FORMAT = '#,##0';

  // =========================================================================
  // SHEET 1: EXECUTIVE ANALYTICS SUMMARY
  // =========================================================================
  const summarySheet = workbook.addWorksheet("Executive Analytics", {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  summarySheet.mergeCells("A1:F1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = "THAI SEVA - EXECUTIVE REVENUE & ANALYTICAL REPORT";
  titleCell.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.getRow(1).height = 34;

  // Subtitle Banner
  summarySheet.mergeCells("A2:F2");
  const subTitleCell = summarySheet.getCell("A2");
  subTitleCell.value = `Comprehensive Financial Performance Analysis (${fromLabel} - ${toLabel})`;
  subTitleCell.font = { name: "Segoe UI", size: 11, italic: true, color: { argb: "E0F2FE" } };
  subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
  subTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.getRow(2).height = 22;

  // Blank row
  summarySheet.getRow(3).height = 12;

  // Metadata Box
  summarySheet.mergeCells("A4:F4");
  const metaHeader = summarySheet.getCell("A4");
  metaHeader.value = "1. REPORT PARAMETERS & OVERVIEW";
  metaHeader.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "0F766E" } };
  metaHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  summarySheet.getRow(4).height = 24;

  const metadataRows = [
    ["Report Generated On", new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" }), "Granularity View", selectedView],
    ["Reporting Window", `${fromLabel} to ${toLabel}`, "Total Days Analyzed", dayCount],
    ["Active Periods", `${periodCount} ${selectedView.toLowerCase()}`, "Currency Unit", "Thai Baht (THB / ฿)"],
  ];

  metadataRows.forEach((rowData, idx) => {
    const rowNum = 5 + idx;
    const r = summarySheet.getRow(rowNum);
    r.height = 20;

    r.getCell(1).value = rowData[0];
    r.getCell(1).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "475569" } };
    r.getCell(2).value = rowData[1];
    r.getCell(2).font = { name: "Segoe UI", size: 10, color: { argb: "0F172A" } };

    r.getCell(4).value = rowData[2];
    r.getCell(4).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "475569" } };
    r.getCell(5).value = rowData[3];
    r.getCell(5).font = { name: "Segoe UI", size: 10, color: { argb: "0F172A" } };
  });

  // Blank row
  summarySheet.getRow(8).height = 14;

  // KPI Section Header
  summarySheet.mergeCells("A9:F9");
  const kpiHeader = summarySheet.getCell("A9");
  kpiHeader.value = "2. KEY FINANCIAL PERFORMANCE INDICATORS (KPIs)";
  kpiHeader.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
  kpiHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  summarySheet.getRow(9).height = 24;

  // KPI Table Header Row
  const kpiTableRow = summarySheet.getRow(10);
  kpiTableRow.values = ["KPI Metric Description", "Metric Value", "Unit / Format", "Analytical Definition & Benchmark"];
  styleHeaderRow(kpiTableRow, "1E293B", "FFFFFF", 24);

  const kpis = [
    ["Total Cumulative Revenue", totalRevenue, CURRENCY_FORMAT, "Gross revenue generated across all categories"],
    [`Average Revenue per ${selectedView === "Days" ? "Day" : "Month"}`, averagePerPeriod, CURRENCY_FORMAT, `Mean earnings per ${selectedView.toLowerCase().slice(0, -1)}`],
    ["Average Daily Revenue", averagePerDay, CURRENCY_FORMAT, "Normalized daily earnings rate across date window"],
    ["Peak Revenue Period", peakPeriod.amount, CURRENCY_FORMAT, `Highest earning single period (${peakPeriod.label})`],
    ["Lowest Revenue Period", lowestPeriod.amount, CURRENCY_FORMAT, `Lowest earning single period (${lowestPeriod.label})`],
  ];

  kpis.forEach((kpi, idx) => {
    const rowNum = 11 + idx;
    const r = summarySheet.getRow(rowNum);
    r.height = 22;

    r.getCell(1).value = kpi[0];
    r.getCell(1).font = { name: "Segoe UI", size: 10, bold: true };
    r.getCell(2).value = kpi[1];
    r.getCell(2).numFmt = kpi[2];
    r.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F766E" } };
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = "THB (฿)";
    r.getCell(3).alignment = { horizontal: "center" };
    r.getCell(3).font = { name: "Segoe UI", size: 9, color: { argb: "64748B" } };
    r.getCell(4).value = kpi[3];
    r.getCell(4).font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "475569" } };

    // Zebra striping
    if (idx % 2 === 1) {
      for (let c = 1; c <= 4; c++) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    }
  });

  // Blank row
  const breakdownStartRow = 17;
  summarySheet.getRow(breakdownStartRow - 1).height = 14;

  // Service Breakdown Section Header
  summarySheet.mergeCells(`A${breakdownStartRow}:F${breakdownStartRow}`);
  const serviceHeader = summarySheet.getCell(`A${breakdownStartRow}`);
  serviceHeader.value = "3. SERVICE CATEGORY REVENUE & CONTRIBUTION BREAKDOWN";
  serviceHeader.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
  serviceHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  summarySheet.getRow(breakdownStartRow).height = 24;

  // Breakdown Table Headers
  const catHeaderRow = summarySheet.getRow(breakdownStartRow + 1);
  catHeaderRow.values = ["Rank", "Service Category Name", "Total Revenue (THB)", "Revenue Share (%)", "Daily Avg (THB)", "Performance Status"];
  styleHeaderRow(catHeaderRow, "1E293B", "FFFFFF", 24);

  serviceBreakdown.forEach((item, idx) => {
    const rowNum = breakdownStartRow + 2 + idx;
    const r = summarySheet.getRow(rowNum);
    r.height = 22;

    const shareDecimal = totalRevenue > 0 ? (item.total / totalRevenue) : 0;
    const dailyAvg = dayCount > 0 ? item.total / dayCount : 0;

    let status = "Moderate Contribution";
    if (shareDecimal >= 0.35) status = "Top Earning Core Service";
    else if (shareDecimal >= 0.15) status = "Strong Secondary Contributor";
    else if (shareDecimal > 0) status = "Emerging Category";
    else status = "No Revenue Logged";

    r.getCell(1).value = `#${idx + 1}`;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(1).font = { name: "Segoe UI", size: 10, bold: true };

    r.getCell(2).value = item.label;
    r.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };

    r.getCell(3).value = item.total;
    r.getCell(3).numFmt = CURRENCY_FORMAT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(3).font = { name: "Segoe UI", size: 10, bold: true };

    r.getCell(4).value = shareDecimal;
    r.getCell(4).numFmt = PERCENT_FORMAT;
    r.getCell(4).alignment = { horizontal: "right" };

    r.getCell(5).value = dailyAvg;
    r.getCell(5).numFmt = CURRENCY_FORMAT;
    r.getCell(5).alignment = { horizontal: "right" };

    r.getCell(6).value = status;
    r.getCell(6).font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "0F766E" } };

    if (idx % 2 === 1) {
      for (let c = 1; c <= 6; c++) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    }
  });

  // Total Summary Row
  const totalRowIndex = breakdownStartRow + 2 + serviceBreakdown.length;
  const totRow = summarySheet.getRow(totalRowIndex);
  totRow.height = 25;

  totRow.getCell(1).value = "TOTAL";
  totRow.getCell(1).alignment = { horizontal: "center" };
  totRow.getCell(2).value = "All Active Service Categories";

  totRow.getCell(3).value = { formula: `SUM(C${breakdownStartRow + 2}:C${totalRowIndex - 1})` };
  totRow.getCell(3).numFmt = CURRENCY_FORMAT;
  totRow.getCell(3).alignment = { horizontal: "right" };

  totRow.getCell(4).value = { formula: `SUM(D${breakdownStartRow + 2}:D${totalRowIndex - 1})` };
  totRow.getCell(4).numFmt = PERCENT_FORMAT;
  totRow.getCell(4).alignment = { horizontal: "right" };

  totRow.getCell(5).value = { formula: `SUM(E${breakdownStartRow + 2}:E${totalRowIndex - 1})` };
  totRow.getCell(5).numFmt = CURRENCY_FORMAT;
  totRow.getCell(5).alignment = { horizontal: "right" };

  totRow.getCell(6).value = "100% Comprehensive Coverage";

  totRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
    cell.border = {
      top: { style: "thin", color: { argb: "D97706" } },
      bottom: { style: "double", color: { argb: "D97706" } },
    };
  });

  // Insights / Executive Commentary Section
  const insightsStartRow = totalRowIndex + 2;
  summarySheet.mergeCells(`A${insightsStartRow}:F${insightsStartRow}`);
  const insightHeader = summarySheet.getCell(`A${insightsStartRow}`);
  insightHeader.value = "4. EXECUTIVE ANALYTICAL COMMENTARY & OBSERVATIONS";
  insightHeader.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFFFFF" } };
  insightHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
  summarySheet.getRow(insightsStartRow).height = 24;

  const topService = serviceBreakdown[0] || { label: "N/A", share: 0, total: 0 };
  const top2Share = serviceBreakdown.slice(0, 2).reduce((acc, curr) => acc + (curr.total || 0), 0) / (totalRevenue || 1);

  const commentary = [
    `• Revenue Concentration: The top-performing category "${topService.label}" generated ${formatTHBText(topService.total)} (${topService.share.toFixed(1)}% of total revenue).`,
    `• Multi-Service Synergy: Top 2 categories combined account for ${(top2Share * 100).toFixed(1)}% of total platform earnings in this window.`,
    `• Peak Volatility: The single highest earning period was recorded on ${peakPeriod.label} with a total of ${formatTHBText(peakPeriod.amount)}.`,
    `• Period Average: The platform maintained an average earning rate of ${formatTHBText(averagePerPeriod)} per ${selectedView.toLowerCase().slice(0, -1)}.`,
  ];

  commentary.forEach((text, idx) => {
    const rowNum = insightsStartRow + 1 + idx;
    const r = summarySheet.getRow(rowNum);
    r.height = 20;
    summarySheet.mergeCells(`A${rowNum}:F${rowNum}`);
    const c = r.getCell(1);
    c.value = text;
    c.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "334155" } };
    c.alignment = { vertical: "middle", horizontal: "left" };
  });

  autoFitColumns(summarySheet, 16);

  // =========================================================================
  // SHEET 2: PERIOD-BY-PERIOD REVENUE BREAKDOWN
  // =========================================================================
  const detailSheet = workbook.addWorksheet("Period Breakdown", {
    views: [{ showGridLines: true }],
  });

  // Sheet 2 Title
  detailSheet.mergeCells("A1:J1");
  const dTitleCell = detailSheet.getCell("A1");
  dTitleCell.value = `PERIODIC REVENUE & TREND ANALYSIS (${selectedView.toUpperCase()})`;
  dTitleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  dTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  dTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  detailSheet.getRow(1).height = 32;

  // Header Row
  const dHeaderRow = detailSheet.getRow(3);
  dHeaderRow.values = [
    "#",
    `Date / Period (${selectedView})`,
    "Car Bookings (THB)",
    "Self Drive (THB)",
    "Sightseeing (THB)",
    "Hotels (THB)",
    "Total Revenue (THB)",
    "Period Variance (THB)",
    "PoP Growth (%)",
    "Top Category",
  ];
  styleHeaderRow(dHeaderRow, "1E293B", "FFFFFF", 25);

  const carsData = allStatistics.Cars || [];
  const selfDriveData = allStatistics.SelfDrive || [];
  const sightseeingData = allStatistics.Sightseeing || [];
  const hotelsData = allStatistics.Hotels || [];

  dates.forEach((dateLabel, idx) => {
    const rowNum = 4 + idx;
    const r = detailSheet.getRow(rowNum);
    r.height = 21;

    const carRev = Number(carsData[idx]) || 0;
    const selfRev = Number(selfDriveData[idx]) || 0;
    const sightRev = Number(sightseeingData[idx]) || 0;
    const hotelRev = Number(hotelsData[idx]) || 0;
    const totRev = Number(periodTotals[idx]) || 0;

    const prevTotRev = idx > 0 ? (Number(periodTotals[idx - 1]) || 0) : 0;
    const variance = idx > 0 ? totRev - prevTotRev : 0;
    const growthPercent = (idx > 0 && prevTotRev > 0) ? (variance / prevTotRev) : 0;

    // Find top contributor for this period
    const periodCategories = [
      { name: "Cars", val: carRev },
      { name: "Self Drive", val: selfRev },
      { name: "Sightseeing", val: sightRev },
      { name: "Hotels", val: hotelRev },
    ].sort((a, b) => b.val - a.val);

    const topCat = periodCategories[0].val > 0 ? periodCategories[0].name : "None";

    r.getCell(1).value = idx + 1;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(1).font = { name: "Segoe UI", size: 10, color: { argb: "64748B" } };

    r.getCell(2).value = dateLabel;
    r.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };

    r.getCell(3).value = carRev;
    r.getCell(3).numFmt = CURRENCY_FORMAT;
    r.getCell(3).alignment = { horizontal: "right" };

    r.getCell(4).value = selfRev;
    r.getCell(4).numFmt = CURRENCY_FORMAT;
    r.getCell(4).alignment = { horizontal: "right" };

    r.getCell(5).value = sightRev;
    r.getCell(5).numFmt = CURRENCY_FORMAT;
    r.getCell(5).alignment = { horizontal: "right" };

    r.getCell(6).value = hotelRev;
    r.getCell(6).numFmt = CURRENCY_FORMAT;
    r.getCell(6).alignment = { horizontal: "right" };

    r.getCell(7).value = totRev;
    r.getCell(7).numFmt = CURRENCY_FORMAT;
    r.getCell(7).alignment = { horizontal: "right" };
    r.getCell(7).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F766E" } };

    r.getCell(8).value = idx === 0 ? "-" : variance;
    if (idx > 0) r.getCell(8).numFmt = CURRENCY_FORMAT;
    r.getCell(8).alignment = { horizontal: "right" };
    if (variance > 0) r.getCell(8).font = { color: { argb: "16A34A" } };
    else if (variance < 0) r.getCell(8).font = { color: { argb: "DC2626" } };

    r.getCell(9).value = idx === 0 ? "-" : growthPercent;
    if (idx > 0) r.getCell(9).numFmt = PERCENT_FORMAT;
    r.getCell(9).alignment = { horizontal: "right" };
    if (growthPercent > 0) r.getCell(9).font = { color: { argb: "16A34A" } };
    else if (growthPercent < 0) r.getCell(9).font = { color: { argb: "DC2626" } };

    r.getCell(10).value = topCat;
    r.getCell(10).alignment = { horizontal: "center" };
    r.getCell(10).font = { name: "Segoe UI", size: 9, italic: true };

    if (idx % 2 === 1) {
      for (let c = 1; c <= 10; c++) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    }
  });

  // Total Summary Row for Sheet 2
  const dTotalRowIndex = 4 + dates.length;
  const dTotRow = detailSheet.getRow(dTotalRowIndex);
  dTotRow.height = 25;

  dTotRow.getCell(1).value = "TOTAL";
  dTotRow.getCell(1).alignment = { horizontal: "center" };
  dTotRow.getCell(2).value = `Sum across ${dates.length} periods`;

  for (let col = 3; col <= 7; col++) {
    const colLetter = String.fromCharCode(64 + col);
    dTotRow.getCell(col).value = { formula: `SUM(${colLetter}4:${colLetter}${dTotalRowIndex - 1})` };
    dTotRow.getCell(col).numFmt = CURRENCY_FORMAT;
    dTotRow.getCell(col).alignment = { horizontal: "right" };
  }

  dTotRow.getCell(8).value = "-";
  dTotRow.getCell(8).alignment = { horizontal: "center" };
  dTotRow.getCell(9).value = "-";
  dTotRow.getCell(9).alignment = { horizontal: "center" };
  dTotRow.getCell(10).value = "Full Window";
  dTotRow.getCell(10).alignment = { horizontal: "center" };

  dTotRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E0F2FE" } };
    cell.border = {
      top: { style: "medium", color: { argb: "0284C7" } },
      bottom: { style: "double", color: { argb: "0284C7" } },
    };
  });

  // Average Row for Sheet 2
  const dAvgRowIndex = dTotalRowIndex + 1;
  const dAvgRow = detailSheet.getRow(dAvgRowIndex);
  dAvgRow.height = 22;

  dAvgRow.getCell(1).value = "AVERAGE";
  dAvgRow.getCell(1).alignment = { horizontal: "center" };
  dAvgRow.getCell(2).value = `Mean per period`;

  for (let col = 3; col <= 7; col++) {
    const colLetter = String.fromCharCode(64 + col);
    dAvgRow.getCell(col).value = { formula: `AVERAGE(${colLetter}4:${colLetter}${dTotalRowIndex - 1})` };
    dAvgRow.getCell(col).numFmt = CURRENCY_FORMAT;
    dAvgRow.getCell(col).alignment = { horizontal: "right" };
  }

  dAvgRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 9.5, italic: true, bold: true, color: { argb: "475569" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
  });

  autoFitColumns(detailSheet, 15);

  // =========================================================================
  // SHEET 3: SERVICE MATRIX & STATISTICAL METRICS
  // =========================================================================
  const matrixSheet = workbook.addWorksheet("Service Matrix", {
    views: [{ showGridLines: true }],
  });

  matrixSheet.mergeCells("A1:G1");
  const mTitleCell = matrixSheet.getCell("A1");
  mTitleCell.value = "SERVICE CATEGORY STATISTICAL METRICS & COMPARATIVE MATRIX";
  mTitleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  mTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  mTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  matrixSheet.getRow(1).height = 32;

  const mHeaderRow = matrixSheet.getRow(3);
  mHeaderRow.values = [
    "Service Category",
    "Total Revenue (THB)",
    "Share of Total (%)",
    "Active Earning Days",
    "Active Day Ratio (%)",
    "Avg Revenue per Active Day (THB)",
    "Peak Single Day Revenue (THB)",
  ];
  styleHeaderRow(mHeaderRow, "1E293B", "FFFFFF", 25);

  const categoryMap = [
    { key: "Cars", name: "Car Bookings", series: carsData },
    { key: "SelfDrive", name: "Self Drive", series: selfDriveData },
    { key: "Sightseeing", name: "Sightseeing", series: sightseeingData },
    { key: "Hotels", name: "Hotels", series: hotelsData },
  ];

  categoryMap.forEach((cat, idx) => {
    const rowNum = 4 + idx;
    const r = matrixSheet.getRow(rowNum);
    r.height = 22;

    const catTotal = Number(totalsByType[cat.key]) || 0;
    const catShare = totalRevenue > 0 ? (catTotal / totalRevenue) : 0;
    const activeDays = cat.series.filter((val) => Number(val) > 0).length;
    const activeRatio = dayCount > 0 ? (activeDays / dayCount) : 0;
    const avgActiveDay = activeDays > 0 ? (catTotal / activeDays) : 0;
    const peakDay = cat.series.length > 0 ? Math.max(...cat.series.map(Number)) : 0;

    r.getCell(1).value = cat.name;
    r.getCell(1).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };

    r.getCell(2).value = catTotal;
    r.getCell(2).numFmt = CURRENCY_FORMAT;
    r.getCell(2).alignment = { horizontal: "right" };

    r.getCell(3).value = catShare;
    r.getCell(3).numFmt = PERCENT_FORMAT;
    r.getCell(3).alignment = { horizontal: "right" };

    r.getCell(4).value = activeDays;
    r.getCell(4).numFmt = NUMBER_FORMAT;
    r.getCell(4).alignment = { horizontal: "right" };

    r.getCell(5).value = activeRatio;
    r.getCell(5).numFmt = PERCENT_FORMAT;
    r.getCell(5).alignment = { horizontal: "right" };

    r.getCell(6).value = avgActiveDay;
    r.getCell(6).numFmt = CURRENCY_FORMAT;
    r.getCell(6).alignment = { horizontal: "right" };

    r.getCell(7).value = peakDay;
    r.getCell(7).numFmt = CURRENCY_FORMAT;
    r.getCell(7).alignment = { horizontal: "right" };

    if (idx % 2 === 1) {
      for (let c = 1; c <= 7; c++) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    }
  });

  autoFitColumns(matrixSheet, 16);

  // =========================================================================
  // SHEET 4: ALL DETAILED ORDERS & TRANSACTIONS
  // =========================================================================
  const ordersSheet = workbook.addWorksheet("All Detailed Orders", {
    views: [{ showGridLines: true }],
  });

  ordersSheet.mergeCells("A1:K1");
  const oTitleCell = ordersSheet.getCell("A1");
  oTitleCell.value = `ALL INDIVIDUAL BOOKING ORDERS & TRANSACTIONS LOG (${fromLabel} - ${toLabel})`;
  oTitleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFF" } };
  oTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F766E" } };
  oTitleCell.alignment = { vertical: "middle", horizontal: "center" };
  ordersSheet.getRow(1).height = 32;

  const oHeaderRow = ordersSheet.getRow(3);
  oHeaderRow.values = [
    "#",
    "Booking ID",
    "Category",
    "Guest Name",
    "Guest Contact",
    "Guest Email",
    "Provider / Hotel Name",
    "Booking Date / Time",
    "Service & Route Details",
    "Status",
    "Amount (THB)",
  ];
  styleHeaderRow(oHeaderRow, "1E293B", "FFFFFF", 25);

  const allOrders = allStatistics.allOrders || [];
  allOrders.forEach((order, idx) => {
    const rowNum = 4 + idx;
    const r = ordersSheet.getRow(rowNum);
    r.height = 22;

    r.getCell(1).value = idx + 1;
    r.getCell(1).alignment = { horizontal: "center" };

    r.getCell(2).value = order.bookingId || order.id || "-";
    r.getCell(2).font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "0F766E" } };

    r.getCell(3).value = order.category || "-";
    r.getCell(3).alignment = { horizontal: "center" };

    r.getCell(4).value = order.guestName || "-";
    r.getCell(4).font = { name: "Segoe UI", size: 9.5, bold: true };

    r.getCell(5).value = order.guestPhone || "-";
    r.getCell(6).value = order.guestEmail || "-";

    r.getCell(7).value = order.providerName || "-";

    r.getCell(8).value = order.bookingDate || "-";
    r.getCell(8).alignment = { horizontal: "center" };

    r.getCell(9).value = order.details || "-";

    r.getCell(10).value = order.status || "Confirmed";
    r.getCell(10).alignment = { horizontal: "center" };
    if (order.status === "Confirmed") {
      r.getCell(10).font = { color: { argb: "16A34A" }, bold: true };
    } else if (order.status === "Pending") {
      r.getCell(10).font = { color: { argb: "D97706" }, bold: true };
    } else if (order.status === "Cancelled") {
      r.getCell(10).font = { color: { argb: "DC2626" }, bold: true };
    }

    r.getCell(11).value = Number(order.amountTHB) || 0;
    r.getCell(11).numFmt = CURRENCY_FORMAT;
    r.getCell(11).alignment = { horizontal: "right" };
    r.getCell(11).font = { name: "Segoe UI", size: 10, bold: true };

    if (idx % 2 === 1) {
      for (let c = 1; c <= 11; c++) {
        r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    }
  });

  // Total Summary Row for Sheet 4
  const oTotalRowIndex = 4 + allOrders.length;
  const oTotRow = ordersSheet.getRow(oTotalRowIndex);
  oTotRow.height = 25;

  oTotRow.getCell(1).value = "TOTAL";
  oTotRow.getCell(1).alignment = { horizontal: "center" };
  oTotRow.getCell(2).value = `${allOrders.length} Total Orders`;

  for (let c = 3; c <= 10; c++) {
    oTotRow.getCell(c).value = "-";
    oTotRow.getCell(c).alignment = { horizontal: "center" };
  }

  oTotRow.getCell(11).value = { formula: `SUM(K4:K${oTotalRowIndex - 1})` };
  oTotRow.getCell(11).numFmt = CURRENCY_FORMAT;
  oTotRow.getCell(11).alignment = { horizontal: "right" };

  oTotRow.eachCell((cell) => {
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } };
    cell.border = {
      top: { style: "thin", color: { argb: "D97706" } },
      bottom: { style: "double", color: { argb: "D97706" } },
    };
  });

  autoFitColumns(ordersSheet, 15);

  // Generate Excel buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const sanitizeFilenameDate = (str) => String(str || "").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `ThaiSeva_Admin_Statistics_Report_${sanitizeFilenameDate(fromLabel)}_to_${sanitizeFilenameDate(toLabel)}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }, 500);
}
