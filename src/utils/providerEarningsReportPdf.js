import PDFDocument from "pdfkit";
import {
  formatReportMoney,
  formatReportDate,
  formatReportDateTime,
  formatReportMonthYear,
  providerPdfT,
  normalizeReportLocale,
  formatProviderPaymentStatus,
  intlLocaleForReport,
} from "./reportPdfI18n.js";

export const createProviderEarningsPDF = async (data) => {
  const locale = normalizeReportLocale(data.locale);
  // Numeric aggregates from getEarningsOverview use earningsData.preferredCurrency.
  const currency = String(
    data.earningsData?.preferredCurrency ||
      data.displayCurrency ||
      "MYR",
  ).toUpperCase();
  const t = (key) => providerPdfT(locale, key);
  const fmt = (amount) => formatReportMoney(amount, currency, locale);

  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    bufferPages: true,
  });

  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));

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

  const drawRoundedRect = (x, y, width, height, radius, color) => {
    doc.roundedRect(x, y, width, height, radius).fill(color);
  };

  const createTableRow = (
    y,
    columns,
    colWidths,
    isHeader = false,
    rowColor = null,
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

    doc.strokeColor(colors.border).lineWidth(0.5);
    doc.rect(50, y, doc.page.width - 100, rowHeight).stroke();

    return y + rowHeight;
  };

  const generated =
    data.generatedAt instanceof Date
      ? data.generatedAt
      : data.generatedAt
        ? new Date(data.generatedAt)
        : new Date();

  drawRoundedRect(0, 0, doc.page.width, 120, 0, colors.primary);

  doc
    .fontSize(24)
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .text(t("title"), 50, 40, { align: "center" });

  doc
    .fontSize(12)
    .fillColor("rgba(255,255,255,0.8)")
    .font("Helvetica")
    .text(t("subtitle"), 50, 70, { align: "center" });

  doc
    .roundedRect(50, 100, doc.page.width - 100, 60, 5)
    .fill("#ffffff")
    .stroke(colors.border);

  doc
    .fontSize(9)
    .fillColor(colors.secondary)
    .font("Helvetica-Bold")
    .text(t("reportDetails"), 65, 115);

  doc
    .font("Helvetica")
    .fillColor(colors.dark)
    .text(`${t("generated")} ${formatReportDateTime(generated, locale)}`, 65, 130)
    .text(`${t("roleLabel")} ${data.generatedFor}`, 65, 145);

  doc.moveDown(4);

  const sectionY = 200;
  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(t("s1"), 50, sectionY)
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

  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("totalEarnings"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(fmt(earningsData.totalEarnings), cardX + 15, cardY + 35);

  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .font("Helvetica")
    .text(t("thisMonth"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(fmt(earningsData.thisMonth), cardX + 15, cardY + 35);

  cardX = 50;
  cardY += cardHeight + 15;

  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("availableBalance"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(fmt(earningsData.availableBalance), cardX + 15, cardY + 35);

  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("pendingPayments"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.warning)
    .font("Helvetica-Bold")
    .text(fmt(earningsData.pendingPayments), cardX + 15, cardY + 35);

  cardX = 50;
  cardY += cardHeight + 15;

  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("monthlyGrowth"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(
      earningsData.monthlyGrowth >= 0 ? colors.success : colors.danger,
    )
    .font("Helvetica-Bold")
    .text(
      `${earningsData.monthlyGrowth >= 0 ? "+" : ""}${new Intl.NumberFormat(
        intlLocaleForReport(locale),
        { maximumFractionDigits: 2 },
      ).format(earningsData.monthlyGrowth)}%`,
      cardX + 15,
      cardY + 35,
    );

  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("avgProjectValue"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.dark)
    .font("Helvetica-Bold")
    .text(fmt(earningsData.averageProjectValue), cardX + 15, cardY + 35);

  doc.y = cardY + cardHeight + 30;

  if (doc.y > 600) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(t("s2"), 50, doc.y)
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
      .text(t("noRecent"), 50, doc.y);
    doc.moveDown(2);
  } else {
    const paymentColWidths = [28, 135, 115, 95, 72, 50];
    const headerCols = [
      t("colNum"),
      t("colProject"),
      t("colClient"),
      t("colAmount"),
      t("colDate"),
      t("colStatus"),
    ];
    let currentY = createTableRow(
      doc.y,
      headerCols,
      paymentColWidths,
      true,
      colors.primary,
    );

    data.recentPayments.forEach((payment, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          headerCols,
          paymentColWidths,
          true,
          colors.primary,
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const statusLabel = formatProviderPaymentStatus(payment.status, locale);
      const pref =
        payment.preferredAmount != null && payment.preferredAmount !== ""
          ? Number(payment.preferredAmount)
          : null;
      const amountStr =
        pref != null && Number.isFinite(pref)
          ? fmt(pref)
          : fmt(payment.amount);
      const date = payment.date
        ? formatReportDate(payment.date, locale)
        : t("na");

      const project = (payment.project || t("na")).substring(0, 40);
      const client = (payment.client || t("na")).substring(0, 25);

      currentY = createTableRow(
        currentY,
        [i + 1, project, client, amountStr, date, statusLabel],
        paymentColWidths,
        false,
        rowColor,
      );
    });

    doc.y = currentY + 10;
  }

  if (doc.y > 500) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(t("s3"), 50, doc.y)
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
      .text(t("noMonthly"), 50, doc.y);
    doc.moveDown(2);
  } else {
    const monthlyColWidths = [100, 150, 100, 150];
    const monthHeader = [
      t("colMonth"),
      t("colAmount"),
      t("colProjects"),
      t("colAvgPerProject"),
    ];
    let currentY = createTableRow(
      doc.y,
      monthHeader,
      monthlyColWidths,
      true,
      colors.primary,
    );

    data.monthlyEarnings.forEach((earning, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          monthHeader,
          monthlyColWidths,
          true,
          colors.primary,
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const monthLabel =
        earning.monthStartIso != null
          ? formatReportMonthYear(earning.monthStartIso, locale)
          : earning.month || t("na");
      const amount =
        typeof earning.amount === "number"
          ? fmt(earning.amount)
          : fmt(0);
      const projects = earning.projects || 0;
      const avgPerProject =
        projects > 0 && typeof earning.amount === "number"
          ? fmt(earning.amount / projects)
          : fmt(0);

      currentY = createTableRow(
        currentY,
        [monthLabel, amount, projects, avgPerProject],
        monthlyColWidths,
        false,
        rowColor,
      );
    });

    doc.y = currentY + 10;
  }

  if (doc.y > 500) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(t("s4"), 50, doc.y)
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
      .text(t("noClients"), 50, doc.y);
    doc.moveDown(2);
  } else {
    const clientColWidths = [40, 200, 150, 100];
    const topHeader = [
      t("colNum"),
      t("colClientId"),
      t("colTotalPaid"),
      t("colProjects"),
    ];
    let currentY = createTableRow(
      doc.y,
      topHeader,
      clientColWidths,
      true,
      colors.primary,
    );

    data.topClients.forEach((client, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          topHeader,
          clientColWidths,
          true,
          colors.primary,
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const totalPaid =
        typeof client.totalPaid === "number"
          ? fmt(client.totalPaid)
          : fmt(0);

      currentY = createTableRow(
        currentY,
        [i + 1, client.clientId || t("na"), totalPaid, client.projects || 0],
        clientColWidths,
        false,
        rowColor,
      );
    });

    doc.y = currentY + 10;
  }

  if (doc.y > 600) {
    doc.addPage();
    doc.y = 50;
  }

  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(t("s5"), 50, doc.y)
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

  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light,
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("projectsThisMonth"), statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      String(quickStats.projectsThisMonth || 0),
      statsCardX + 15,
      statsCardY + 35,
    );

  statsCardX += statsCardWidth + 20;
  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light,
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("successRate"), statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(
      `${new Intl.NumberFormat(intlLocaleForReport(locale), {
        maximumFractionDigits: 1,
      }).format(quickStats.successRate || 0)}%`,
      statsCardX + 15,
      statsCardY + 35,
    );

  statsCardX = 50;
  statsCardY += statsCardHeight + 15;

  drawRoundedRect(
    statsCardX,
    statsCardY,
    statsCardWidth,
    statsCardHeight,
    8,
    colors.light,
  );
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("repeatClients"), statsCardX + 15, statsCardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(
      `${new Intl.NumberFormat(intlLocaleForReport(locale), {
        maximumFractionDigits: 1,
      }).format(quickStats.repeatClientsPercent || 0)}%`,
      statsCardX + 15,
      statsCardY + 35,
    );

  doc.y = statsCardY + statsCardHeight + 30;

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    doc.on("error", reject);
  });
};
