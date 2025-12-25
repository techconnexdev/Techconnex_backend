import PDFDocument from "pdfkit";

export function generateReportPDF(data, reportType = "overview", dateRange = "last_30_days") {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("TechConnect Platform Reports", { align: "center" });

      doc.moveDown();
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1).replace("_", " ")}`, {
          align: "center",
        });

      doc
        .fontSize(10)
        .text(`Date Range: ${dateRange.replace("_", " ")}`, { align: "center" });
      doc
        .fontSize(10)
        .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });

      doc.moveDown(2);

      // Overview Stats
      if (data.overviewStats) {
        doc.fontSize(16).font("Helvetica-Bold").text("Overview Statistics", { underline: true });
        doc.moveDown(0.5);

        const stats = data.overviewStats;
        doc.fontSize(11).font("Helvetica");

        doc.text(`Total Revenue: RM ${(stats.totalRevenue / 1000000).toFixed(2)}M`);
        doc.text(`Revenue Growth: ${stats.revenueGrowth >= 0 ? "+" : ""}${stats.revenueGrowth.toFixed(2)}%`);
        doc.moveDown(0.3);

        doc.text(`Total Users: ${stats.totalUsers.toLocaleString()}`);
        doc.text(`User Growth: ${stats.userGrowth >= 0 ? "+" : ""}${stats.userGrowth.toFixed(2)}%`);
        doc.moveDown(0.3);

        doc.text(`Total Projects: ${stats.totalProjects}`);
        doc.text(`Project Growth: ${stats.projectGrowth >= 0 ? "+" : ""}${stats.projectGrowth.toFixed(2)}%`);
        doc.moveDown(0.3);

        doc.text(`Average Rating: ${stats.avgRating.toFixed(1)}`);
        doc.text(`Rating Change: ${stats.ratingChange >= 0 ? "+" : ""}${stats.ratingChange.toFixed(1)}`);

        doc.moveDown(2);
      }

      // Monthly Data
      if (data.monthlyData && data.monthlyData.length > 0) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(16).font("Helvetica-Bold").text("Monthly Performance", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font("Helvetica");
        data.monthlyData.forEach((month) => {
          // Check if we need a new page before adding more content
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.text(
            `${month.month} ${month.year}: RM ${(month.revenue / 1000).toFixed(0)}K | Projects: ${month.projects} | Users: ${month.users}`
          );
        });

        doc.moveDown(2);
      }

      // Category Breakdown
      if (data.categoryBreakdown && data.categoryBreakdown.length > 0) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(16).font("Helvetica-Bold").text("Revenue by Category", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font("Helvetica");
        data.categoryBreakdown.forEach((category) => {
          // Check if we need a new page before adding more content
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.text(
            `${category.category}: RM ${(category.revenue / 1000).toFixed(0)}K (${category.percentage.toFixed(1)}%) - ${category.projects} projects`
          );
        });

        doc.moveDown(2);
      }

      // Top Providers
      if (data.topProviders && data.topProviders.length > 0) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(16).font("Helvetica-Bold").text("Top Performing Providers", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font("Helvetica");
        data.topProviders.forEach((provider, index) => {
          // Check if we need a new page before adding more content
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.text(
            `${index + 1}. ${provider.name}: RM ${(provider.revenue / 1000).toFixed(0)}K | Projects: ${provider.projects} | Rating: ${provider.rating?.toFixed(1) || "N/A"}`
          );
        });

        doc.moveDown(2);
      }

      // Top Customers
      if (data.topCustomers && data.topCustomers.length > 0) {
        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(16).font("Helvetica-Bold").text("Top Spending Customers", { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font("Helvetica");
        data.topCustomers.forEach((customer, index) => {
          // Check if we need a new page before adding more content
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.text(
            `${index + 1}. ${customer.name}: RM ${(customer.spent / 1000).toFixed(0)}K | Projects: ${customer.projects}`
          );
        });

        doc.moveDown(2);
      }

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          "This report was generated by TechConnect Platform. All data is based on actual platform transactions.",
          { align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

