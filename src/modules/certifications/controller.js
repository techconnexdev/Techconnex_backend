import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function uploadCertifications(req, res) {
  try {
    const { userId, certifications } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    if (!certifications || !Array.isArray(certifications)) {
      return res.status(400).json({ success: false, message: "Certifications array is required" });
    }

    // Check if user exists and has provider profile
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { providerProfile: true }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.providerProfile) {
      return res.status(400).json({ success: false, message: "User must have a provider profile" });
    }

    // Delete existing certifications for this user
    await prisma.certification.deleteMany({
      where: { profileId: user.providerProfile.id }
    });

    // Create new certifications
    const createdCertifications = [];
    for (const cert of certifications) {
      if (cert.name && cert.issuer && cert.issuedDate) {
        const newCert = await prisma.certification.create({
          data: {
            profileId: user.providerProfile.id,
            name: cert.name,
            issuer: cert.issuer,
            issuedDate: new Date(cert.issuedDate),
            serialNumber: cert.serialNumber || null,
            sourceUrl: cert.sourceUrl || null,
            verified: false, // Default to false, admin can verify later
          },
        });
        createdCertifications.push(newCert);
      }
    }

    return res.status(201).json({ 
      success: true, 
      message: "Certifications uploaded successfully",
      certifications: createdCertifications 
    });
  } catch (error) {
    console.error("Certifications upload error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function getCertifications(req, res) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { 
        providerProfile: {
          include: {
            certifications: true
          }
        }
      }
    });
    
    if (!user || !user.providerProfile) {
      return res.status(404).json({ success: false, message: "User or provider profile not found" });
    }

    return res.status(200).json({ 
      success: true, 
      certifications: user.providerProfile.certifications 
    });
  } catch (error) {
    console.error("Get certifications error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

async function createCertification(req, res) {
  try {
    const userId = req.user.userId; // From authenticateToken middleware
    const { name, issuer, issuedDate, serialNumber, sourceUrl } = req.body;

    // Validation
    if (!name || !issuer || !issuedDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, issuer, and issued date are required" 
      });
    }

    // At least one of serialNumber or sourceUrl must be provided
    if (!serialNumber?.trim() && !sourceUrl?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "At least one of serial number or verification link is required" 
      });
    }

    // Check if user exists and has provider profile
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { providerProfile: true }
    });
    
    if (!user || !user.providerProfile) {
      return res.status(404).json({ 
        success: false, 
        message: "Provider profile not found" 
      });
    }

    // Create certification
    const certification = await prisma.certification.create({
      data: {
        profileId: user.providerProfile.id,
        name: name.trim(),
        issuer: issuer.trim(),
        issuedDate: new Date(issuedDate),
        serialNumber: serialNumber?.trim() || null,
        sourceUrl: sourceUrl?.trim() || null,
        verified: false,
      },
    });

    return res.status(201).json({ 
      success: true, 
      message: "Certification created successfully",
      data: certification 
    });
  } catch (error) {
    console.error("Create certification error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  }
}

async function updateCertification(req, res) {
  try {
    const userId = req.user.userId; // From authenticateToken middleware
    const { id } = req.params;
    const { name, issuer, issuedDate, serialNumber, sourceUrl } = req.body;

    // Validation
    if (!name || !issuer || !issuedDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, issuer, and issued date are required" 
      });
    }

    // At least one of serialNumber or sourceUrl must be provided
    if (!serialNumber?.trim() && !sourceUrl?.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: "At least one of serial number or verification link is required" 
      });
    }

    // Get user's provider profile
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { providerProfile: true }
    });
    
    if (!user || !user.providerProfile) {
      return res.status(404).json({ 
        success: false, 
        message: "Provider profile not found" 
      });
    }

    // Check if certification exists and belongs to this user
    const existingCert = await prisma.certification.findUnique({
      where: { id },
    });

    if (!existingCert) {
      return res.status(404).json({ 
        success: false, 
        message: "Certification not found" 
      });
    }

    if (existingCert.profileId !== user.providerProfile.id) {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized: This certification does not belong to you" 
      });
    }

    // Update certification
    const certification = await prisma.certification.update({
      where: { id },
      data: {
        name: name.trim(),
        issuer: issuer.trim(),
        issuedDate: new Date(issuedDate),
        serialNumber: serialNumber?.trim() || null,
        sourceUrl: sourceUrl?.trim() || null,
      },
    });

    return res.status(200).json({ 
      success: true, 
      message: "Certification updated successfully",
      data: certification 
    });
  } catch (error) {
    console.error("Update certification error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  }
}

async function deleteCertification(req, res) {
  try {
    const userId = req.user.userId; // From authenticateToken middleware
    const { id } = req.params;

    // Get user's provider profile
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { providerProfile: true }
    });
    
    if (!user || !user.providerProfile) {
      return res.status(404).json({ 
        success: false, 
        message: "Provider profile not found" 
      });
    }

    // Check if certification exists and belongs to this user
    const existingCert = await prisma.certification.findUnique({
      where: { id },
    });

    if (!existingCert) {
      return res.status(404).json({ 
        success: false, 
        message: "Certification not found" 
      });
    }

    if (existingCert.profileId !== user.providerProfile.id) {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized: This certification does not belong to you" 
      });
    }

    // Delete certification
    await prisma.certification.delete({
      where: { id },
    });

    return res.status(200).json({ 
      success: true, 
      message: "Certification deleted successfully" 
    });
  } catch (error) {
    console.error("Delete certification error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  }
}

async function getMyCertifications(req, res) {
  try {
    const userId = req.user.userId; // From authenticateToken middleware

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { 
        providerProfile: {
          include: {
            certifications: {
              orderBy: { issuedDate: 'desc' }
            }
          }
        }
      }
    });
    
    if (!user || !user.providerProfile) {
      return res.status(404).json({ 
        success: false, 
        message: "Provider profile not found" 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: user.providerProfile.certifications || []
    });
  } catch (error) {
    console.error("Get certifications error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  }
}

export { uploadCertifications, getCertifications, createCertification, updateCertification, deleteCertification, getMyCertifications };
