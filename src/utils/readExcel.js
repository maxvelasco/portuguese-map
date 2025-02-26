import * as XLSX from "xlsx";

export const readExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      // Read the first sheet (assuming only one sheet for now)
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const sheetJson = XLSX.utils.sheet_to_json(worksheet);

      resolve(sheetJson);
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const readExcelFromUrl = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
  
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
  
      const sheetName = workbook.SheetNames[0]; // Read first sheet
      const worksheet = workbook.Sheets[sheetName];
  
      return XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // Ensure empty cells return ""
    } catch (error) {
      console.error("Error reading Excel file:", error);
      return [];
    }
  };