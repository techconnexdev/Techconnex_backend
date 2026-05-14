import PDFDocument from "pdfkit";
import {
  formatReportMoney,
  formatReportDate,
  formatReportDateTime,
  billingPdfT,
  normalizeReportLocale,
  formatBillingPaymentStatus,
} from "./reportPdfI18n.js";

export const createAnalyticsPDF = async (data) => {
  const locale = normalizeReportLocale(data.locale);
  const currency = String(data.displayCurrency || "MYR").toUpperCase();
  const t = (key) => billingPdfT(locale, key);
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
    .lineTo(150, doc.y)
    .stroke();

  doc.moveDown(1);

  const overview = data.overview;
  const cardWidth = (doc.page.width - 120) / 2;
  const cardHeight = 70;
  let cardX = 50;
  let cardY = doc.y;

  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("totalSpent"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(fmt(overview.totalSpent), cardX + 15, cardY + 35);

  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .font("Helvetica")
    .text(t("thisMonth"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.success)
    .font("Helvetica-Bold")
    .text(fmt(overview.thisMonthSpent), cardX + 15, cardY + 35);

  cardX = 50;
  cardY += cardHeight + 15;

  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("pendingPayments"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.warning)
    .font("Helvetica-Bold")
    .text(fmt(overview.pendingPayments), cardX + 15, cardY + 35);

  cardX += cardWidth + 20;
  drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, colors.light);
  doc
    .fontSize(10)
    .fillColor(colors.secondary)
    .text(t("avgTransaction"), cardX + 15, cardY + 15);
  doc
    .fontSize(14)
    .fillColor(colors.dark)
    .font("Helvetica-Bold")
    .text(fmt(overview.averageTransaction), cardX + 15, cardY + 35);

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

  const transactions = data.transactions || [];

  if (!transactions.length) {
    doc
      .fontSize(10)
      .fillColor(colors.secondary)
      .text(t("noTransactions"), 50, doc.y);
    doc.moveDown(2);
  } else {
    const transactionColWidths = [36, 105, 155, 95, 104];
    const txnHeader = [
      t("colNum"),
      t("colAmount"),
      t("colProject"),
      t("colDate"),
      t("colStatus"),
    ];
    let currentY = createTableRow(
      doc.y,
      txnHeader,
      transactionColWidths,
      true,
      colors.primary,
    );

    transactions.forEach((row, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          txnHeader,
          transactionColWidths,
          true,
          colors.primary,
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const statusLabel = formatBillingPaymentStatus(row.status, locale);
      const projectTitle = String(row.projectTitle || "").substring(0, 42);
      const dateStr = row.createdAt
        ? formatReportDate(row.createdAt, locale)
        : "—";

      currentY = createTableRow(
        currentY,
        [
          i + 1,
          fmt(row.displayAmount),
          projectTitle || "—",
          dateStr,
          statusLabel,
        ],
        transactionColWidths,
        false,
        rowColor,
      );
    });

    doc.y = currentY + 10;
  }

  if (doc.y > 400) {
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
    .lineTo(190, doc.y)
    .stroke();

  doc.moveDown(1);

  const upcomingRows = data.upcomingRows || [];

  if (!upcomingRows.length) {
    doc
      .fontSize(10)
      .fillColor(colors.secondary)
      .text(t("noUpcoming"), 50, doc.y);
    doc.moveDown(2);
  } else {
    const upcomingColWidths = [28, 122, 82, 138, 125];
    const upHeader = [
      t("colHash"),
      t("colProject2"),
      t("colStatus2"),
      t("colMilestone"),
      t("colAmount2"),
    ];
    let currentY = createTableRow(
      doc.y,
      upHeader,
      upcomingColWidths,
      true,
      colors.primary,
    );

    upcomingRows.forEach((row, i) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
        currentY = createTableRow(
          currentY,
          upHeader,
          upcomingColWidths,
          true,
          colors.primary,
        );
      }

      const rowColor = i % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const milestoneTitle = String(row.milestoneTitle || "").substring(
        0,
        35,
      );

      currentY = createTableRow(
        currentY,
        [
          i + 1,
          String(row.projectTitle || "").substring(0, 30),
          String(row.projectStatus || ""),
          milestoneTitle,
          fmt(row.amount),
        ],
        upcomingColWidths,
        false,
        rowColor,
      );
    });

    doc.y = currentY + 10;

    const totalUpcoming = upcomingRows.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0,
    );

    if (totalUpcoming > 0) {
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }

      doc
        .rect(50, doc.y, doc.page.width - 100, 30)
        .fill(colors.light)
        .stroke(colors.border);

      doc
        .fontSize(10)
        .fillColor(colors.primary)
        .font("Helvetica-Bold")
        .text(
          `${t("upcomingTotal")} ${fmt(totalUpcoming)}`,
          65,
          doc.y + 10,
        );

      doc.y += 40;
    }
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    doc.on("error", reject);
  });
};
