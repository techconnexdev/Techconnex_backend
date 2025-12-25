import PDFDocument from "pdfkit";

export const generateReceiptPDF = (payment) => {
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
  // Header background
  drawRoundedRect(0, 0, doc.page.width, 120, 0, colors.primary);
  
  // Title
  doc.fontSize(24)
     .fillColor('#ffffff')
     .font('Helvetica-Bold')
     .text("PAYMENT RECEIPT", 50, 45, { align: "center" });
  
  // Subtitle
  doc.fontSize(12)
     .fillColor('rgba(255,255,255,0.8)')
     .font('Helvetica')
     .text("Official Payment Confirmation", 50, 75, { align: "center" });

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
    'Receipt ID': payment.id,
    'Issue Date': new Date(payment.createdAt).toLocaleDateString(),
    'Issue Time': new Date(payment.createdAt).toLocaleTimeString()
  };
  
  createInfoCard("Receipt Information", metaData, doc.y);

  // ==========================
  // PAYMENT SUMMARY
  // ==========================
  doc.y = 240;
  
  doc.fontSize(16)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text("Payment Summary", 50, doc.y)
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
     .text("TOTAL AMOUNT PAID", doc.page.width / 2 - doc.widthOfString("TOTAL AMOUNT PAID") / 2, amountCardY + 20);
  
  doc.fontSize(24)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(payment.amount + ' ' + payment.currency, doc.page.width / 2 - doc.widthOfString(payment.amount + ' ' + payment.currency) / 2, amountCardY + 45);
  
  doc.y = amountCardY + 100;

  // Payment details in two columns
  const paymentDetailsY = doc.y;
  const leftColumn = {
    title: "Payment Details",
    fields: {
      'Payment Method': payment.method || 'N/A',
      'Currency': payment.currency || 'N/A',
      'Platform Fee': payment.platformFeeAmount + ' ' + payment.currency
    }
  };
  
  const rightColumn = {
    title: "Financial Breakdown",
    fields: {
      'Amount Paid': payment.amount + ' ' + payment.currency,
      'Provider Receives': payment.providerAmount + ' ' + payment.currency,
      'Net Amount': payment.providerAmount + ' ' + payment.currency
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
       .text("Service Details", 50, doc.y)
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
        'Milestone Title': payment.milestone.title || 'N/A',
        'Milestone Amount': payment.milestone.amount || 'N/A',
        'Status': payment.milestone.status || 'N/A',
        'Description': payment.milestone.description || 'No description'
      };
      
      currentY = createInfoCard("Milestone Information", milestoneData, currentY);
    }
    
    // Project details
    if (payment.project) {
      const projectData = {
        'Project Title': payment.project.title || 'N/A',
        'Category': payment.project.category || 'N/A',
        'Project ID': payment.project.id || 'N/A'
      };
      
      currentY = createInfoCard("Project Information", projectData, currentY);
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
     .text("Parties Involved", 50, doc.y)
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
      title: "Customer",
      fields: {
        'Name': customer?.name || 'N/A',
        'Email': customer?.email || 'N/A',
        'Phone': customer?.phone || 'N/A'
      }
    };
    
    const providerData = {
      title: "Service Provider",
      fields: {
        'Name': provider?.name || 'N/A',
        'Email': provider?.email || 'N/A',
        'Phone': provider?.phone || 'N/A'
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
     .text("Thank you for your business! This receipt is an official record of your payment.", 
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