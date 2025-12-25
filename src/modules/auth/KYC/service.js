import {
  createKycDocumentInDB,
  getAllKycDocuments,
  getKycDocumentById,
} from "./model.js";


export const createKycDocument = async (data) => {
  return await createKycDocumentInDB(data);
};

export const listKycDocuments = async () => {
  return await getAllKycDocuments();
};

export const getKycDocument = async (id) => {
  return await getKycDocumentById(id);
};