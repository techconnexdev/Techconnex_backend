import PDFDocument from "pdfkit";

// Helper function to draw page border
function drawPageBorder(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const borderWidth = 2;
  const margin = 30;

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

  doc.rect(margin, startY, pageWidth - (margin * 2), headerHeight)
     .fillColor(color)
     .fill();

  doc.fillColor("#FFFFFF")
     .fontSize(22)
     .font("Helvetica-Bold")
     .text(title, margin + 20, startY + 15, {
       width: pageWidth - (margin * 2) - 40,
       align: "center"
     });

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

  doc.rect(margin + 20, startY, contentWidth, boxHeight)
     .fillColor("#F3F4F6")
     .fill()
     .strokeColor("#E5E7EB")
     .lineWidth(1)
     .stroke();

  doc.fillColor("#111827")
     .fontSize(12)
     .font("Helvetica-Bold")
     .text("Summary Statistics", margin + 30, startY + 10);

  const statsY = startY + 30;
  const statsColWidth = contentWidth / 5;
  let xPos = margin + 30;

  // Total Users
  doc.fillColor(color)
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.totalUsers.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Total", xPos, statsY + 20);

  // Active
  xPos += statsColWidth;
  doc.fillColor("#3B82F6")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.activeUsers.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Active", xPos, statsY + 20);

  // Suspended
  xPos += statsColWidth;
  doc.fillColor("#EF4444")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text((stats.suspendedUsers || 0).toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Suspended", xPos, statsY + 20);

  // Providers
  xPos += statsColWidth;
  doc.fillColor("#8B5CF6")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.providers.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Providers", xPos, statsY + 20);

  // Customers
  xPos += statsColWidth;
  doc.fillColor("#10B981")
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(stats.customers.toString(), xPos, statsY);
  doc.fillColor("#6B7280")
     .fontSize(9)
     .font("Helvetica")
     .text("Customers", xPos, statsY + 20);

  return startY + boxHeight + 20;
}

export function generateAdminUsersPDF(users, filters = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Calculate stats
      const stats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === "ACTIVE").length,
        suspendedUsers: users.filter(u => u.status === "SUSPENDED").length,
        providers: users.filter(u => Array.isArray(u.role) && u.role.includes("PROVIDER")).length,
        customers: users.filter(u => Array.isArray(u.role) && u.role.includes("CUSTOMER")).length,
      };

      // Draw page border
      drawPageBorder(doc);

      // Draw header
      let currentY = drawHeader(doc, "User Management Report", "#1E40AF");

      // Draw stats box
      currentY = drawStatsBox(doc, stats, currentY);

      // Filters info
      if (filters.search || filters.role || filters.status) {
        doc.fillColor("#6B7280")
           .fontSize(10)
           .font("Helvetica")
           .text("Filters Applied:", 50, currentY);
        currentY += 15;

        const filterTexts = [];
        if (filters.search) filterTexts.push(`Search: ${filters.search}`);
        if (filters.role && filters.role !== "all") filterTexts.push(`Role: ${filters.role}`);
        if (filters.status && filters.status !== "all") filterTexts.push(`Status: ${filters.status}`);

        doc.fillColor("#374151")
           .fontSize(9)
           .text(filterTexts.join(" • "), 50, currentY);
        currentY += 25;
      }

      // Table header
      const tableTop = currentY;
      const rowHeight = 25;
      const pageWidthForTable = doc.page.width;
      const marginForTable = 30;
      const tableStartX = marginForTable + 20; // Start 20px inside the border
      const tableWidth = pageWidthForTable - (marginForTable * 2) - 40; // Full width minus margins and padding
      
      const colWidths = {
        name: Math.floor(tableWidth * 0.25), // 25% of table width
        email: Math.floor(tableWidth * 0.30), // 30% of table width
        role: Math.floor(tableWidth * 0.20), // 20% of table width
        status: Math.floor(tableWidth * 0.15), // 15% of table width
        joined: Math.floor(tableWidth * 0.10), // 10% of table width
      };

      // Draw table header background
      doc.rect(tableStartX, tableTop, tableWidth, rowHeight)
         .fillColor("#1E40AF")
         .fill();

      // Table header text
      doc.fillColor("#FFFFFF")
         .fontSize(10)
         .font("Helvetica-Bold");

      let xPos = tableStartX + 5;
      doc.text("Name", xPos, tableTop + 8, { width: colWidths.name - 10 });
      xPos += colWidths.name;
      doc.text("Email", xPos, tableTop + 8, { width: colWidths.email - 10 });
      xPos += colWidths.email;
      doc.text("Role", xPos, tableTop + 8, { width: colWidths.role - 10 });
      xPos += colWidths.role;
      doc.text("Status", xPos, tableTop + 8, { width: colWidths.status - 10 });
      xPos += colWidths.status;
      doc.text("Joined", xPos, tableTop + 8, { width: colWidths.joined - 10 });

      // Draw users
      let yPos = tableTop + rowHeight;
      doc.fontSize(9).font("Helvetica");

      users.forEach((user, index) => {
        // Check if we need a new page (leave room for footer)
        const pageHeight = doc.page.height;
        const margin = 30;
        const footerHeight = 20;
        if (yPos + rowHeight > pageHeight - margin - footerHeight - 10) {
          // Draw footer on current page before adding new page
          const footerY = pageHeight - margin - 15;
          doc.fillColor("#9CA3AF")
             .fontSize(8)
             .font("Helvetica")
             .text(
               `Total Users: ${users.length} | Generated by TechConnex Admin Panel`,
               margin + 20,
               footerY,
               { 
                 align: "center", 
                 width: doc.page.width - (margin * 2) - 40 
               }
             );
          
          doc.addPage();
          drawPageBorder(doc);
          yPos = margin + 20;

          // Redraw header on new page
          doc.rect(tableStartX, yPos, tableWidth, rowHeight)
             .fillColor("#1E40AF")
             .fill();

          doc.fillColor("#FFFFFF")
             .fontSize(10)
             .font("Helvetica-Bold");

          xPos = tableStartX + 5;
          doc.text("Name", xPos, yPos + 8, { width: colWidths.name - 10 });
          xPos += colWidths.name;
          doc.text("Email", xPos, yPos + 8, { width: colWidths.email - 10 });
          xPos += colWidths.email;
          doc.text("Role", xPos, yPos + 8, { width: colWidths.role - 10 });
          xPos += colWidths.role;
          doc.text("Status", xPos, yPos + 8, { width: colWidths.status - 10 });
          xPos += colWidths.status;
          doc.text("Joined", xPos, yPos + 8, { width: colWidths.joined - 10 });

          yPos += rowHeight;
        }

        // Alternate row background
        if (index % 2 === 0) {
          doc.rect(tableStartX, yPos, tableWidth, rowHeight)
             .fillColor("#F9FAFB")
             .fill();
        }

        // Draw row border
        doc.rect(tableStartX, yPos, tableWidth, rowHeight)
           .strokeColor("#E5E7EB")
           .lineWidth(0.5)
           .stroke();

        // User data
        doc.fillColor("#111827");

        xPos = tableStartX + 5;
        const userName = (user.name || "N/A").substring(0, 30);
        doc.text(userName, xPos, yPos + 8, { width: colWidths.name - 10, ellipsis: true });

        xPos += colWidths.name;
        const userEmail = (user.email || "N/A").substring(0, 35);
        doc.text(userEmail, xPos, yPos + 8, { width: colWidths.email - 10, ellipsis: true });

        xPos += colWidths.email;
        const userRole = Array.isArray(user.role) 
          ? (user.role.includes("PROVIDER") ? "Provider" : user.role.includes("CUSTOMER") ? "Customer" : user.role.includes("ADMIN") ? "Admin" : user.role[0] || "N/A")
          : "N/A";
        doc.text(userRole, xPos, yPos + 8, { width: colWidths.role - 10, ellipsis: true });

        xPos += colWidths.role;
        const userStatus = (user.status || "ACTIVE").substring(0, 10);
        doc.text(userStatus, xPos, yPos + 8, { width: colWidths.status - 10, ellipsis: true });

        xPos += colWidths.status;
        // Format date as DD/MM/YY to prevent wrapping
        let joinedDate = "N/A";
        if (user.createdAt) {
          const date = new Date(user.createdAt);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = String(date.getFullYear()).slice(-2); // Last 2 digits of year
          joinedDate = `${day}/${month}/${year}`;
        }
        doc.text(joinedDate, xPos, yPos + 8, { width: colWidths.joined - 10, ellipsis: true });

        yPos += rowHeight;
      });

      // Footer - inside the border
      const pageWidthForFooter = doc.page.width;
      const pageHeightForFooter = doc.page.height;
      const marginForFooter = 30;
      const footerY = pageHeightForFooter - marginForFooter - 15;
      
      doc.fillColor("#9CA3AF")
         .fontSize(8)
         .font("Helvetica")
         .text(
           `Total Users: ${users.length} | Generated by TechConnex Admin Panel`,
           marginForFooter + 20,
           footerY,
           { 
             align: "center", 
             width: pageWidthForFooter - (marginForFooter * 2) - 40 
           }
         );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

