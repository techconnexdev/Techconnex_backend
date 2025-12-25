import PDFDocument from "pdfkit";

export const createAnalyticsPDF = async (data) => {
  const doc = new PDFDocument({ 
    margin: 50,
    size: 'A4',
    bufferPages: true
  });

  // Collect PDF chunks in memory instead of writing to disk
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Colors
  const colors = {
    primary: '#2c5aa0',
    secondary: '#34495e',
    success: '#27ae60',
    warning: '#f39c12',
    danger: '#e74c3c',
    light: '#ecf0f1',
    dark: '#2c3e50',
    border: '#bdc3c7'
  };

  // Helper function to draw rounded rectangles
  const drawRoundedRect = (x, y, width, height, radius, color) => {
    doc.roundedRect(x, y, width, height, radius)
       .fill(color);
  };

  // Improved table row function with dynamic column widths
  const createTableRow = (y, columns, colWidths, isHeader = false, rowColor = null) => {
  const rowHeight = 25;

  if (rowColor && !isHeader) {
    doc.rect(50, y, doc.page.width - 100, rowHeight).fill(rowColor);
  }

  let x = 50;
  columns.forEach((text, index) => {
    // --- FIXED SPACING FOR HEADER AND BODY ---
    doc.fontSize(isHeader ? 9 : 8)
       .fillColor(isHeader ? colors.dark : colors.dark)
       .font(isHeader ? 'Helvetica-Bold' : 'Helvetica');

    doc.text(text, x + 5, y + 8, {
      width: colWidths[index] - 10,
      align: isHeader ? 'center' : 'left'
    });

    x += colWidths[index]; // Move to next column start
  });

  // Border
  doc.strokeColor(colors.border).lineWidth(0.5);
  doc.rect(50, y, doc.page.width - 100, rowHeight).stroke();

  return y + rowHeight;
};

  // ==========================
  // HEADER WITH STYLING
  // ==========================
  drawRoundedRect(0, 0, doc.page.width, 120, 0, colors.primary);
  
  doc.fontSize(24)
     .fillColor('#ffffff')
     .font('Helvetica-Bold')
     .text("Billing Analytics Report", 50, 40, { align: "center" });
  
  doc.fontSize(12)
     .fillColor('rgba(255,255,255,0.8)')
     .font('Helvetica')
     .text("Comprehensive Financial Overview", 50, 70, { align: "center" });

  // Info box
  doc.roundedRect(50, 100, doc.page.width - 100, 60, 5)
     .fill('#ffffff')
     .stroke(colors.border);
  
  doc.fontSize(9)
     .fillColor(colors.secondary)
     .font('Helvetica-Bold')
     .text("Report Details:", 65, 115);
  
  doc.font('Helvetica')
     .fillColor(colors.dark)
     .text(`Generated: ${data.generatedAt}`, 65, 130)
     .text(`User: ${data.generatedFor}`, 65, 145);

  doc.moveDown(4);

  // ==========================
  // SECTION 1 — OVERVIEW CARDS
  // ==========================
  const sectionY = 200;
  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text("1. Financial Overview", 50, sectionY)
     .moveDown(0.5);

  doc.strokeColor(colors.primary)
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(150, doc.y)
     .stroke();

  doc.moveDown(1);

  const overview = data.overview;
  const cardWidth = (doc.page.width - 120) / 2;
  const cardHeight = 70;
  let cardX = 50;
  let cardY = doc.y;

  // Card 1: Total Spent
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc.fontSize(10)
     .fillColor(colors.secondary)
     .text("Total Spent", cardX + 15, cardY + 15);
  doc.fontSize(14)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(overview.totalSpent, cardX + 15, cardY + 35);

  // Card 2: This Month
  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc.fontSize(10)
     .fillColor(colors.secondary)
     .font('Helvetica')
     .text("This Month", cardX + 15, cardY + 15);
  doc.fontSize(14)
     .fillColor(colors.success)
     .font('Helvetica-Bold')
     .text(overview.thisMonthSpent, cardX + 15, cardY + 35);

  // Second row of cards
  cardX = 50;
  cardY += cardHeight + 15;

  // Card 3: Pending
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc.fontSize(10)
     .fillColor(colors.secondary)
     .text("Pending Payments", cardX + 15, cardY + 15);
  doc.fontSize(14)
     .fillColor(colors.warning)
     .font('Helvetica-Bold')
     .text(overview.pendingPayments, cardX + 15, cardY + 35);

  // Card 4: Average
  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc.fontSize(10)
     .fillColor(colors.secondary)
     .text("Avg Transaction", cardX + 15, cardY + 15);
  doc.fontSize(14)
     .fillColor(colors.dark)
     .font('Helvetica-Bold')
     .text(overview.averageTransaction, cardX + 15, cardY + 35);

  doc.y = cardY + cardHeight + 30;

  // ==========================
  // SECTION 2 — TRANSACTIONS TABLE
  // ==========================
  if (doc.y > 600) {
    doc.addPage();
    doc.y = 50;
  }

  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text("2. Recent Transactions", 50, doc.y)
     .moveDown(0.5);

  doc.strokeColor(colors.primary)
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(180, doc.y)
     .stroke();

  doc.moveDown(1);

  if (!data.transactions.length) {
    doc.fontSize(10)
       .fillColor(colors.secondary)
       .text("No transactions found.", 50, doc.y);
    doc.moveDown(2);
  } else {
    const transactionColWidths = [40, 100, 180, 100, 80];
    let currentY = createTableRow(doc.y, ['#', 'Amount', 'Project', 'Date', 'Status'], transactionColWidths, true, colors.primary);
    
    data.transactions.forEach((t, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(currentY, ['#', 'Amount', 'Project', 'Date', 'Status'], transactionColWidths, true, colors.primary);
      }
      
      const rowColor = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      const status = t.status || 'Completed';
      
      currentY = createTableRow(currentY, [
        i + 1,
        t.amount,
        t.project?.title || 'N/A',
        new Date(t.createdAt).toLocaleDateString(),
        status
      ], transactionColWidths, false, rowColor);
    });
    
    doc.y = currentY + 10;
  }

  // ==========================
  // SECTION 3 — UPCOMING PAYMENTS (REDESIGNED)
  // ==========================
  // Check if we need a new page - only add if we're running out of space
  if (doc.y > 400) { // More conservative check to avoid empty pages
    doc.addPage();
    doc.y = 50;
  }

  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text("3. Upcoming Payments", 50, doc.y)
     .moveDown(0.5);

  doc.strokeColor(colors.primary)
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(190, doc.y)
     .stroke();

  doc.moveDown(1);

  if (!data.upcoming.length) {
    doc.fontSize(10)
       .fillColor(colors.secondary)
       .text("No upcoming payments.", 50, doc.y);
    doc.moveDown(2);
  } else {
    // Use a table format for upcoming payments for better consistency
    const upcomingColWidthsHeader = [20, 150, 100, 120, 60];
    const upcomingColWidths = [70, 120, 100, 120, 60];
    let currentY = createTableRow(doc.y, ['#', 'Project', 'Status', 'Next Milestone', 'Amount'], upcomingColWidthsHeader, true, colors.primary);
    
    data.upcoming.forEach((proj, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(currentY, ['#', 'Project', 'Status', 'Next Milestone', 'Amount'], upcomingColWidthsHeader, true, colors.primary);
      }
      
      const rowColor = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
      
      // Find the next pending milestone
      const nextMilestone = proj.milestones?.find(m => m.status === 'pending') || 
                           proj.milestones?.[0] || 
                           { title: 'No milestones', amount: 'N/A' };
      
      currentY = createTableRow(currentY, [
        i + 1,
        proj.title,
        proj.status,
        nextMilestone.title || 'Next milestone',
        nextMilestone.amount || 'N/A'
      ], upcomingColWidths, false, rowColor);
    });
    
    doc.y = currentY + 10;

    // Add a summary of total upcoming payments
    const totalUpcoming = data.upcoming.reduce((sum, proj) => {
      const pendingMilestones = proj.milestones?.filter(m => m.status === 'pending') || [];
      const projectTotal = pendingMilestones.reduce((projectSum, milestone) => {
        return projectSum + (parseFloat(milestone.amount?.replace(/[^0-9.-]+/g, "")) || 0);
      }, 0);
      return sum + projectTotal;
    }, 0);

    if (totalUpcoming > 0) {
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }
      
      doc.rect(50, doc.y, doc.page.width - 100, 30)
         .fill(colors.light)
         .stroke(colors.border);
      
      doc.fontSize(10)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(`Total Upcoming: $${totalUpcoming.toFixed(2)}`, 65, doc.y + 10);
      
      doc.y += 40;
    }
  }

  // ==========================
  // FOOTER (Only add if we have content)
  // ==========================
//   const pageCount = doc.bufferedPageRange().count;
  
//   // Only add footer if we have actual pages with content
//   if (pageCount > 0) {
//     for (let i = 0; i < pageCount; i++) {
//       doc.switchToPage(i);
      
//       // Footer
//       doc.fontSize(8)
//          .fillColor(colors.secondary)
//          .text(
//            `Page ${i + 1} of ${pageCount} • Generated by TechConnect • ${new Date().toLocaleDateString()}`,
//            50,
//            doc.page.height - 30,
//            { align: "center", opacity: 0.6 }
//          );
//     }
//   }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    doc.on('error', reject);
  });
};