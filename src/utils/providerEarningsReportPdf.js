import PDFDocument from "pdfkit";

export const createProviderEarningsPDF = async (data) => {
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
  });

  // Collect PDF chunks in memory instead of writing to disk
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  // Colors
  const colors = {
    primary: "#2c5aa0",
    secondary: "#34495e",
    success: "#27ae60",
    warning: "#f39c12",
    danger: "#e74c3c",
    light: "#ecf0f1",
    dark: "#2c3e50",
    border: "#bdc3c7",
  };

  // Helper function to draw rounded rectangles
  const drawRoundedRect = (x, y, width, height, radius, color) => {
    doc.roundedRect(x, y, width, height, radius).fill(color);
  };

  // Improved table row function with dynamic column widths
  const createTableRow = (
    y,
    columns,
    colWidths,
    isHeader = false,
    rowColor = null
  ) => {
    const rowHeight = 25;

    if (rowColor && !isHeader) {
      doc.rect(50, y, doc.page.width - 100, rowHeight).fill(rowColor);
    }

    let x = 50;
    columns.forEach((text, index) => {
      doc
        .fontSize(isHeader ? 9 : 8)
        .fillColor(isHeader ? colors.dark : colors.dark)
        .font(isHeader ? "Helvetica-Bold" : "Helvetica");

      doc.text(String(text), x + 5, y + 8, {
        width: colWidths[index] - 10,
        align: isHeader ? "center" : "left",
      });

      x += colWidths[index];
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

  doc
    .fontSize(24)
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .text("Earnings Analytics Report", 50, 40, { align: "center" });

  doc
    .fontSize(12)
    .fillColor("rgba(255,255,255,0.8)")
    .font("Helvetica")
    .text("Comprehensive Earnings Overview", 50, 70, { align: "center" });

  // Info box
  doc
    .roundedRect(50, 100, doc.page.width - 100, 60, 5)
    .fill("#ffffff")
    .stroke(colors.border);

  doc
    .fontSize(9)
    .fillColor(colors.secondary)
    .font("Helvetica-Bold")
    .text("Report Details:", 65, 115);

  doc
    .font("Helvetica")
    .fillColor(colors.dark)
    .text(`Generated: ${data.generatedAt}`, 65, 130)
    .text(`Provider: ${data.generatedFor}`, 65, 145);

  doc.moveDown(4);

  // ==========================
  // SECTION 1 — EARNINGS OVERVIEW CARDS
  // ==========================
  const sectionY = 200;
  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("1. Earnings Overview", 50, sectionY)
    .moveDown(0.5);

  doc
    .strokeColor(colors.primary)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(180, doc.y)
    .stroke();

  doc.moveDown(1);

  const earningsData = data.earningsData;
  const cardWidth = (doc.page.width - 120) / 2;
  const cardHeight = 70;
  let cardX = 50;
  let cardY = doc.y;

  // Card 1: Total Earnings
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Total Earnings", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(
      `RM ${earningsData.totalEarnings.toLocaleString()}`,
      cardX + 15,
      cardY + 35
    );

  // Card 2: This Month
  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .font("Helvetica")
    .text("This Month", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      `RM ${earningsData.thisMonth.toLocaleString()}`,
      cardX + 15,
      cardY + 35
    );

  // Second row of cards
  cardX = 50;
  cardY += cardHeight + 15;

  // Card 3: Available Balance
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Available Balance", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(
      `RM ${earningsData.availableBalance.toLocaleString()}`,
      cardX + 15,
      cardY + 35
    );

  // Card 4: Pending Payments
  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Pending Payments", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.warning)
    .font("Helvetica-Bold")
    .text(
      `RM ${earningsData.pendingPayments.toLocaleString()}`,
      cardX + 15,
      cardY + 35
    );

  // Third row of cards
  cardX = 50;
  cardY += cardHeight + 15;

  // Card 5: Monthly Growth
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Monthly Growth", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(earningsData.monthlyGrowth >= 0 ? colors.success : colors.danger)
    .font("Helvetica-Bold")
    .text(
      `${
        earningsData.monthlyGrowth >= 0 ? "+" : ""
      }${earningsData.monthlyGrowth.toFixed(2)}%`,
      cardX + 15,
      cardY + 35
    );

  // Card 6: Average Project Value
  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Avg Project Value", cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.dark)
    .font("Helvetica-Bold")
    .text(
      `RM ${earningsData.averageProjectValue.toLocaleString()}`,
      cardX + 15,
      cardY + 35
    );

  doc.y = cardY + cardHeight + 30;

  // ==========================
  // SECTION 2 — RECENT PAYMENTS TABLE
  // ==========================
  if (doc.y > 600) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("2. Recent Payments", 50, doc.y)
    .moveDown(0.5);

  doc
    .strokeColor(colors.primary)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(180, doc.y)
    .stroke();

  doc.moveDown(1);

  if (!data.recentPayments || data.recentPayments.length === 0) {
    doc
      .fontSize(10)
      .fillColor(colors.secondary)
      .text("No recent payments found.", 50, doc.y);
    doc.moveDown(2);
  } else {
    // Adjusted column widths: #, Project, Client, Amount, Date, Status
    // Total page width: 595, margins: 50 each side = 495 available
    // Distribution: 30 + 150 + 130 + 85 + 75 + 25 = 495
    const paymentColWidths = [30, 150, 130, 85, 75, 25];
    let currentY = createTableRow(
      doc.y,
      ["#", "Project", "Client", "Amount", "Date", "Status"],
      paymentColWidths,
      true,
      colors.primary
    );

    data.recentPayments.forEach((payment, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          ["#", "Project", "Client", "Amount", "Date", "Status"],
          paymentColWidths,
          true,
          colors.primary
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const status = payment.status || "N/A";
      const amount =
        typeof payment.amount === "number"
          ? `RM ${payment.amount.toLocaleString()}`
          : payment.amount || "N/A";
      const date = payment.date
        ? new Date(payment.date).toLocaleDateString()
        : "N/A";

      // Truncate long project names and client IDs if needed
      const project = (payment.project || "N/A").substring(0, 40);
      const client = (payment.client || "N/A").substring(0, 25);

      currentY = createTableRow(
        currentY,
        [i + 1, project, client, amount, date, status],
        paymentColWidths,
        false,
        rowColor
      );
    });

    doc.y = currentY + 10;
  }

  // ==========================
  // SECTION 3 — MONTHLY EARNINGS
  // ==========================
  if (doc.y > 500) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("3. Monthly Earnings (Last 12 Months)", 50, doc.y)
    .moveDown(0.5);

  doc
    .strokeColor(colors.primary)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(250, doc.y)
    .stroke();

  doc.moveDown(1);

  if (!data.monthlyEarnings || data.monthlyEarnings.length === 0) {
    doc
      .fontSize(10)
      .fillColor(colors.secondary)
      .text("No monthly earnings data.", 50, doc.y);
    doc.moveDown(2);
  } else {
    const monthlyColWidths = [100, 150, 100, 150];
    let currentY = createTableRow(
      doc.y,
      ["Month", "Amount", "Projects", "Avg per Project"],
      monthlyColWidths,
      true,
      colors.primary
    );

    data.monthlyEarnings.forEach((earning, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          ["Month", "Amount", "Projects", "Avg per Project"],
          monthlyColWidths,
          true,
          colors.primary
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const amount =
        typeof earning.amount === "number"
          ? `RM ${earning.amount.toLocaleString()}`
          : earning.amount || "RM 0";
      const projects = earning.projects || 0;
      const avgPerProject =
        projects > 0 && typeof earning.amount === "number"
          ? `RM ${(earning.amount / projects).toFixed(2)}`
          : "RM 0";

      currentY = createTableRow(
        currentY,
        [earning.month || "N/A", amount, projects, avgPerProject],
        monthlyColWidths,
        false,
        rowColor
      );
    });

    doc.y = currentY + 10;
  }

  // ==========================
  // SECTION 4 — TOP CLIENTS
  // ==========================
  if (doc.y > 500) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("4. Top Clients", 50, doc.y)
    .moveDown(0.5);

  doc
    .strokeColor(colors.primary)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(150, doc.y)
    .stroke();

  doc.moveDown(1);

  if (!data.topClients || data.topClients.length === 0) {
    doc
      .fontSize(10)
      .fillColor(colors.secondary)
      .text("No client data available.", 50, doc.y);
    doc.moveDown(2);
  } else {
    const clientColWidths = [40, 200, 150, 100];
    let currentY = createTableRow(
      doc.y,
      ["#", "Client ID", "Total Paid", "Projects"],
      clientColWidths,
      true,
      colors.primary
    );

    data.topClients.forEach((client, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          ["#", "Client ID", "Total Paid", "Projects"],
          clientColWidths,
          true,
          colors.primary
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const totalPaid =
        typeof client.totalPaid === "number"
          ? `RM ${client.totalPaid.toLocaleString()}`
          : client.totalPaid || "RM 0";

      currentY = createTableRow(
        currentY,
        [i + 1, client.clientId || "N/A", totalPaid, client.projects || 0],
        clientColWidths,
        false,
        rowColor
      );
    });

    doc.y = currentY + 10;
  }

  // ==========================
  // SECTION 5 — QUICK STATS
  // ==========================
  if (doc.y > 600) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("5. Performance Statistics", 50, doc.y)
    .moveDown(0.5);

  doc
    .strokeColor(colors.primary)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(220, doc.y)
    .stroke();

  doc.moveDown(1);

  const quickStats = data.quickStats || {};
  const statsCardWidth = (doc.page.width - 120) / 2;
  const statsCardHeight = 60;
  let statsCardX = 50;
  let statsCardY = doc.y;

  // Stat 1: Projects This Month
  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Projects This Month", statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      String(quickStats.projectsThisMonth || 0),
      statsCardX + 15,
      statsCardY + 35
    );

  // Stat 2: Success Rate
  statsCardX += statsCardWidth + 20;
  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Success Rate", statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(
      `${(quickStats.successRate || 0).toFixed(1)}%`,
      statsCardX + 15,
      statsCardY + 35
    );

  // Second row
  statsCardX = 50;
  statsCardY += statsCardHeight + 15;

  // Stat 3: Repeat Clients
  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text("Repeat Clients", statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      `${(quickStats.repeatClientsPercent || 0).toFixed(1)}%`,
      statsCardX + 15,
      statsCardY + 35
    );

  doc.y = statsCardY + statsCardHeight + 30;

  // ==========================
  // FOOTER
  // ==========================
  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    doc.on("error", reject);
  });
};
