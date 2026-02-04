/**
 * Export utilities for Competition Day data
 */

interface QueueItem {
  id: string;
  sequenceNo: number;
  eventCode: string;
  status: "PLANNED" | "RUN" | "SKIPPED";
  attemptNo: number;
  notes?: string;
  totalTimeSeconds?: number | null;
  penaltySeconds?: number | null;
  splitTimes?: Record<string, number> | null;
  competitorTimes?: Array<{
    teamName: string;
    ran: boolean;
    totalTimeSeconds?: number | null;
    penaltySeconds?: number | null;
    splitTimes?: Record<string, number> | null;
  }>;
}

interface CompetitionDayData {
  id: string;
  date: string;
  challengeName: string;
  locationName: string;
  trackName?: string;
  notes?: string;
  teams?: string[];
  queueItems: QueueItem[];
}

/**
 * Export competition day data to CSV
 */
export function exportToCSV(data: CompetitionDayData): void {
  const rows: string[][] = [];
  
  // Header row
  rows.push([
    "Sequence",
    "Event Code",
    "Attempt",
    "Status",
    "Total Time (s)",
    "Penalty (s)",
    "Clean Time (s)",
    "Notes",
  ]);

  // Data rows
  data.queueItems.forEach((item) => {
    const cleanTime = item.totalTimeSeconds && item.penaltySeconds
      ? (item.totalTimeSeconds - item.penaltySeconds).toFixed(2)
      : "";
    
    rows.push([
      item.sequenceNo.toString(),
      item.eventCode,
      item.attemptNo > 1 ? `Attempt ${item.attemptNo}` : "1",
      item.status,
      item.totalTimeSeconds?.toFixed(2) || "",
      item.penaltySeconds?.toFixed(2) || "",
      cleanTime,
      item.notes || "",
    ]);
  });

  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const cellStr = String(cell || "");
      if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(",")
  ).join("\n");

  // Add BOM for Excel compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.challengeName.replace(/[^a-z0-9]/gi, "_")}_${data.date}_queue.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export competition day data to PDF (using browser print)
 */
export function exportToPDF(data: CompetitionDayData): void {
  // Create a print-optimized HTML document
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate PDF");
    return;
  }

  const cleanTime = (item: QueueItem) => {
    if (item.totalTimeSeconds && item.penaltySeconds) {
      return (item.totalTimeSeconds - item.penaltySeconds).toFixed(2);
    }
    return "";
  };

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, "0")}`;
  };

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${data.challengeName} - ${data.date}</title>
      <style>
        @media print {
          @page { margin: 1cm; }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          margin: 20px;
          color: #000;
        }
        .header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .header-info {
          margin-top: 10px;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .status-PLANNED { background-color: #fff; }
        .status-RUN { background-color: #d4edda; }
        .status-SKIPPED { background-color: #e9ecef; }
        .footer {
          margin-top: 30px;
          font-size: 10px;
          color: #666;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.challengeName}</h1>
        <div class="header-info">
          <strong>Date:</strong> ${data.date}<br>
          <strong>Location:</strong> ${data.locationName}${data.trackName ? ` - ${data.trackName}` : ""}
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Seq</th>
            <th>Event</th>
            <th>Attempt</th>
            <th>Status</th>
            <th>Total Time</th>
            <th>Penalty</th>
            <th>Clean Time</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${data.queueItems.map(item => `
            <tr class="status-${item.status}">
              <td>${item.sequenceNo}</td>
              <td>${item.eventCode}</td>
              <td>${item.attemptNo > 1 ? `Attempt ${item.attemptNo}` : "1"}</td>
              <td>${item.status}</td>
              <td>${formatTime(item.totalTimeSeconds)}</td>
              <td>${formatTime(item.penaltySeconds)}</td>
              <td>${formatTime(item.totalTimeSeconds && item.penaltySeconds ? item.totalTimeSeconds - item.penaltySeconds : null)}</td>
              <td>${item.notes || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      
      <div class="footer">
        Generated on ${new Date().toLocaleString()}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Generate a shareable link for view-only access
 * Note: This creates a URL that can be shared. In production, you'd want
 * to create a proper view-only route with authentication.
 */
export function generateShareableLink(competitionDayId: string): string {
  const baseUrl = window.location.origin;
  // In production, this would be a special view-only route like:
  // return `${baseUrl}/app/competition-days/${competitionDayId}/view?token=${viewToken}`;
  // For now, just return the regular link (which requires auth)
  return `${baseUrl}/app/competition-days/${competitionDayId}`;
}

/**
 * Copy shareable link to clipboard
 */
export async function copyShareableLink(competitionDayId: string): Promise<boolean> {
  try {
    const link = generateShareableLink(competitionDayId);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (err) {
    console.error("Failed to copy link:", err);
    return false;
  }
}
