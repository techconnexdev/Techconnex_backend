import PDFDocument from "pdfkit";
import {
  convertWithSnapshot,
  hasCurrencyInSnapshot,
  normalizeCurrencyCode,
} from "../modules/fx/service.js";

const RECEIPT_I18N = {
  en: {
    title: "PAYMENT RECEIPT",
    subtitle: "Official Payment Confirmation",
    receiptInfoTitle: "Receipt Information",
    receiptId: "Receipt ID",
    issueDate: "Issue Date",
    issueTime: "Issue Time",
    paymentSummary: "Payment Summary",
    totalAmountPaid: "TOTAL AMOUNT PAID",
    paymentDetails: "Payment Details",
    paymentMethod: "Payment Method",
    currency: "Currency",
    platformFee: "Platform Fee",
    financialBreakdown: "Financial Breakdown",
    amountPaid: "Amount Paid",
    providerReceives: "Provider Receives",
    netAmount: "Net Amount",
    serviceDetails: "Service Details",
    milestoneInfo: "Milestone Information",
    milestoneTitle: "Milestone Title",
    milestoneAmount: "Milestone Amount",
    status: "Status",
    description: "Description",
    noDescription: "No description",
    projectInfo: "Project Information",
    projectTitle: "Project Title",
    category: "Category",
    projectId: "Project ID",
    partiesInvolved: "Parties Involved",
    customer: "Customer",
    serviceProvider: "Service Provider",
    name: "Name",
    email: "Email",
    phone: "Phone",
    na: "N/A",
    thankYou:
      "Thank you for your business! This receipt is an official record of your payment.",
  },
  id: {
    title: "BUKTI PEMBAYARAN",
    subtitle: "Konfirmasi Pembayaran Resmi",
    receiptInfoTitle: "Informasi Bukti Pembayaran",
    receiptId: "ID Bukti",
    issueDate: "Tanggal Terbit",
    issueTime: "Waktu Terbit",
    paymentSummary: "Ringkasan Pembayaran",
    totalAmountPaid: "TOTAL PEMBAYARAN",
    paymentDetails: "Detail Pembayaran",
    paymentMethod: "Metode Pembayaran",
    currency: "Mata Uang",
    platformFee: "Biaya Platform",
    financialBreakdown: "Rincian Keuangan",
    amountPaid: "Jumlah Dibayar",
    providerReceives: "Diterima Penyedia",
    netAmount: "Jumlah Bersih",
    serviceDetails: "Detail Layanan",
    milestoneInfo: "Informasi Milestone",
    milestoneTitle: "Judul Milestone",
    milestoneAmount: "Jumlah Milestone",
    status: "Status",
    description: "Deskripsi",
    noDescription: "Tidak ada deskripsi",
    projectInfo: "Informasi Proyek",
    projectTitle: "Judul Proyek",
    category: "Kategori",
    projectId: "ID Proyek",
    partiesInvolved: "Pihak Terkait",
    customer: "Pelanggan",
    serviceProvider: "Penyedia Layanan",
    name: "Nama",
    email: "Email",
    phone: "Telepon",
    na: "N/A",
    thankYou:
      "Terima kasih atas transaksi Anda! Bukti ini adalah catatan resmi pembayaran Anda.",
  },
  ar: {
    title: "إيصال الدفع",
    subtitle: "تأكيد دفع رسمي",
    receiptInfoTitle: "معلومات الإيصال",
    receiptId: "رقم الإيصال",
    issueDate: "تاريخ الإصدار",
    issueTime: "وقت الإصدار",
    paymentSummary: "ملخص الدفع",
    totalAmountPaid: "إجمالي المبلغ المدفوع",
    paymentDetails: "تفاصيل الدفع",
    paymentMethod: "طريقة الدفع",
    currency: "العملة",
    platformFee: "رسوم المنصة",
    financialBreakdown: "التفصيل المالي",
    amountPaid: "المبلغ المدفوع",
    providerReceives: "المبلغ المستلم للمزوّد",
    netAmount: "المبلغ الصافي",
    serviceDetails: "تفاصيل الخدمة",
    milestoneInfo: "معلومات المرحلة",
    milestoneTitle: "عنوان المرحلة",
    milestoneAmount: "مبلغ المرحلة",
    status: "الحالة",
    description: "الوصف",
    noDescription: "لا يوجد وصف",
    projectInfo: "معلومات المشروع",
    projectTitle: "عنوان المشروع",
    category: "الفئة",
    projectId: "معرّف المشروع",
    partiesInvolved: "الأطراف المعنية",
    customer: "العميل",
    serviceProvider: "مقدم الخدمة",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    na: "غير متوفر",
    thankYou: "شكرًا لتعاملكم معنا! هذا الإيصال سجل رسمي لعملية الدفع.",
  },
};

const normalizeLocale = (locale) => {
  const l = String(locale || "en").toLowerCase();
  if (l.startsWith("id")) return "id";
  if (l.startsWith("ar")) return "ar";
  return "en";
};

export const generateReceiptPDF = (payment, options = {}) => {
  const locale = normalizeLocale(options.locale);
  const i18n = RECEIPT_I18N[locale] || RECEIPT_I18N.en;
  const uiLocale = locale === "id" ? "id-ID" : locale === "ar" ? "ar" : "en-US";
  const txCurrency = normalizeCurrencyCode(payment?.currency || "MYR") || "MYR";
  const preferredCurrency = normalizeCurrencyCode(options?.preferredCurrency || txCurrency);
  const snapshotRates = payment?.project?.fxSnapshotRatesJson || null;
  const canConvertToPreferred =
    preferredCurrency &&
    preferredCurrency !== txCurrency &&
    hasCurrencyInSnapshot(txCurrency, snapshotRates) &&
    hasCurrencyInSnapshot(preferredCurrency, snapshotRates);
  const displayCurrency = canConvertToPreferred ? preferredCurrency : txCurrency;

  const toDisplayAmount = (amount) => {
    const numeric = Number(amount || 0);
    if (!Number.isFinite(numeric)) return 0;
    if (!canConvertToPreferred) return numeric;
    const converted = convertWithSnapshot({
      amount: numeric,
      fromCurrencyCode: txCurrency,
      toCurrencyCode: displayCurrency,
      ratesMap: snapshotRates,
    });
    return converted == null ? numeric : converted;
  };

  const formatMoney = (amount) => {
    const numeric = Number(amount || 0);
    if (!Number.isFinite(numeric)) return `${displayCurrency} 0`;
    return new Intl.NumberFormat(uiLocale, {
      style: "currency",
      currency: displayCurrency,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  const doc = new PDFDocument({ 
    margin: 40,
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
    light: '#f8f9fa',
    dark: '#2c3e50',
    border: '#dee2e6',
    accent: '#3498db'
  };

  // Helper functions
  const drawRoundedRect = (x, y, width, height, radius, color) => {
    doc.roundedRect(x, y, width, height, radius)
       .fill(color);
  };

  const createInfoCard = (title, data, y) => {
    const cardHeight = 25 + (Object.keys(data).length * 20);
    
    // Card background
    doc.roundedRect(50, y, doc.page.width - 100, cardHeight, 5)
       .fill(colors.light)
       .stroke(colors.border);
    
    // Card title
    doc.fontSize(12)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(title, 65, y + 15);
    
    // Card content
    let contentY = y + 40;
    Object.entries(data).forEach(([key, value]) => {
      doc.fontSize(10)
         .fillColor(colors.dark)
         .font('Helvetica-Bold')
         .text(`${key}:`, 65, contentY);
      
      doc.font('Helvetica')
         .fillColor(colors.secondary)
         .text(value, 65 + doc.widthOfString(`${key}:`) + 10, contentY);
      
      contentY += 20;
    });
    
    return y + cardHeight + 20;
  };

  const createTwoColumnSection = (leftData, rightData, y) => {
    const sectionWidth = (doc.page.width - 120) / 2;
    const sectionHeight = 100;
    
    // Left column
    doc.roundedRect(50, y, sectionWidth, sectionHeight, 5)
       .fill(colors.light)
       .stroke(colors.border);
    
    doc.fontSize(12)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(leftData.title, 65, y + 15);
    
    let leftY = y + 40;
    Object.entries(leftData.fields).forEach(([key, value]) => {
      doc.fontSize(10)
         .fillColor(colors.dark)
         .font('Helvetica-Bold')
         .text(`${key}:`, 65, leftY);
      
      doc.font('Helvetica')
         .fillColor(colors.secondary)
         .text(value, 65 + doc.widthOfString(`${key}:`) + 10, leftY);
      
      leftY += 20;
    });
    
    // Right column
    doc.roundedRect(50 + sectionWidth + 20, y, sectionWidth, sectionHeight, 5)
       .fill(colors.light)
       .stroke(colors.border);
    
    doc.fontSize(12)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(rightData.title, 65 + sectionWidth + 20, y + 15);
    
    let rightY = y + 40;
    Object.entries(rightData.fields).forEach(([key, value]) => {
      doc.fontSize(10)
         .fillColor(colors.dark)
         .font('Helvetica-Bold')
         .text(`${key}:`, 65 + sectionWidth + 20, rightY);
      
      doc.font('Helvetica')
         .fillColor(colors.secondary)
         .text(value, 65 + sectionWidth + 20 + doc.widthOfString(`${key}:`) + 10, rightY);
      
      rightY += 20;
    });
    
    return y + sectionHeight + 20;
  };

  // ==========================
  // HEADER
  // ==========================
  const tr = (key) => i18n[key] || RECEIPT_I18N.en[key] || key;

  // Header background
  drawRoundedRect(0, 0, doc.page.width, 120, 0, colors.primary);
  
  // Title
  doc.fontSize(24)
     .fillColor('#ffffff')
     .font('Helvetica-Bold')
     .text(tr("title"), 50, 45, { align: "center" });
  
  // Subtitle
  doc.fontSize(12)
     .fillColor('rgba(255,255,255,0.8)')
     .font('Helvetica')
     .text(tr("subtitle"), 50, 75, { align: "center" });

  // Status badge
  const status = payment.status || 'completed';
  const statusColors = {
    completed: colors.success,
    pending: colors.warning,
    failed: colors.danger,
    refunded: colors.secondary
  };
  
  const statusWidth = doc.widthOfString(status.toUpperCase()) + 20;
  doc.roundedRect(doc.page.width - statusWidth - 50, 35, statusWidth, 25, 12)
     .fill(statusColors[status] || colors.primary);
  
  doc.fontSize(10)
     .fillColor('#ffffff')
     .font('Helvetica-Bold')
     .text(status.toUpperCase(), doc.page.width - statusWidth - 40, 42);

  // ==========================
  // RECEIPT META INFORMATION
  // ==========================
  doc.y = 140;
  
  const metaData = {
    [tr("receiptId")]: payment.id,
    [tr("issueDate")]: new Date(payment.createdAt).toLocaleDateString(uiLocale),
    [tr("issueTime")]: new Date(payment.createdAt).toLocaleTimeString(uiLocale)
  };
  
  createInfoCard(tr("receiptInfoTitle"), metaData, doc.y);

  // ==========================
  // PAYMENT SUMMARY
  // ==========================
  doc.y = 240;
  
  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(tr("paymentSummary"), 50, doc.y)
     .moveDown(0.5);
  
  doc.strokeColor(colors.primary)
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(150, doc.y)
     .stroke();
  
  doc.moveDown(1.5);

  // Payment amount highlight
  const amountCardY = doc.y;
  doc.roundedRect(50, amountCardY, doc.page.width - 100, 80, 8)
     .fill(colors.light)
     .stroke(colors.primary);
  
  doc.fontSize(12)
     .fillColor(colors.secondary)
     .font('Helvetica-Bold')
     .text(tr("totalAmountPaid"), doc.page.width / 2 - doc.widthOfString(tr("totalAmountPaid")) / 2, amountCardY + 20);
  
  doc.fontSize(24)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(
      formatMoney(toDisplayAmount(payment.amount)),
      doc.page.width / 2 - doc.widthOfString(formatMoney(toDisplayAmount(payment.amount))) / 2,
      amountCardY + 45
    );
  
  doc.y = amountCardY + 100;

  // Payment details in two columns
  const paymentDetailsY = doc.y;
  const leftColumn = {
    title: tr("paymentDetails"),
    fields: {
      [tr("paymentMethod")]: payment.method || tr("na"),
      [tr("currency")]: displayCurrency || tr("na"),
      [tr("platformFee")]: formatMoney(toDisplayAmount(payment.platformFeeAmount))
    }
  };
  
  const rightColumn = {
    title: tr("financialBreakdown"),
    fields: {
      [tr("amountPaid")]: formatMoney(toDisplayAmount(payment.amount)),
      [tr("providerReceives")]: formatMoney(toDisplayAmount(payment.providerAmount)),
      [tr("netAmount")]: formatMoney(toDisplayAmount(payment.providerAmount))
    }
  };
  
  createTwoColumnSection(leftColumn, rightColumn, paymentDetailsY);
  
  doc.y += 140;

  // ==========================
  // MILESTONE & PROJECT DETAILS
  // ==========================
  if (payment.milestone || payment.project) {
    if (doc.y > 500) {
      doc.addPage();
      doc.y = 50;
    }
    
    doc.fontSize(16)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(tr("serviceDetails"), 50, doc.y)
       .moveDown(0.5);
    
    doc.strokeColor(colors.primary)
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(140, doc.y)
       .stroke();
    
    doc.moveDown(1.5);

    let currentY = doc.y;
    
    // Milestone details
    if (payment.milestone) {
      const milestoneData = {
        [tr("milestoneTitle")]: payment.milestone.title || tr("na"),
        [tr("milestoneAmount")]: formatMoney(toDisplayAmount(payment.milestone.amount)),
        [tr("status")]: payment.milestone.status || tr("na"),
        [tr("description")]: payment.milestone.description || tr("noDescription")
      };
      
      currentY = createInfoCard(tr("milestoneInfo"), milestoneData, currentY);
    }
    
    // Project details
    if (payment.project) {
      const projectData = {
        [tr("projectTitle")]: payment.project.title || tr("na"),
        [tr("category")]: payment.project.category || tr("na"),
        [tr("projectId")]: payment.project.id || tr("na")
      };
      
      currentY = createInfoCard(tr("projectInfo"), projectData, currentY);
    }
    
    doc.y = currentY;
  }

  // ==========================
  // PARTIES INFORMATION
  // ==========================
  if (doc.y > 400) {
    doc.addPage();
    doc.y = 50;
  }
  
  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(tr("partiesInvolved"), 50, doc.y)
     .moveDown(0.5);
  
  doc.strokeColor(colors.primary)
     .lineWidth(1)
     .moveTo(50, doc.y)
     .lineTo(160, doc.y)
     .stroke();
  
  doc.moveDown(1.5);

  const customer = payment.project?.customer;
  const provider = payment.project?.provider;
  
  if (customer || provider) {
    const partiesY = doc.y;
    
    const customerData = {
      title: tr("customer"),
      fields: {
        [tr("name")]: customer?.name || tr("na"),
        [tr("email")]: customer?.email || tr("na"),
        [tr("phone")]: customer?.phone || tr("na")
      }
    };
    
    const providerData = {
      title: tr("serviceProvider"),
      fields: {
        [tr("name")]: provider?.name || tr("na"),
        [tr("email")]: provider?.email || tr("na"),
        [tr("phone")]: provider?.phone || tr("na")
      }
    };
    
    createTwoColumnSection(customerData, providerData, partiesY);
    doc.y += 140;
  }

  // ==========================
  // FOOTER & NOTES
  // ==========================
  const pageCount = doc.bufferedPageRange().count;
  
//   for (let i = 0; i < pageCount; i++) {
//     doc.switchToPage(i);
    
//     // Footer
//     doc.fontSize(8)
//        .fillColor(colors.secondary)
//        .text(
//          `Page ${i + 1} of ${pageCount} • Generated by TechConnect • ${new Date().toLocaleDateString()}`,
//          50,
//          doc.page.height - 30,
//          { align: "center", opacity: 0.6 }
//        );
//   }

  // Thank you note on last page
  doc.switchToPage(pageCount - 1);
  
  doc.fontSize(10)
     .fillColor(colors.secondary)
     .font('Helvetica')
     .text(tr("thankYou"), 
           50, doc.page.height - 60, { align: "center", opacity: 0.8 });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
    doc.on('error', reject);
  });
};