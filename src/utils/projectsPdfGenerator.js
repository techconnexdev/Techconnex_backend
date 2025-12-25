import PDFDocument from "pdfkit";

// Helper function to draw page border
function drawPageBorder(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const borderWidth = 2;
  const margin = 30;

  // Draw border rectangle
  doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2))
     .lineWidth(borderWidth)
     .strokeColor("#1E40AF")
     .stroke();
}

// Helper function to draw header with background
function drawHeader(doc, title, color = "#1E40AF") {
  const pageWidth = doc.page.width;
  const margin = 30;
  const headerHeight = 60;
  const startY = margin;

  // Draw header background
  doc.rect(margin, startY, pageWidth - (margin * 2), headerHeight)
     .fillColor(color)
     .fill();

  // Draw title
  doc.fillColor("#FFFFFF")
     .fontSize(22)
     .font("Helvetica-Bold")
     .text(title, margin + 20, startY + 15, {
       width: pageWidth - (margin * 2) - 40,
       align: "center"
     });

  // Draw generation date
  doc.fillColor("#E0E7FF")
     .fontSize(10)
     .font("Helvetica")
     .text(`Generated: ${new Date().toLocaleString("en-MY")}`, margin + 20, startY + 40, {
       width: pageWidth - (margin * 2) - 40,
       align: "center"
     });

  return startY + headerHeight + 15;
}

// Helper function to draw stats box
function drawStatsBox(doc, stats, startY, color = "#1E40AF") {
  const pageWidth = doc.page.width;
  const margin = 30;
  const boxHeight = 70;
  const contentWidth = pageWidth - (margin * 2) - 40;

  // Draw stats box background
  doc.rect(margin + 20, startY, contentWidth, boxHeight)
     .fillColor("#F3F4F6")
     .fill()
     .strokeColor("#E5E7EB")
     .lineWidth(1)
     .stroke();

  // Stats title
  doc.fillColor("#111827")
     .fontSize(12)
     .font("Helvetica-Bold")
     .text("Summary Statistics", margin + 30, startY + 10);

  // Draw stats in grid
  const statsY = startY + 30;
  const statsColWidth = contentWidth / 5;
  let xPos = margin + 30;

  // Total Projects
  doc.fillColor(color)
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.total.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Total", xPos, statsY + 20);

  // Active
  xPos += statsColWidth;
  doc.fillColor("#3B82F6")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.active.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Active", xPos, statsY + 20);

  // Completed
  xPos += statsColWidth;
  doc.fillColor("#10B981")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.completed.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Completed", xPos, statsY + 20);

  // Pending
  xPos += statsColWidth;
  doc.fillColor("#F59E0B")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.pending.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Pending", xPos, statsY + 20);

  // Disputed
  xPos += statsColWidth;
  doc.fillColor("#EF4444")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.disputed.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Disputed", xPos, statsY + 20);

  return startY + boxHeight + 15;
}

// Helper function to draw project card
function drawProjectCard(doc, project, index, startY) {
  const pageWidth = doc.page.width;
  const margin = 30;
  const contentWidth = pageWidth - (margin * 2) - 40;
  const cardHeight = 90;
  const cardY = startY;

  // Draw card background
  doc.rect(margin + 20, cardY, contentWidth, cardHeight)
     .fillColor("#FFFFFF")
     .fill()
     .strokeColor("#E5E7EB")
     .lineWidth(1)
     .stroke();

  // Project number and title
  doc.fillColor("#1E40AF")
     .fontSize(12)
     .font("Helvetica-Bold")
     .text(`${index + 1}. ${project.title || "Untitled Project"}`, margin + 30, cardY + 10, {
       width: contentWidth - 100
     });

  // Status badge
  const status = project.status || "N/A";
  const statusColors = {
    "IN_PROGRESS": "#3B82F6",
    "COMPLETED": "#10B981",
    "OPEN": "#F59E0B",
    "DISPUTED": "#EF4444"
  };
  const statusColor = statusColors[status] || "#6B7280";
  
  doc.fillColor(statusColor)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text(status.replace("_", " "), margin + 20 + contentWidth - 70, cardY + 10, {
       width: 60,
       align: "right"
     });

  // Project details (two columns)
  const detailsY = cardY + 30;
  let detailX = margin + 30;
  let detailY = detailsY;

  doc.fillColor("#4B5563")
     .fontSize(9)
     .font("Helvetica");

  // Left column
  doc.text(`Category: ${project.category || "N/A"}`, detailX, detailY);
  detailY += 12;

  if (project.approvedPrice) {
    doc.text(`Approved Price: RM ${project.approvedPrice.toLocaleString()}`, detailX, detailY);
  } else if (project.budgetMin && project.budgetMax) {
    doc.text(`Budget: RM ${project.budgetMin.toLocaleString()} - RM ${project.budgetMax.toLocaleString()}`, detailX, detailY);
  }
  detailY += 12;

  if (project.progress !== undefined && project.progress !== null) {
    doc.text(`Progress: ${project.progress}%`, detailX, detailY);
  }

  // Right column
  detailX = margin + 30 + (contentWidth / 2);
  detailY = detailsY;

  if (project.provider?.name) {
    doc.text(`Provider: ${project.provider.name}`, detailX, detailY);
    detailY += 12;
  }

  if (project.createdAt) {
    doc.text(`Created: ${new Date(project.createdAt).toLocaleDateString("en-MY")}`, detailX, detailY);
    detailY += 12;
  }

  if (project.milestones && project.milestones.length > 0) {
    const completed = project.milestones.filter(
      (m) => m.status === "APPROVED" || m.status === "PAID"
    ).length;
    doc.text(`Milestones: ${completed}/${project.milestones.length}`, detailX, detailY);
  }

  return cardY + cardHeight + 10;
}

// Helper function to draw footer
function drawFooter(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 30;

  doc.fillColor("#9CA3AF")
     .fontSize(8)
     .font("Helvetica")
     .text(
       "This report was generated by TechConnect Platform. All data is based on actual platform records.",
       margin + 20,
       pageHeight - margin - 15,
       {
         width: pageWidth - (margin * 2) - 40,
         align: "center"
       }
     );
}

/**
 * Generate PDF for customer projects
 */
export function generateCustomerProjectsPDF(projects, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 0, 
        size: "A4",
        info: {
          Title: "Customer Projects Report",
          Author: "TechConnect Platform",
          Subject: "Projects Export"
        }
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Draw page border
      drawPageBorder(doc);

      // Draw header
      let currentY = drawHeader(doc, "Customer Projects Report", "#1E40AF");

      // Filters applied
      if (filters.search || filters.status) {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(9)
           .font("Helvetica-Oblique");
        const filterText = [];
        if (filters.search) filterText.push(`Search: "${filters.search}"`);
        if (filters.status && filters.status !== "all")
          filterText.push(`Status: ${filters.status}`);
        if (filterText.length > 0) {
          doc.text(`Filters Applied: ${filterText.join(" | ")}`, margin + 20, currentY, {
            width: pageWidth - (margin * 2) - 40,
            align: "center"
          });
          currentY += 15;
        }
      }

      // Summary Stats
      const stats = {
        total: projects.length,
        active: projects.filter((p) => p.status === "IN_PROGRESS").length,
        completed: projects.filter((p) => p.status === "COMPLETED").length,
        pending: projects.filter((p) => p.status === "OPEN" || p.type === "ServiceRequest").length,
        disputed: projects.filter((p) => p.status === "DISPUTED").length,
      };

      currentY = drawStatsBox(doc, stats, currentY, "#1E40AF");

      // Projects List
      if (projects.length > 0) {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const margin = 30;

        doc.fillColor("#111827")
           .fontSize(14)
           .font("Helvetica-Bold")
           .text("Projects Details", margin + 20, currentY);
        currentY += 25;

        projects.forEach((project, index) => {
          // Check if we need a new page
          if (currentY > pageHeight - margin - 100) {
            doc.addPage();
            drawPageBorder(doc);
            drawFooter(doc);
            currentY = margin + 20;
          }

          currentY = drawProjectCard(doc, project, index, currentY);
        });
      } else {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(11)
           .font("Helvetica")
           .text("No projects found matching the current filters.", margin + 20, currentY, {
             width: pageWidth - (margin * 2) - 40,
             align: "center"
           });
      }

      // Draw footer
      drawFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to draw request card
function drawRequestCard(doc, request, index, startY) {
  const pageWidth = doc.page.width;
  const margin = 30;
  const contentWidth = pageWidth - (margin * 2) - 40;
  const cardHeight = 85;
  const cardY = startY;

  // Draw card background
  doc.rect(margin + 20, cardY, contentWidth, cardHeight)
     .fillColor("#FFFFFF")
     .fill()
     .strokeColor("#E5E7EB")
     .lineWidth(1)
     .stroke();

  // Request number and title
  doc.fillColor("#7C3AED")
     .fontSize(12)
     .font("Helvetica-Bold")
     .text(`${index + 1}. ${request.projectTitle || "Untitled Project"}`, margin + 30, cardY + 10, {
       width: contentWidth - 100
     });

  // Status badge
  const status = request.status || "N/A";
  const statusColors = {
    "PENDING": "#F59E0B",
    "ACCEPTED": "#10B981",
    "REJECTED": "#EF4444"
  };
  const statusColor = statusColors[status.toUpperCase()] || "#6B7280";
  
  doc.fillColor(statusColor)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text(status.replace("_", " "), margin + 20 + contentWidth - 70, cardY + 10, {
       width: 60,
       align: "right"
     });

  // Request details (two columns)
  const detailsY = cardY + 30;
  let detailX = margin + 30;
  let detailY = detailsY;

  doc.fillColor("#4B5563")
     .fontSize(9)
     .font("Helvetica");

  // Left column
  doc.text(`Provider: ${request.providerName || "N/A"}`, detailX, detailY);
  detailY += 12;
  doc.text(`Bid Amount: RM ${(request.bidAmount || 0).toLocaleString()}`, detailX, detailY);
  detailY += 12;

  if (request.providerRating) {
    doc.text(`Rating: ${request.providerRating.toFixed(1)}/5.0`, detailX, detailY);
  }

  // Right column
  detailX = margin + 30 + (contentWidth / 2);
  detailY = detailsY;

  if (request.submittedAt) {
    doc.text(`Submitted: ${new Date(request.submittedAt).toLocaleDateString("en-MY")}`, detailX, detailY);
    detailY += 12;
  }

  if (request.milestones && request.milestones.length > 0) {
    doc.text(`Milestones: ${request.milestones.length}`, detailX, detailY);
  }

  return cardY + cardHeight + 10;
}

/**
 * Generate PDF for customer project requests (proposals)
 */
export function generateCustomerRequestsPDF(requests, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 0, 
        size: "A4",
        info: {
          Title: "Provider Requests Report",
          Author: "TechConnect Platform",
          Subject: "Requests Export"
        }
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Draw page border
      drawPageBorder(doc);

      // Draw header
      let currentY = drawHeader(doc, "Provider Requests Report", "#7C3AED");

      // Filters applied
      if (filters.search || filters.status || filters.project) {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(9)
           .font("Helvetica-Oblique");
        const filterText = [];
        if (filters.search) filterText.push(`Search: "${filters.search}"`);
        if (filters.status && filters.status !== "all")
          filterText.push(`Status: ${filters.status}`);
        if (filters.project && filters.project !== "all")
          filterText.push(`Project: ${filters.project}`);
        if (filterText.length > 0) {
          doc.text(`Filters Applied: ${filterText.join(" | ")}`, margin + 20, currentY, {
            width: pageWidth - (margin * 2) - 40,
            align: "center"
          });
          currentY += 15;
        }
      }

      // Summary Stats
      const stats = {
        total: requests.length,
        pending: requests.filter((r) => (r.status || "").toUpperCase() === "PENDING").length,
        accepted: requests.filter((r) => (r.status || "").toUpperCase() === "ACCEPTED").length,
        rejected: requests.filter((r) => (r.status || "").toUpperCase() === "REJECTED").length,
      };

      // Custom stats box for requests (4 columns instead of 5)
      const pageWidth = doc.page.width;
      const margin = 30;
      const boxHeight = 70;
      const contentWidth = pageWidth - (margin * 2) - 40;

      // Draw stats box background
      doc.rect(margin + 20, currentY, contentWidth, boxHeight)
         .fillColor("#F3F4F6")
         .fill()
         .strokeColor("#E5E7EB")
         .lineWidth(1)
         .stroke();

      // Stats title
      doc.fillColor("#111827")
         .fontSize(12)
         .font("Helvetica-Bold")
         .text("Summary Statistics", margin + 30, currentY + 10);

      // Draw stats in grid
      const statsY = currentY + 30;
      const statsColWidth = contentWidth / 4;
      let xPos = margin + 30;

      // Total
      doc.fillColor("#7C3AED")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.total.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Total", xPos, statsY + 20);

      // Pending
      xPos += statsColWidth;
      doc.fillColor("#F59E0B")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.pending.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Pending", xPos, statsY + 20);

      // Accepted
      xPos += statsColWidth;
      doc.fillColor("#10B981")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.accepted.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Accepted", xPos, statsY + 20);

      // Rejected
      xPos += statsColWidth;
      doc.fillColor("#EF4444")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.rejected.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Rejected", xPos, statsY + 20);

      currentY += boxHeight + 15;

      // Requests List
      if (requests.length > 0) {
        const pageHeight = doc.page.height;

        doc.fillColor("#111827")
           .fontSize(14)
           .font("Helvetica-Bold")
           .text("Provider Requests Details", margin + 20, currentY);
        currentY += 25;

        requests.forEach((request, index) => {
          // Check if we need a new page
          if (currentY > pageHeight - margin - 100) {
            doc.addPage();
            drawPageBorder(doc);
            drawFooter(doc);
            currentY = margin + 20;
          }

          currentY = drawRequestCard(doc, request, index, currentY);
        });
      } else {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(11)
           .font("Helvetica")
           .text("No requests found matching the current filters.", margin + 20, currentY, {
             width: pageWidth - (margin * 2) - 40,
             align: "center"
           });
      }

      // Draw footer
      drawFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF for provider projects
 */
export function generateProviderProjectsPDF(projects, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        margin: 0, 
        size: "A4",
        info: {
          Title: "Provider Projects Report",
          Author: "TechConnect Platform",
          Subject: "Projects Export"
        }
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Draw page border
      drawPageBorder(doc);

      // Draw header
      let currentY = drawHeader(doc, "Provider Projects Report", "#059669");

      // Filters applied
      if (filters.search || filters.status) {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(9)
           .font("Helvetica-Oblique");
        const filterText = [];
        if (filters.search) filterText.push(`Search: "${filters.search}"`);
        if (filters.status && filters.status !== "all")
          filterText.push(`Status: ${filters.status}`);
        if (filterText.length > 0) {
          doc.text(`Filters Applied: ${filterText.join(" | ")}`, margin + 20, currentY, {
            width: pageWidth - (margin * 2) - 40,
            align: "center"
          });
          currentY += 15;
        }
      }

      // Summary Stats
      const stats = {
        total: projects.length,
        active: projects.filter((p) => p.status === "IN_PROGRESS").length,
        completed: projects.filter((p) => p.status === "COMPLETED").length,
        disputed: projects.filter((p) => p.status === "DISPUTED").length,
      };

      // Custom stats box for provider (4 columns instead of 5)
      const pageWidth = doc.page.width;
      const margin = 30;
      const boxHeight = 70;
      const contentWidth = pageWidth - (margin * 2) - 40;

      // Draw stats box background
      doc.rect(margin + 20, currentY, contentWidth, boxHeight)
         .fillColor("#F3F4F6")
         .fill()
         .strokeColor("#E5E7EB")
         .lineWidth(1)
         .stroke();

      // Stats title
      doc.fillColor("#111827")
         .fontSize(12)
         .font("Helvetica-Bold")
         .text("Summary Statistics", margin + 30, currentY + 10);

      // Draw stats in grid
      const statsY = currentY + 30;
      const statsColWidth = contentWidth / 4;
      let xPos = margin + 30;

      // Total
      doc.fillColor("#059669")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.total.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Total", xPos, statsY + 20);

      // Active
      xPos += statsColWidth;
      doc.fillColor("#3B82F6")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.active.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Active", xPos, statsY + 20);

      // Completed
      xPos += statsColWidth;
      doc.fillColor("#10B981")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.completed.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Completed", xPos, statsY + 20);

      // Disputed
      xPos += statsColWidth;
      doc.fillColor("#EF4444")
         .fontSize(18)
         .font("Helvetica-Bold")
         .text(stats.disputed.toString(), xPos, statsY);
      doc.fillColor("#6B7280")
         .fontSize(9)
         .font("Helvetica")
         .text("Disputed", xPos, statsY + 20);

      currentY += boxHeight + 15;

      // Projects List
      if (projects.length > 0) {
        const pageHeight = doc.page.height;

        doc.fillColor("#111827")
           .fontSize(14)
           .font("Helvetica-Bold")
           .text("Projects Details", margin + 20, currentY);
        currentY += 25;

        projects.forEach((project, index) => {
          // Check if we need a new page
          if (currentY > pageHeight - margin - 100) {
            doc.addPage();
            drawPageBorder(doc);
            drawFooter(doc);
            currentY = margin + 20;
          }

          // Use provider-specific project card
          const cardY = currentY;
          const contentWidth = doc.page.width - (margin * 2) - 40;
          const cardHeight = 95;

          // Draw card background
          doc.rect(margin + 20, cardY, contentWidth, cardHeight)
             .fillColor("#FFFFFF")
             .fill()
             .strokeColor("#E5E7EB")
             .lineWidth(1)
             .stroke();

          // Project number and title
          doc.fillColor("#059669")
             .fontSize(12)
             .font("Helvetica-Bold")
             .text(`${index + 1}. ${project.title || "Untitled Project"}`, margin + 30, cardY + 10, {
               width: contentWidth - 100
             });

          // Status badge
          const status = project.status || "N/A";
          const statusColors = {
            "IN_PROGRESS": "#3B82F6",
            "COMPLETED": "#10B981",
            "DISPUTED": "#EF4444"
          };
          const statusColor = statusColors[status] || "#6B7280";
          
          doc.fillColor(statusColor)
             .fontSize(9)
             .font("Helvetica-Bold")
             .text(status.replace("_", " "), margin + 20 + contentWidth - 70, cardY + 10, {
               width: 60,
               align: "right"
             });

          // Project details (two columns)
          const detailsY = cardY + 30;
          let detailX = margin + 30;
          let detailY = detailsY;

          doc.fillColor("#4B5563")
             .fontSize(9)
             .font("Helvetica");

          // Left column
          doc.text(`Category: ${project.category || "N/A"}`, detailX, detailY);
          detailY += 12;

          if (project.approvedPrice) {
            doc.text(`Approved Price: RM ${project.approvedPrice.toLocaleString()}`, detailX, detailY);
            detailY += 12;
          }

          if (project.progress !== undefined && project.progress !== null) {
            doc.text(`Progress: ${project.progress}%`, detailX, detailY);
          }

          // Right column
          detailX = margin + 30 + (contentWidth / 2);
          detailY = detailsY;

          if (project.customer?.name) {
            doc.text(`Client: ${project.customer.name}`, detailX, detailY);
            detailY += 12;
          }

          if (project.milestones && project.milestones.length > 0) {
            const completed = project.milestones.filter(
              (m) => m.status === "APPROVED" || m.status === "PAID"
            ).length;
            doc.text(`Milestones: ${completed}/${project.milestones.length}`, detailX, detailY);
            detailY += 12;
          }

          if (project.createdAt) {
            doc.text(`Created: ${new Date(project.createdAt).toLocaleDateString("en-MY")}`, detailX, detailY);
          }

          currentY = cardY + cardHeight + 10;
        });
      } else {
        const pageWidth = doc.page.width;
        const margin = 30;
        doc.fillColor("#6B7280")
           .fontSize(11)
           .font("Helvetica")
           .text("No projects found matching the current filters.", margin + 20, currentY, {
             width: pageWidth - (margin * 2) - 40,
             align: "center"
           });
      }

      // Draw footer
      drawFooter(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

