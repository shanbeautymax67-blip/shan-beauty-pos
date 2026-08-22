const HEADERS = ["Name", "Category", "Buying Price", "Selling Price", "Stock", "Reorder Level"];

export async function exportProductsToExcel(products, filename = "shan-beauty-max-products.xlsx") {
  const XLSX = await import("xlsx");
  const rows = products.map((p) => ({
    Name: p.name,
    Category: p.category || "",
    "Buying Price": Number(p.buying_price || 0),
    "Selling Price": Number(p.price || 0),
    Stock: Number(p.stock || 0),
    "Reorder Level": Number(p.reorder_level ?? 5),
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  worksheet["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
  XLSX.writeFile(workbook, filename);
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

// Accepts common header variations: "Name"/"name", "Buying Price"/"buying_price"/"cost", etc.
function findValue(row, candidates) {
  const normalizedRow = {};
  for (const key of Object.keys(row)) {
    normalizedRow[normalizeKey(key)] = row[key];
  }
  for (const candidate of candidates) {
    const norm = normalizeKey(candidate);
    if (normalizedRow[norm] !== undefined && normalizedRow[norm] !== "") {
      return normalizedRow[norm];
    }
  }
  return undefined;
}

export async function parseProductsExcelFile(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const rows = [];
  const errors = [];

  rawRows.forEach((raw, idx) => {
    const name = findValue(raw, ["Name", "Product", "Product Name"]);
    const category = findValue(raw, ["Category"]);
    const buyingPrice = findValue(raw, ["Buying Price", "Buying", "Cost", "Cost Price"]);
    const price = findValue(raw, ["Selling Price", "Price", "Selling"]);
    const stock = findValue(raw, ["Stock", "Quantity", "Qty"]);
    const reorderLevel = findValue(raw, [
      "Reorder Level",
      "Reorder Point",
      "Reorder",
      "Low Stock Level",
      "Min Stock",
    ]);

    if (!name || String(name).trim() === "") {
      errors.push(`Row ${idx + 2}: missing product name — skipped.`);
      return;
    }
    if (price === undefined || isNaN(Number(price))) {
      errors.push(`Row ${idx + 2} ("${name}"): missing or invalid Selling Price — skipped.`);
      return;
    }

    rows.push({
      name: String(name).trim(),
      category: category ? String(category).trim() : null,
      buying_price: Number(buyingPrice) || 0,
      price: Number(price),
      stock: Number(stock) || 0,
      reorder_level:
        reorderLevel !== undefined && !isNaN(Number(reorderLevel)) ? Number(reorderLevel) : 5,
    });
  });

  return { rows, errors };
}
