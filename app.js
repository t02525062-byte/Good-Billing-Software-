// ==========================================
// 1. Initial State & Data Management
// ==========================================

// Sample products with realistic Indian market values (in Rupees ₹)
const DEFAULT_PRODUCTS = [
  { id: "1", name: "Mechanical Keyboard", price: 2499.00, stock: 12 },
  { id: "2", name: "Wireless Ergonomic Mouse", price: 1299.00, stock: 4 },
  { id: "3", name: "USB-C Multi-Port Hub", price: 1499.00, stock: 0 },
  { id: "4", name: "27-inch 4K Monitor", price: 24999.00, stock: 8 },
];

// Load products and completed bills from browser LocalStorage
let products = JSON.parse(localStorage.getItem("inventory_products")) || DEFAULT_PRODUCTS;
let bills = JSON.parse(localStorage.getItem("inventory_bills")) || [];

// Migrate older USD sample data in localStorage to realistic INR values if needed
if (localStorage.getItem("inventory_currency") !== "INR") {
  let hasMigrated = false;
  products = products.map((prod) => {
    if (prod.id === "1" && prod.price === 89.99) { prod.price = 2499.00; hasMigrated = true; }
    if (prod.id === "2" && prod.price === 49.5) { prod.price = 1299.00; hasMigrated = true; }
    if (prod.id === "3" && prod.price === 29.99) { prod.price = 1499.00; hasMigrated = true; }
    if (prod.id === "4" && prod.price === 349.0) { prod.price = 24999.00; hasMigrated = true; }
    return prod;
  });
  localStorage.setItem("inventory_currency", "INR");
  if (hasMigrated) {
    localStorage.setItem("inventory_products", JSON.stringify(products));
  }
}

// Authentication & Session Credentials
const AUTH_KEY = "surya_auth_session";
const DEFAULT_USER = "admin";
const DEFAULT_PASS = "password123";

// Current active bill (items in cart before completing the sale)
let currentBill = [];

// Track the bill currently open in the receipt modal
let currentModalBill = null;

// Flag to prevent double-clicks & duplicate stock deductions
let isCompletingBill = false;

// Search keywords
let searchKeyword = "";
let billingSearchKeyword = "";
let historySearchKeyword = "";

// Save functions to persist in localStorage
function saveProducts() {
  localStorage.setItem("inventory_products", JSON.stringify(products));
}

function saveBills() {
  localStorage.setItem("inventory_bills", JSON.stringify(bills));
}

// Currency formatting helper: prepends ₹ and formats in Indian number format (en-IN)
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ==========================================
// 2. DOM Elements Selection
// ==========================================

// Authentication & Access Control Elements
const loginScreen = document.getElementById("loginScreen");
const appDashboard = document.getElementById("appDashboard");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loggedUserDisplay = document.getElementById("loggedUserDisplay");

// Tab navigation buttons & content
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Inventory Form & Elements
const productForm = document.getElementById("productForm");
const formTitle = document.getElementById("formTitle");
const editProductId = document.getElementById("editProductId");
const productNameInput = document.getElementById("productName");
const productPriceInput = document.getElementById("productPrice");
const productStockInput = document.getElementById("productStock");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const searchInput = document.getElementById("searchInput");
const productTableBody = document.getElementById("productTableBody");
const noResultsDiv = document.getElementById("noResults");

// Summary statistics elements
const statTotalProducts = document.getElementById("statTotalProducts");
const statTotalStock = document.getElementById("statTotalStock");
const statTotalValue = document.getElementById("statTotalValue");

// Billing section elements
const billingProductSearch = document.getElementById("billingProductSearch");
const billingProductSelect = document.getElementById("billingProductSelect");
const previewUnitPrice = document.getElementById("previewUnitPrice");
const previewAvailableStock = document.getElementById("previewAvailableStock");
const billingQuantity = document.getElementById("billingQuantity");
const addToBillBtn = document.getElementById("addToBillBtn");
const billItemsTableBody = document.getElementById("billItemsTableBody");
const emptyBillMessage = document.getElementById("emptyBillMessage");
const currentBillItemCount = document.getElementById("currentBillItemCount");
const billTotalQty = document.getElementById("billTotalQty");
const billGrandTotal = document.getElementById("billGrandTotal");
const completeBillBtn = document.getElementById("completeBillBtn");
const clearBillBtn = document.getElementById("clearBillBtn");

// Customer details inputs
const customerNameInput = document.getElementById("customerName");
const customerPhoneInput = document.getElementById("customerPhone");

// Bill history elements
const historySearchInput = document.getElementById("historySearchInput");
const billHistoryTableBody = document.getElementById("billHistoryTableBody");
const emptyHistoryMessage = document.getElementById("emptyHistoryMessage");

// Receipt Modal & Print elements
const receiptModal = document.getElementById("receiptModal");
const whatsappBillBtn = document.getElementById("whatsappBillBtn");
const printBillBtn = document.getElementById("printBillBtn");
const closeReceiptBtn = document.getElementById("closeReceiptBtn");
const receiptBillNo = document.getElementById("receiptBillNo");
const receiptDate = document.getElementById("receiptDate");
const receiptTime = document.getElementById("receiptTime");
const receiptCustomerName = document.getElementById("receiptCustomerName");
const receiptTableBody = document.getElementById("receiptTableBody");
const receiptTotalItems = document.getElementById("receiptTotalItems");
const receiptGrandTotal = document.getElementById("receiptGrandTotal");

// ==========================================
// 3. Tab Switching Navigation
// ==========================================

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTabId = btn.getAttribute("data-tab");

    // Toggle active tab buttons
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Toggle tab panels
    tabContents.forEach((content) => {
      if (content.id === targetTabId) {
        content.classList.remove("hidden");
        content.classList.add("active");
      } else {
        content.classList.add("hidden");
        content.classList.remove("active");
      }
    });

    // Refresh tab-specific data when tab opens
    if (targetTabId === "billingTab") {
      populateBillingProducts();
    } else if (targetTabId === "historyTab") {
      renderBillHistory();
    } else if (targetTabId === "inventoryTab") {
      renderTable();
    }
  });
});

// ==========================================
// 4. Inventory Logic (Preserved & Enhanced)
// ==========================================

// Calculate and update the top summary statistics cards
function updateStats() {
  const totalProducts = products.length;
  const totalStock = products.reduce((acc, item) => acc + Number(item.stock), 0);
  const totalValue = products.reduce(
    (acc, item) => acc + Number(item.price) * Number(item.stock),
    0
  );

  statTotalProducts.textContent = totalProducts;
  statTotalStock.textContent = totalStock;
  statTotalValue.textContent = formatCurrency(totalValue);
}

// Determine stock badge status
function getStockBadge(stock) {
  if (stock <= 0) {
    return `<span class="badge badge-out-of-stock">Out of Stock</span>`;
  } else if (stock <= 5) {
    return `<span class="badge badge-low-stock">Low Stock (${stock})</span>`;
  } else {
    return `<span class="badge badge-in-stock">In Stock</span>`;
  }
}

// Render the main Inventory table
function renderTable() {
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchKeyword.toLowerCase().trim())
  );

  productTableBody.innerHTML = "";

  if (filteredProducts.length === 0) {
    noResultsDiv.classList.remove("hidden");
  } else {
    noResultsDiv.classList.add("hidden");

    filteredProducts.forEach((product, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(product.name)}</strong></td>
        <td>${formatCurrency(product.price)}</td>
        <td>
          <div class="stock-control">
            <button class="btn-qty" onclick="adjustStock('${product.id}', -1)" title="Decrease stock">-</button>
            <span>${product.stock}</span>
            <button class="btn-qty" onclick="adjustStock('${product.id}', 1)" title="Increase stock">+</button>
          </div>
        </td>
        <td>${getStockBadge(product.stock)}</td>
        <td>
          <button class="btn btn-sm btn-edit" onclick="editProduct('${product.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-delete" onclick="deleteProduct('${product.id}')">🗑️ Delete</button>
        </td>
      `;

      productTableBody.appendChild(row);
    });
  }

  updateStats();
}

// Escape HTML characters to avoid any injection
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Handle Inventory Form Submission (Add / Update Product)
productForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const name = productNameInput.value.trim();
  const price = parseFloat(productPriceInput.value);
  const stock = parseInt(productStockInput.value, 10);
  const currentEditId = editProductId.value;

  if (!name || isNaN(price) || isNaN(stock)) {
    alert("Please fill in all fields with valid values.");
    return;
  }

  if (currentEditId) {
    // Updating existing product
    products = products.map((prod) => {
      if (prod.id === currentEditId) {
        return { ...prod, name, price, stock };
      }
      return prod;
    });
    resetForm();
  } else {
    // Adding new product
    const newProduct = {
      id: Date.now().toString(),
      name,
      price,
      stock,
    };
    products.unshift(newProduct);
    productForm.reset();
  }

  saveProducts();
  renderTable();
  populateBillingProducts(); // Keep billing selector in sync
});

// Edit Product
window.editProduct = function (id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  editProductId.value = product.id;
  productNameInput.value = product.name;
  productPriceInput.value = product.price;
  productStockInput.value = product.stock;

  formTitle.textContent = "Edit Product";
  submitBtn.textContent = "💾 Save Changes";
  cancelBtn.classList.remove("hidden");

  productNameInput.focus();
};

// Cancel Edit Mode
cancelBtn.addEventListener("click", resetForm);

function resetForm() {
  editProductId.value = "";
  productForm.reset();
  formTitle.textContent = "Add New Product";
  submitBtn.textContent = "+ Add Product";
  cancelBtn.classList.add("hidden");
}

// Delete Product
window.deleteProduct = function (id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;

  if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
    products = products.filter((p) => p.id !== id);

    if (editProductId.value === id) {
      resetForm();
    }

    saveProducts();
    renderTable();
    populateBillingProducts();
  }
};

// Quick Stock Increment / Decrement (+ / -) in Inventory Table
window.adjustStock = function (id, amount) {
  products = products.map((product) => {
    if (product.id === id) {
      const newStock = Math.max(0, Number(product.stock) + amount);
      return { ...product, stock: newStock };
    }
    return product;
  });

  saveProducts();
  renderTable();
  populateBillingProducts();
};

// Real-time Inventory Search Filter
searchInput.addEventListener("input", function (e) {
  searchKeyword = e.target.value;
  renderTable();
});

// ========================================================
// 5. Billing Section Logic (POS & Stock-Safe Validation)
// ========================================================

// Populate product selection dropdown for billing
function populateBillingProducts() {
  const query = billingSearchKeyword.toLowerCase().trim();
  const matchingProducts = products.filter((p) =>
    p.name.toLowerCase().includes(query)
  );

  billingProductSelect.innerHTML = "";

  if (matchingProducts.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No products found";
    billingProductSelect.appendChild(opt);
    previewUnitPrice.textContent = "₹0.00";
    previewAvailableStock.textContent = "0 units";
    return;
  }

  matchingProducts.forEach((product) => {
    const opt = document.createElement("option");
    opt.value = product.id;
    const stockNote = product.stock > 0 ? `Stock: ${product.stock}` : `OUT OF STOCK`;
    opt.textContent = `${product.name} — ${formatCurrency(product.price)} (${stockNote})`;
    billingProductSelect.appendChild(opt);
  });

  updateSelectedProductPreview();
}

// Update the preview info box when a user selects a product in dropdown
function updateSelectedProductPreview() {
  const selectedId = billingProductSelect.value;
  const product = products.find((p) => p.id === selectedId);

  if (!product) {
    previewUnitPrice.textContent = "₹0.00";
    previewAvailableStock.textContent = "0 units";
    return;
  }

  previewUnitPrice.textContent = formatCurrency(product.price);
  previewAvailableStock.textContent = `${product.stock} units`;

  if (product.stock <= 0) {
    previewAvailableStock.innerHTML = `<span style="color:var(--danger-color)">0 units (Out of Stock)</span>`;
  } else {
    previewAvailableStock.textContent = `${product.stock} units available`;
  }
}

// Listen to selection changes & search in billing
billingProductSelect.addEventListener("change", updateSelectedProductPreview);

billingProductSearch.addEventListener("input", function (e) {
  billingSearchKeyword = e.target.value;
  populateBillingProducts();
});

// Add Item to Current Bill (RULE: DOES NOT DEDUCT STOCK HERE!)
addToBillBtn.addEventListener("click", function () {
  const selectedId = billingProductSelect.value;
  const quantity = parseInt(billingQuantity.value, 10);

  if (!selectedId) {
    alert("Please select a product first.");
    return;
  }

  const product = products.find((p) => p.id === selectedId);
  if (!product) {
    alert("Selected product could not be found.");
    return;
  }

  if (isNaN(quantity) || quantity <= 0) {
    alert("Please enter a valid quantity of 1 or more.");
    return;
  }

  // Check available stock
  if (product.stock <= 0) {
    alert(`Cannot add "${product.name}". This product is out of stock!`);
    return;
  }

  // Check how many are already added to current bill
  const existingItem = currentBill.find((item) => item.id === product.id);
  const alreadyInBill = existingItem ? existingItem.quantity : 0;
  const totalDesired = alreadyInBill + quantity;

  if (totalDesired > product.stock) {
    const remainingCanAdd = product.stock - alreadyInBill;
    if (remainingCanAdd <= 0) {
      alert(`Cannot add more. You already have all ${product.stock} available units in the bill!`);
    } else {
      alert(`Cannot add ${quantity} units. Only ${remainingCanAdd} more unit(s) available in stock.`);
    }
    return;
  }

  // Update existing item in bill or push new line item
  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.lineTotal = existingItem.quantity * existingItem.price;
  } else {
    currentBill.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: quantity,
      lineTotal: quantity * Number(product.price),
    });
  }

  // Reset quantity input to 1
  billingQuantity.value = "1";

  // Re-render current bill table
  renderCurrentBill();
});

// Render the Current Bill table and live grand total
function renderCurrentBill() {
  billItemsTableBody.innerHTML = "";

  if (currentBill.length === 0) {
    emptyBillMessage.classList.remove("hidden");
    currentBillItemCount.textContent = "0 Items";
    billTotalQty.textContent = "0";
    billGrandTotal.textContent = "₹0.00";
    completeBillBtn.disabled = true;
    return;
  }

  emptyBillMessage.classList.add("hidden");
  completeBillBtn.disabled = false;

  let totalQty = 0;
  let grandTotal = 0;

  currentBill.forEach((item) => {
    totalQty += item.quantity;
    grandTotal += item.lineTotal;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${formatCurrency(item.price)}</td>
      <td>
        <div class="stock-control">
          <button class="btn-qty" onclick="adjustBillQty('${item.id}', -1)" title="Decrease">-</button>
          <span><strong>${item.quantity}</strong></span>
          <button class="btn-qty" onclick="adjustBillQty('${item.id}', 1)" title="Increase">+</button>
        </div>
      </td>
      <td>${formatCurrency(item.lineTotal)}</td>
      <td>
        <button class="btn btn-sm btn-delete" onclick="removeFromBill('${item.id}')" title="Remove item">✕</button>
      </td>
    `;
    billItemsTableBody.appendChild(row);
  });

  currentBillItemCount.textContent = `${currentBill.length} Item${currentBill.length > 1 ? "s" : ""}`;
  billTotalQty.textContent = totalQty;
  billGrandTotal.textContent = formatCurrency(grandTotal);
}

// Adjust quantity within current bill (+ / -)
window.adjustBillQty = function (productId, delta) {
  const billItem = currentBill.find((item) => item.id === productId);
  const product = products.find((p) => p.id === productId);
  if (!billItem || !product) return;

  if (delta > 0) {
    if (billItem.quantity + 1 > product.stock) {
      alert(`Cannot add more. Only ${product.stock} units available in inventory stock.`);
      return;
    }
    billItem.quantity += 1;
    billItem.lineTotal = billItem.quantity * billItem.price;
  } else if (delta < 0) {
    billItem.quantity -= 1;
    if (billItem.quantity <= 0) {
      // Remove item if quantity reaches 0
      currentBill = currentBill.filter((item) => item.id !== productId);
    } else {
      billItem.lineTotal = billItem.quantity * billItem.price;
    }
  }

  renderCurrentBill();
};

// Remove single item from current bill
window.removeFromBill = function (productId) {
  currentBill = currentBill.filter((item) => item.id !== productId);
  renderCurrentBill();
};

// Clear entire current bill & customer inputs
clearBillBtn.addEventListener("click", function () {
  if (currentBill.length === 0 && !customerNameInput.value && !customerPhoneInput.value) return;
  if (confirm("Are you sure you want to clear the current bill?")) {
    currentBill = [];
    customerNameInput.value = "";
    customerPhoneInput.value = "";
    renderCurrentBill();
  }
});

// ========================================================
// 6. Complete Bill: Stock Deduction & Invoice Generation
// ========================================================

completeBillBtn.addEventListener("click", function () {
  // Prevent duplicate stock deductions from repeated clicks
  if (isCompletingBill) return;

  if (currentBill.length === 0) {
    alert("Cannot complete an empty bill. Please add products first.");
    return;
  }

  // Lock button and set processing state
  isCompletingBill = true;
  completeBillBtn.disabled = true;
  completeBillBtn.textContent = "⏳ Completing Bill...";

  // 1. Strict Stock Validation: Verify all items against latest stock
  for (const item of currentBill) {
    const product = products.find((p) => p.id === item.id);
    if (!product) {
      alert(`Error: Product "${item.name}" was not found in inventory.`);
      unlockCompleteButton();
      return;
    }
    if (product.stock < item.quantity) {
      alert(
        `Insufficient stock for "${item.name}". Available: ${product.stock}, required: ${item.quantity}. Please adjust the bill.`
      );
      unlockCompleteButton();
      return;
    }
  }

  // 2. Reduce Stock in Inventory
  currentBill.forEach((item) => {
    const product = products.find((p) => p.id === item.id);
    if (product) {
      product.stock -= item.quantity;
    }
  });

  // 3. Generate unique Bill Number & metadata
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Unique bill number format: INV-YEAR-NUMBER (e.g. INV-2026-0001)
  const billCount = bills.length + 1;
  const uniqueBillNumber = `INV-${now.getFullYear()}-${String(billCount).padStart(4, "0")}`;

  const grandTotal = currentBill.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalItems = currentBill.reduce((sum, item) => sum + item.quantity, 0);

  const completedBill = {
    billNumber: uniqueBillNumber,
    date: dateFormatted,
    time: timeFormatted,
    timestamp: now.getTime(),
    customerName: customerNameInput.value.trim(),
    customerPhone: customerPhoneInput.value.trim(),
    items: JSON.parse(JSON.stringify(currentBill)),
    totalItems: totalItems,
    grandTotal: grandTotal,
  };

  // 4. Save to History and persist to LocalStorage
  bills.unshift(completedBill);
  saveProducts();
  saveBills();

  // 5. Update Inventory UI & Stats immediately
  renderTable();
  populateBillingProducts();
  renderBillHistory();

  // 6. Show clean Receipt Modal with Print & WhatsApp options
  showReceiptModal(completedBill);

  // 7. Clear current bill cart and reset customer inputs
  currentBill = [];
  customerNameInput.value = "";
  customerPhoneInput.value = "";
  renderCurrentBill();

  // Unlock button
  unlockCompleteButton();
});

function unlockCompleteButton() {
  isCompletingBill = false;
  completeBillBtn.disabled = currentBill.length === 0;
  completeBillBtn.textContent = "✅ Complete Bill & Deduct Stock";
}

// ========================================================
// 7. WhatsApp Receipt Formatting & Sharing Logic
// ========================================================

// Format & validate Indian 10-digit mobile number
function formatAndValidateIndianMobile(phoneInput) {
  if (!phoneInput) return null;
  let cleaned = phoneInput.toString().replace(/[\s\-\(\)\+]/g, "");

  // If starts with 0 and is 11 digits (e.g. 09876543210), strip leading 0
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If starts with 91 and has 12 digits (e.g. 919876543210)
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    const mobilePart = cleaned.substring(2);
    if (/^[6-9]\d{9}$/.test(mobilePart)) {
      return cleaned;
    }
  }

  // If exactly 10 digits starting with 6, 7, 8, 9 (standard Indian mobile)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `91${cleaned}`;
  }

  // Accept any 10-digit format as fallback
  if (/^\d{10}$/.test(cleaned)) {
    return `91${cleaned}`;
  }

  return null;
}

// Generate clean, formatted WhatsApp receipt text
function generateWhatsAppMessage(bill) {
  const storeName = "Surya Inventory & Billing";
  const customerName = bill.customerName && bill.customerName.trim()
    ? bill.customerName.trim()
    : "Valued Customer";

  const itemLines = bill.items
    .map((item, index) => {
      return `${index + 1}. *${item.name}*\n   ${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.lineTotal)}`;
    })
    .join("\n");

  return `🧾 *${storeName}*
----------------------------------------
*TAX INVOICE / CASH BILL*
*Bill No:* ${bill.billNumber}
*Date:* ${bill.date} (${bill.time})
*Customer:* ${customerName}
----------------------------------------
*ITEMS PURCHASED:*
${itemLines}
----------------------------------------
*Total Items:* ${bill.totalItems}
*Grand Total:* *${formatCurrency(bill.grandTotal)}*
----------------------------------------
Thank you for shopping with us! 🙏`;
}

// Open WhatsApp Click-to-Chat with validated phone and message
function shareBillOnWhatsApp(bill) {
  let phone = bill.customerPhone ? bill.customerPhone.trim() : "";

  if (!phone) {
    phone = prompt("Please enter the customer's 10-digit WhatsApp number:", "");
    if (!phone) return; // User cancelled prompt
  }

  const validPhone = formatAndValidateIndianMobile(phone);
  if (!validPhone) {
    alert("Please enter a valid 10-digit WhatsApp mobile number (e.g., 9876543210).");
    return;
  }

  // Persist phone back to bill if it was previously empty
  if (!bill.customerPhone) {
    bill.customerPhone = phone;
    saveBills();
    renderBillHistory();
  }

  const message = generateWhatsAppMessage(bill);
  const waUrl = `https://wa.me/${validPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
}

// ========================================================
// 8. Receipt Modal & Printing
// ========================================================

function showReceiptModal(bill) {
  currentModalBill = bill;

  receiptBillNo.textContent = bill.billNumber;
  receiptDate.textContent = bill.date;
  receiptTime.textContent = bill.time;
  receiptTotalItems.textContent = bill.totalItems;
  receiptGrandTotal.textContent = formatCurrency(bill.grandTotal);

  if (receiptCustomerName) {
    if (bill.customerName && bill.customerPhone) {
      receiptCustomerName.textContent = `${bill.customerName} (${bill.customerPhone})`;
    } else if (bill.customerName) {
      receiptCustomerName.textContent = bill.customerName;
    } else if (bill.customerPhone) {
      receiptCustomerName.textContent = `Customer (${bill.customerPhone})`;
    } else {
      receiptCustomerName.textContent = "Valued Customer";
    }
  }

  receiptTableBody.innerHTML = "";
  bill.items.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td class="text-right">${formatCurrency(item.price)}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">${formatCurrency(item.lineTotal)}</td>
    `;
    receiptTableBody.appendChild(row);
  });

  receiptModal.classList.remove("hidden");
}

// WhatsApp Share Button in Receipt Modal
whatsappBillBtn.addEventListener("click", () => {
  if (!currentModalBill) return;
  shareBillOnWhatsApp(currentModalBill);
});

// Close Receipt Modal
closeReceiptBtn.addEventListener("click", () => {
  receiptModal.classList.add("hidden");
});

// Close modal if clicked outside modal-card
receiptModal.addEventListener("click", (e) => {
  if (e.target === receiptModal) {
    receiptModal.classList.add("hidden");
  }
});

// Print Receipt
printBillBtn.addEventListener("click", () => {
  window.print();
});

// ========================================================
// 9. Bill History Logic (Read-Only: Never reduces stock)
// ========================================================

function renderBillHistory() {
  const query = historySearchKeyword.toLowerCase().trim();
  const filteredBills = bills.filter((b) =>
    b.billNumber.toLowerCase().includes(query) ||
    (b.customerName && b.customerName.toLowerCase().includes(query)) ||
    (b.customerPhone && b.customerPhone.includes(query))
  );

  billHistoryTableBody.innerHTML = "";

  if (filteredBills.length === 0) {
    emptyHistoryMessage.classList.remove("hidden");
    return;
  }

  emptyHistoryMessage.classList.add("hidden");

  filteredBills.forEach((bill) => {
    let customerDisplay = bill.customerName ? escapeHtml(bill.customerName) : "";
    if (bill.customerPhone) {
      customerDisplay += customerDisplay
        ? ` <br><small style="color:var(--text-muted)">📱 ${escapeHtml(bill.customerPhone)}</small>`
        : `📱 ${escapeHtml(bill.customerPhone)}`;
    }
    if (!customerDisplay) {
      customerDisplay = `<span style="color:var(--text-muted)">Walk-in</span>`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(bill.billNumber)}</strong></td>
      <td>${bill.date} <small style="color:var(--text-muted)">(${bill.time})</small></td>
      <td>${customerDisplay}</td>
      <td>${bill.totalItems}</td>
      <td><strong>${formatCurrency(bill.grandTotal)}</strong></td>
      <td>
        <div class="history-actions">
          <button class="btn btn-sm btn-edit" onclick="viewHistoricalBill('${bill.billNumber}')">
            👁️ View / Print
          </button>
          <button class="btn btn-sm btn-whatsapp" onclick="shareHistoricalBillWhatsApp('${bill.billNumber}')">
            📲 WhatsApp
          </button>
        </div>
      </td>
    `;
    billHistoryTableBody.appendChild(row);
  });
}

// View an old bill in the receipt modal (strictly read-only; no stock is changed!)
window.viewHistoricalBill = function (billNumber) {
  const bill = bills.find((b) => b.billNumber === billNumber);
  if (!bill) {
    alert("Bill details not found.");
    return;
  }
  showReceiptModal(bill);
};

// Share an old bill directly on WhatsApp from Bill History table
window.shareHistoricalBillWhatsApp = function (billNumber) {
  const bill = bills.find((b) => b.billNumber === billNumber);
  if (!bill) {
    alert("Bill details not found.");
    return;
  }
  shareBillOnWhatsApp(bill);
};

// Search filter for Bill History (search by Bill #, Customer Name, or Phone)
historySearchInput.addEventListener("input", function (e) {
  historySearchKeyword = e.target.value;
  renderBillHistory();
});

// ========================================================
// 10. Authentication & Access Control Logic
// ========================================================

// Check if user session exists and is active
function isAuthenticated() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY));
    return session && session.isLoggedIn === true;
  } catch (e) {
    return false;
  }
}

// Access Control: Show login screen if not authenticated, otherwise show dashboard
function checkAuthState() {
  if (isAuthenticated()) {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appDashboard) appDashboard.classList.remove("hidden");
    try {
      const session = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (loggedUserDisplay && session) {
        loggedUserDisplay.textContent = session.username || DEFAULT_USER;
      }
    } catch (e) {}
  } else {
    if (appDashboard) appDashboard.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (loginPassword) loginPassword.value = "";
    if (loginError) loginError.classList.add("hidden");
    if (receiptModal) receiptModal.classList.add("hidden");
  }
}

// Handle Login Form Submission
if (loginForm) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (username === DEFAULT_USER && password === DEFAULT_PASS) {
      // Valid credentials: save session
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          isLoggedIn: true,
          username: username,
          loginTime: Date.now(),
        })
      );
      if (loginError) loginError.classList.add("hidden");
      loginForm.reset();
      checkAuthState();
    } else {
      // Invalid credentials: show friendly error
      if (loginError) {
        loginError.classList.remove("hidden");
        loginError.textContent = "⚠️ Invalid username or password. Please try again.";
      }
      loginPassword.value = "";
      loginPassword.focus();
    }
  });
}

// Show / Hide Password Toggle
if (togglePasswordBtn && loginPassword) {
  togglePasswordBtn.addEventListener("click", function () {
    const isPassword = loginPassword.getAttribute("type") === "password";
    loginPassword.setAttribute("type", isPassword ? "text" : "password");
    togglePasswordBtn.textContent = isPassword ? "🙈" : "👁️";
  });
}

// Handle Logout Button
if (logoutBtn) {
  logoutBtn.addEventListener("click", function () {
    if (confirm("Are you sure you want to log out of your session?")) {
      localStorage.removeItem(AUTH_KEY);
      checkAuthState();
    }
  });
}

// ========================================================
// 11. Initial Load on Page Startup
// ========================================================
renderTable();
populateBillingProducts();
renderCurrentBill();
renderBillHistory();
checkAuthState();
