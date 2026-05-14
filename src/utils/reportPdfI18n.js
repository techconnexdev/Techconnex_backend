/**
 * Shared locale, money, and copy for PDF reports (provider earnings + customer billing).
 */

const SUPPORTED = new Set(["en", "id", "ar"]);

export function normalizeReportLocale(input) {
  if (input == null || input === "") return "en";
  const base = String(input).trim().toLowerCase().split(/[-_]/)[0];
  if (SUPPORTED.has(base)) return base;
  return "en";
}

export function intlLocaleForReport(locale) {
  const l = normalizeReportLocale(locale);
  if (l === "id") return "id-ID";
  if (l === "ar") return "ar";
  return "en-US";
}

/**
 * @param {number} amount
 * @param {string} currencyCode ISO 4217
 * @param {string} locale
 */
export function formatReportMoney(amount, currencyCode, locale) {
  const code = (currencyCode || "MYR").toUpperCase();
  const intl = intlLocaleForReport(locale);
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(intl, {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString(intl)}`;
  }
}

export function formatReportDate(isoOrDate, locale) {
  if (isoOrDate == null) return "—";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocaleForReport(locale), {
    dateStyle: "medium",
  });
}

export function formatReportDateTime(isoOrDate, locale) {
  if (isoOrDate == null) return "—";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(intlLocaleForReport(locale), {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export function formatReportMonthYear(isoOrDate, locale) {
  if (isoOrDate == null) return "—";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocaleForReport(locale), {
    month: "short",
    year: "numeric",
  });
}

const PROVIDER = {
  en: {
    title: "Earnings Analytics Report",
    subtitle: "Comprehensive Earnings Overview",
    reportDetails: "Report Details:",
    generated: "Generated:",
    roleLabel: "Provider:",
    s1: "1. Earnings Overview",
    totalEarnings: "Total Earnings",
    thisMonth: "This Month",
    availableBalance: "Available Balance",
    pendingPayments: "Pending Payments",
    monthlyGrowth: "Monthly Growth",
    avgProjectValue: "Avg Project Value",
    s2: "2. Recent Payments",
    noRecent: "No recent payments found.",
    s3: "3. Monthly Earnings (Last 12 Months)",
    noMonthly: "No monthly earnings data.",
    s4: "4. Top Clients",
    noClients: "No client data available.",
    s5: "5. Performance Statistics",
    projectsThisMonth: "Projects This Month",
    successRate: "Success Rate",
    repeatClients: "Repeat Clients",
    colNum: "#",
    colProject: "Project",
    colClient: "Client",
    colAmount: "Amount",
    colDate: "Date",
    colStatus: "Status",
    colMonth: "Month",
    colProjects: "Projects",
    colAvgPerProject: "Avg per Project",
    colClientId: "Client ID",
    colTotalPaid: "Total Paid",
    na: "N/A",
  },
  id: {
    title: "Laporan Analitik Pendapatan",
    subtitle: "Ringkasan Pendapatan Menyeluruh",
    reportDetails: "Detail Laporan:",
    generated: "Dibuat:",
    roleLabel: "Penyedia:",
    s1: "1. Ringkasan Pendapatan",
    totalEarnings: "Total Pendapatan",
    thisMonth: "Bulan Ini",
    availableBalance: "Saldo Tersedia",
    pendingPayments: "Pembayaran Tertunda",
    monthlyGrowth: "Pertumbuhan Bulanan",
    avgProjectValue: "Rata-rata Nilai Proyek",
    s2: "2. Pembayaran Terkini",
    noRecent: "Tidak ada pembayaran terkini.",
    s3: "3. Pendapatan Bulanan (12 Bulan Terakhir)",
    noMonthly: "Tidak ada data pendapatan bulanan.",
    s4: "4. Klien Teratas",
    noClients: "Tidak ada data klien.",
    s5: "5. Statistik Kinerja",
    projectsThisMonth: "Proyek Bulan Ini",
    successRate: "Tingkat Keberhasilan",
    repeatClients: "Klien Berulang",
    colNum: "#",
    colProject: "Proyek",
    colClient: "Klien",
    colAmount: "Jumlah",
    colDate: "Tanggal",
    colStatus: "Status",
    colMonth: "Bulan",
    colProjects: "Proyek",
    colAvgPerProject: "Rata-rata per Proyek",
    colClientId: "ID Klien",
    colTotalPaid: "Total Dibayar",
    na: "T/A",
  },
  ar: {
    title: "تقرير تحليلات الأرباح",
    subtitle: "نظرة شاملة على الأرباح",
    reportDetails: "تفاصيل التقرير:",
    generated: "تاريخ الإنشاء:",
    roleLabel: "مقدم الخدمة:",
    s1: "١. نظرة عامة على الأرباح",
    totalEarnings: "إجمالي الأرباح",
    thisMonth: "هذا الشهر",
    availableBalance: "الرصيد المتاح",
    pendingPayments: "المدفوعات المعلقة",
    monthlyGrowth: "النمو الشهري",
    avgProjectValue: "متوسط قيمة المشروع",
    s2: "٢. المدفوعات الأخيرة",
    noRecent: "لا توجد مدفوعات حديثة.",
    s3: "٣. الأرباح الشهرية (آخر ١٢ شهرًا)",
    noMonthly: "لا توجد بيانات أرباح شهرية.",
    s4: "٤. أهم العملاء",
    noClients: "لا تتوفر بيانات للعملاء.",
    s5: "٥. إحصاءات الأداء",
    projectsThisMonth: "مشاريع هذا الشهر",
    successRate: "معدل النجاح",
    repeatClients: "العملاء المتكررون",
    colNum: "#",
    colProject: "المشروع",
    colClient: "العميل",
    colAmount: "المبلغ",
    colDate: "التاريخ",
    colStatus: "الحالة",
    colMonth: "الشهر",
    colProjects: "المشاريع",
    colAvgPerProject: "المتوسط لكل مشروع",
    colClientId: "معرّف العميل",
    colTotalPaid: "إجمالي المدفوع",
    na: "غير متوفر",
  },
};

const BILLING = {
  en: {
    title: "Billing Analytics Report",
    subtitle: "Comprehensive Financial Overview",
    reportDetails: "Report Details:",
    generated: "Generated:",
    roleLabel: "User:",
    s1: "1. Financial Overview",
    s2: "2. Recent Transactions",
    s3: "3. Upcoming Payments",
    totalSpent: "Total Spent",
    thisMonth: "This Month",
    pendingPayments: "Pending Payments",
    avgTransaction: "Avg Transaction",
    noTransactions: "No transactions found.",
    noUpcoming: "No upcoming payments.",
    upcomingTotal: "Total Upcoming:",
    colNum: "#",
    colAmount: "Amount",
    colProject: "Project",
    colDate: "Date",
    colStatus: "Status",
    colNextMilestone: "Next milestone",
    colHash: "#",
    colProject2: "Project",
    colStatus2: "Status",
    colMilestone: "Next Milestone",
    colAmount2: "Amount",
  },
  id: {
    title: "Laporan Analitik Penagihan",
    subtitle: "Ringkasan Keuangan Menyeluruh",
    reportDetails: "Detail Laporan:",
    generated: "Dibuat:",
    roleLabel: "Pengguna:",
    s1: "1. Ringkasan Keuangan",
    s2: "2. Transaksi Terkini",
    s3: "3. Pembayaran Mendatang",
    totalSpent: "Total Pengeluaran",
    thisMonth: "Bulan Ini",
    pendingPayments: "Pembayaran Tertunda",
    avgTransaction: "Rata-rata Transaksi",
    noTransactions: "Tidak ada transaksi.",
    noUpcoming: "Tidak ada pembayaran mendatang.",
    upcomingTotal: "Total Mendatang:",
    colNum: "#",
    colAmount: "Jumlah",
    colProject: "Proyek",
    colDate: "Tanggal",
    colStatus: "Status",
    colNextMilestone: "Tonggak berikutnya",
    colHash: "#",
    colProject2: "Proyek",
    colStatus2: "Status",
    colMilestone: "Tonggak Berikutnya",
    colAmount2: "Jumlah",
  },
  ar: {
    title: "تقرير تحليلات الفوترة",
    subtitle: "نظرة مالية شاملة",
    reportDetails: "تفاصيل التقرير:",
    generated: "تاريخ الإنشاء:",
    roleLabel: "المستخدم:",
    s1: "١. نظرة مالية عامة",
    s2: "٢. المعاملات الأخيرة",
    s3: "٣. المدفوعات القادمة",
    totalSpent: "إجمالي الإنفاق",
    thisMonth: "هذا الشهر",
    pendingPayments: "المدفوعات المعلقة",
    avgTransaction: "متوسط المعاملة",
    noTransactions: "لا توجد معاملات.",
    noUpcoming: "لا توجد مدفوعات قادمة.",
    upcomingTotal: "إجمالي القادم:",
    colNum: "#",
    colAmount: "المبلغ",
    colProject: "المشروع",
    colDate: "التاريخ",
    colStatus: "الحالة",
    colNextMilestone: "المرحلة التالية",
    colHash: "#",
    colProject2: "المشروع",
    colStatus2: "الحالة",
    colMilestone: "المرحلة التالية",
    colAmount2: "المبلغ",
  },
};

export function providerPdfT(locale, key) {
  const loc = normalizeReportLocale(locale);
  return PROVIDER[loc]?.[key] ?? PROVIDER.en[key] ?? key;
}

export function billingPdfT(locale, key) {
  const loc = normalizeReportLocale(locale);
  return BILLING[loc]?.[key] ?? BILLING.en[key] ?? key;
}

const STATUS_PROVIDER_EN = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  ESCROWED: "Escrow",
  RELEASED: "Released",
  TRANSFERRED: "Transferred",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};

const STATUS_PROVIDER_ID = {
  PENDING: "Tertunda",
  IN_PROGRESS: "Dalam proses",
  ESCROWED: "Escrow",
  RELEASED: "Dirilis",
  TRANSFERRED: "Ditransfer",
  REFUNDED: "Dikembalikan",
  FAILED: "Gagal",
};

const STATUS_PROVIDER_AR = {
  PENDING: "قيد الانتظار",
  IN_PROGRESS: "قيد التنفيذ",
  ESCROWED: "ضمان",
  RELEASED: "مُفرج",
  TRANSFERRED: "محوّل",
  REFUNDED: "مسترد",
  FAILED: "فشل",
};

const STATUS_BILLING_EN = {
  transferred: "Transferred",
  escrow: "Escrow",
  escrowed: "Escrow",
  pending: "Pending",
  in_progress: "In progress",
  processing: "Processing",
  refunded: "Refunded",
  failed: "Failed",
  paid: "Paid",
  scheduled: "Scheduled",
  overdue: "Overdue",
  approved: "Approved",
};

const STATUS_BILLING_ID = {
  transferred: "Ditransfer",
  escrow: "Escrow",
  escrowed: "Escrow",
  pending: "Tertunda",
  in_progress: "Dalam proses",
  processing: "Memproses",
  refunded: "Dikembalikan",
  failed: "Gagal",
  paid: "Dibayar",
  scheduled: "Terjadwal",
  overdue: "Terlambat",
  approved: "Disetujui",
};

const STATUS_BILLING_AR = {
  transferred: "محوّل",
  escrow: "ضمان",
  escrowed: "ضمان",
  pending: "معلّق",
  in_progress: "قيد التنفيذ",
  processing: "قيد المعالجة",
  refunded: "مسترد",
  failed: "فشل",
  paid: "مدفوع",
  scheduled: "مجدول",
  overdue: "متأخر",
  approved: "موافق عليه",
};

export function formatProviderPaymentStatus(status, locale) {
  if (status == null) return "—";
  const key = String(status).toUpperCase();
  const loc = normalizeReportLocale(locale);
  const map =
    loc === "id"
      ? STATUS_PROVIDER_ID
      : loc === "ar"
        ? STATUS_PROVIDER_AR
        : STATUS_PROVIDER_EN;
  return map[key] || String(status);
}

export function formatBillingPaymentStatus(status, locale) {
  if (status == null) return "—";
  const key = String(status).toLowerCase();
  const loc = normalizeReportLocale(locale);
  const map =
    loc === "id"
      ? STATUS_BILLING_ID
      : loc === "ar"
        ? STATUS_BILLING_AR
        : STATUS_BILLING_EN;
  return map[key] || String(status);
}
