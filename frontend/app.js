// CreatorFlow - Single Page Application Business Logic & Interactions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Firebase App State
let app = null;
let auth = null;
let firestoreDb = null;
let currentUser = null;

const isFirebaseConfigured = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        // Set persistence to session (clears session when browser tab is closed)
        setPersistence(auth, browserSessionPersistence)
            .catch((err) => console.error("Error setting persistence:", err));
        firestoreDb = getFirestore(app);
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
}

// Global State Object
let state = {
    profile: {
        name: "",
        niche: "",
        bio: "",
        youtubeUrl: "",
        instagramUrl: "",
        youtubeSubs: 0,
        instagramFollowers: 0,
        avgViews: 0,
        engagementRate: 0.0,
        rateDedicated: 0,
        rateIntegrated: 0
    },
    invoices: [],
    campaigns: [],
    dmConfig: {
        varA: "Hey {name}! Thanks for joining. What type of content interests you the most?",
        varB: "Welcome aboard, {name}! Glad to connect. Let me know if you need help with creator resources.",
        varC: "Hello {name}! Thanks for the follow. I post weekly tutorials. Let me know your feedback!",
        delay: "15"
    },
    activeReminderInvoiceId: null,
    activeReminderType: 'polite'
};

function getStorageKey() {
    return currentUser ? `creatorflow_state_${currentUser.uid}` : 'creatorflow_state_anonymous';
}

function resetStateToDefault() {
    state = {
        profile: {
            name: "",
            niche: "",
            bio: "",
            youtubeUrl: "",
            instagramUrl: "",
            youtubeSubs: 0,
            instagramFollowers: 0,
            avgViews: 0,
            engagementRate: 0.0,
            rateDedicated: 0,
            rateIntegrated: 0
        },
        invoices: [],
        campaigns: [],
        dmConfig: {
            varA: "Hey {name}! Thanks for joining. What type of content interests you the most?",
            varB: "Welcome aboard, {name}! Glad to connect. Let me know if you need help with creator resources.",
            varC: "Hello {name}! Thanks for the follow. I post weekly tutorials. Let me know your feedback!",
            delay: "15"
        },
        activeReminderInvoiceId: null,
        activeReminderType: 'polite'
    };
}

// Load State from LocalStorage and Firestore
async function loadState() {
    // Reset memory state first to avoid cross-user pollution
    resetStateToDefault();

    // 1. Try local storage first to render immediately
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse saved state", e);
        }
    }
    
    // 2. If signed in, fetch from Firestore
    if (currentUser && firestoreDb) {
        try {
            const userDocRef = doc(firestoreDb, "users", currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                state.profile = cloudData.profile || state.profile;
                state.invoices = cloudData.invoices || [];
                state.campaigns = cloudData.campaigns || [];
                state.dmConfig = cloudData.dmConfig || state.dmConfig;
                
                // Fallback to Google display name or email prefix if name in Firestore is empty
                if (!state.profile.name) {
                    state.profile.name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : "") || "Creator";
                    await saveState();
                }
                localStorage.setItem(getStorageKey(), JSON.stringify(state));
            } else {
                // If doc doesn't exist (new user), create it using current local state
                if (!state.profile.name) {
                    state.profile.name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : "") || "Creator";
                }
                await saveState();
            }
        } catch (e) {
            console.error("Error loading state from Firestore:", e);
        }
    }
}

// Save State to LocalStorage and Firestore
async function saveState() {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
    
    if (currentUser && firestoreDb) {
        try {
            const userDocRef = doc(firestoreDb, "users", currentUser.uid);
            await setDoc(userDocRef, {
                profile: state.profile,
                invoices: state.invoices,
                campaigns: state.campaigns,
                dmConfig: state.dmConfig
            });
        } catch (e) {
            console.error("Error saving state to Firestore:", e);
        }
    }
}

// Formatting Utilities
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Navigation & Tab Controller
function navigateToTab(tabId) {
    // Hide all tab sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });

    // Deactivate all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show the target section
    const targetSection = document.getElementById(tabId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Activate current link
    const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
    }

    // Update Header title
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    switch (tabId) {
        case 'dashboard':
            pageTitle.innerText = "Dashboard Overview";
            pageSubtitle.innerText = "Monitor your revenue, pending deliverables, and business metrics.";
            renderDashboard();
            break;
        case 'invoices':
            pageTitle.innerText = "Invoice & GST Tracker";
            pageSubtitle.innerText = "Create GST-compliant invoices and track due balances.";
            initializeInvoiceForm();
            renderInvoices();
            updateReminderTemplate();
            break;
        case 'mediakit':
            pageTitle.innerText = "Automated Pitching & Media Kit";
            pageSubtitle.innerText = "Directly update social stats and compile high-converting brand pitches.";
            initializeMediaKitForm();
            break;
        case 'branding':
            pageTitle.innerText = "Minimalist Branding Pack";
            pageSubtitle.innerText = "Clean, professional HTML/CSS overlay templates for your content style.";
            break;
        case 'campaigns':
            pageTitle.innerText = "Sponsored Content Planner";
            pageSubtitle.innerText = "Organize upcoming sponsor deliverables and checklist timelines.";
            renderCampaigns();
            break;
    }
}

// Initialize Navigation Links Event Listeners
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        navigateToTab(tabId);
    });
});

/* ==========================================================================
   Dashboard Logic
   ========================================================================== */
function renderDashboard() {
    // Calculate Stats
    let totalRevenue = 0;
    let pendingPayments = 0;
    let activeCampaignsCount = 0;

    state.invoices.forEach(inv => {
        if (inv.status === 'paid') {
            totalRevenue += inv.totalAmount;
        } else {
            pendingPayments += inv.totalAmount;
        }
    });

    state.campaigns.forEach(camp => {
        if (camp.status !== 'cleared') {
            activeCampaignsCount++;
        }
    });

    // Est GST (18%) on Total Income (rough approximation)
    const gstOwed = totalRevenue * 0.18;

    // Update UI elements
    document.getElementById('dashboard-total-revenue').innerText = formatCurrency(totalRevenue);
    document.getElementById('dashboard-pending-payments').innerText = formatCurrency(pendingPayments);
    document.getElementById('dashboard-gst-owed').innerText = formatCurrency(gstOwed);
    document.getElementById('dashboard-active-campaigns').innerText = activeCampaignsCount;

    // Render Critical Deadlines (Campaigns not cleared, sorted by date)
    const deadlinesList = document.getElementById('dashboard-campaign-deadlines');
    deadlinesList.innerHTML = '';

    const activeCampaigns = state.campaigns
        .filter(camp => camp.status !== 'cleared')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (activeCampaigns.length === 0) {
        deadlinesList.innerHTML = `<div class="no-data-msg">No active campaigns scheduled. Add them in the Campaign Tracker.</div>`;
    } else {
        // Take top 3 closest deadlines
        activeCampaigns.slice(0, 3).forEach(camp => {
            const dateStr = formatDate(camp.deadline);
            const statusLabel = getStatusLabelText(camp.status);
            
            const item = document.createElement('div');
            item.className = 'deadline-item';
            item.innerHTML = `
                <div class="deadline-item-left">
                    <span class="deadline-item-title">${camp.title}</span>
                    <span class="deadline-item-brand">${camp.brand} • ${formatCurrency(camp.amount)}</span>
                </div>
                <div class="deadline-item-right">
                    <span class="deadline-item-date">${dateStr}</span>
                    <span class="deadline-item-status">${statusLabel}</span>
                </div>
            `;
            deadlinesList.appendChild(item);
        });
    }

}

function getStatusLabelText(status) {
    switch (status) {
        case 'signed': return 'Brief Received';
        case 'script': return 'Script Stage';
        case 'draft': return 'Draft Review';
        case 'published': return 'Published';
        case 'cleared': return 'Completed';
        default: return status;
    }
}

/* ==========================================================================
   Invoicing & GST Logic
   ========================================================================== */
function initializeInvoiceForm() {
    // Set current date on form
    const dateInput = document.getElementById('inv-date');
    if (dateInput && !dateInput.value) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Set Default invoice number based on counter
    const invNumInput = document.getElementById('inv-number');
    if (invNumInput && !invNumInput.value) {
        const count = state.invoices.length + 1;
        invNumInput.value = `CF-2026-${String(count).padStart(3, '0')}`;
    }

    // Prefill creator name from profile
    document.getElementById('inv-creator-name').value = state.profile.name;

    // Add Live Recalculations on inputs
    const basePriceInput = document.getElementById('inv-item-price');
    const gstRateSelect = document.getElementById('inv-gst-rate');
    const creatorStateSelect = document.getElementById('inv-creator-state');
    const brandStateSelect = document.getElementById('inv-brand-state');

    const recalculateInvoicePrice = () => {
        const basePrice = parseFloat(basePriceInput.value) || 0;
        const gstRate = parseFloat(gstRateSelect.value) || 0;
        const creatorState = creatorStateSelect.value;
        const brandState = brandStateSelect.value;

        const taxAmount = basePrice * (gstRate / 100);
        const grandTotal = basePrice + taxAmount;

        document.getElementById('calc-base').innerText = formatCurrency(basePrice);
        
        const labelEl = document.getElementById('calc-tax-label');
        const mechanismNote = document.getElementById('gst-mechanism-note');

        if (gstRate === 0) {
            labelEl.innerText = "No GST (0%):";
            mechanismNote.innerText = "No tax is computed. Suitable for unregistered micro-dealers.";
        } else if (creatorState === brandState) {
            // Intra-state: CGST (9%) + SGST (9%)
            const splitTax = taxAmount / 2;
            labelEl.innerText = `CGST (${gstRate/2}%) + SGST (${gstRate/2}%):`;
            mechanismNote.innerText = `Intra-state deal detected (Both in ${creatorState}). Applied CGST: ${formatCurrency(splitTax)} & SGST: ${formatCurrency(splitTax)}.`;
        } else {
            // Inter-state: IGST (18%)
            labelEl.innerText = `IGST (${gstRate}%):`;
            mechanismNote.innerText = `Inter-state deal detected (${creatorState} to ${brandState}). Applied Integrated GST (IGST) in full.`;
        }

        document.getElementById('calc-tax').innerText = formatCurrency(taxAmount);
        document.getElementById('calc-total').innerText = formatCurrency(grandTotal);
    };

    basePriceInput.addEventListener('input', recalculateInvoicePrice);
    gstRateSelect.addEventListener('change', recalculateInvoicePrice);
    creatorStateSelect.addEventListener('change', recalculateInvoicePrice);
    brandStateSelect.addEventListener('change', recalculateInvoicePrice);

    // Initial Trigger
    recalculateInvoicePrice();
}

// Invoice Submit Listener
document.getElementById('invoice-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const basePrice = parseFloat(document.getElementById('inv-item-price').value) || 0;
    const gstRate = parseFloat(document.getElementById('inv-gst-rate').value) || 0;
    const taxAmount = basePrice * (gstRate / 100);
    const totalAmount = basePrice + taxAmount;

    const newInvoice = {
        id: "inv-" + Date.now(),
        number: document.getElementById('inv-number').value,
        date: document.getElementById('inv-date').value,
        creatorName: document.getElementById('inv-creator-name').value,
        creatorState: document.getElementById('inv-creator-state').value,
        creatorGSTIN: document.getElementById('inv-creator-gstin').value,
        brandName: document.getElementById('inv-brand-name').value,
        brandState: document.getElementById('inv-brand-state').value,
        brandGSTIN: document.getElementById('inv-brand-gstin').value,
        itemDesc: document.getElementById('inv-item-desc').value,
        itemPrice: basePrice,
        gstRate: gstRate,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        status: "pending" // Default state
    };

    // Add to state and save
    state.invoices.unshift(newInvoice);
    saveState();

    // Reset Form Fields
    document.getElementById('inv-item-desc').value = '';
    document.getElementById('inv-item-price').value = '';
    
    // Refresh Form state & Re-render Log
    initializeInvoiceForm();
    renderInvoices();
    alert("Invoice generated and saved successfully!");
});

function renderInvoices() {
    const tbody = document.getElementById('invoice-list-tbody');
    tbody.innerHTML = '';

    if (state.invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No invoices generated yet.</td></tr>`;
        return;
    }

    state.invoices.forEach(inv => {
        const row = document.createElement('tr');
        
        let statusBadgeClass = 'pending';
        if (inv.status === 'paid') statusBadgeClass = 'paid';
        if (inv.status === 'overdue') statusBadgeClass = 'overdue';

        row.innerHTML = `
            <td><strong>${inv.number}</strong></td>
            <td>
                <div class="table-brand-details">
                    <span class="brand-row-name">${inv.brandName}</span>
                    <span class="brand-row-date">${formatDate(inv.date)}</span>
                </div>
            </td>
            <td>${formatCurrency(inv.totalAmount)}</td>
            <td><span class="badge-status ${statusBadgeClass}">${inv.status}</span></td>
            <td class="actions-cell">
                <button class="btn btn-secondary btn-sm" onclick="viewInvoice('${inv.id}')" title="Print/View PDF"><i class="fa-solid fa-eye"></i></button>
                ${inv.status !== 'paid' ? `<button class="btn btn-secondary btn-sm" onclick="markInvoicePaid('${inv.id}')" title="Mark Paid"><i class="fa-solid fa-check"></i></button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="selectInvoiceForReminder('${inv.id}')" title="Generate Reminder Message"><i class="fa-solid fa-message"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function markInvoicePaid(id) {
    const inv = state.invoices.find(item => item.id === id);
    if (inv) {
        inv.status = 'paid';
        saveState();
        renderInvoices();
        renderDashboard();
    }
}

function deleteInvoice(id) {
    if (confirm("Are you sure you want to delete this invoice?")) {
        state.invoices = state.invoices.filter(item => item.id !== id);
        saveState();
        renderInvoices();
        renderDashboard();
    }
}

function viewInvoice(id) {
    const inv = state.invoices.find(item => item.id === id);
    if (!inv) return;

    const modalBody = document.getElementById('invoice-print-area-content');
    
    // Split CGST/SGST vs IGST for display
    let taxBreakdownHTML = '';
    if (inv.gstRate > 0) {
        if (inv.creatorState === inv.brandState) {
            const splitRate = inv.gstRate / 2;
            const splitTax = inv.taxAmount / 2;
            taxBreakdownHTML = `
                <div class="totals-row">
                    <span>CGST (${splitRate}%):</span>
                    <span>${formatCurrency(splitTax)}</span>
                </div>
                <div class="totals-row">
                    <span>SGST (${splitRate}%):</span>
                    <span>${formatCurrency(splitTax)}</span>
                </div>
            `;
        } else {
            taxBreakdownHTML = `
                <div class="totals-row">
                    <span>IGST (${inv.gstRate}%):</span>
                    <span>${formatCurrency(inv.taxAmount)}</span>
                </div>
            `;
        }
    } else {
        taxBreakdownHTML = `
            <div class="totals-row">
                <span>Tax GST (0%):</span>
                <span>₹0.00</span>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="print-hdr">
            <div class="print-title-area">
                <h1>TAX INVOICE</h1>
                <p>Invoice No: <strong>${inv.number}</strong></p>
            </div>
            <div class="print-meta-grid">
                <p>Date: <strong>${formatDate(inv.date)}</strong></p>
                <p>Payment Term: <strong>Due on Receipt</strong></p>
            </div>
        </div>

        <div class="print-addresses">
            <div class="addr-block">
                <h4>Billed By (Creator)</h4>
                <p><strong>${inv.creatorName}</strong></p>
                <p>State: ${inv.creatorState}</p>
                ${inv.creatorGSTIN ? `<p>GSTIN: <code>${inv.creatorGSTIN}</code></p>` : '<p>GST Status: Unregistered</p>'}
            </div>
            <div class="addr-block">
                <h4>Billed To (Brand Client)</h4>
                <p><strong>${inv.brandName}</strong></p>
                <p>State: ${inv.brandState}</p>
                ${inv.brandGSTIN ? `<p>GSTIN: <code>${inv.brandGSTIN}</code></p>` : ''}
            </div>
        </div>

        <table class="print-table">
            <thead>
                <tr>
                    <th>Deliverable Description</th>
                    <th style="text-align: right;">Amount (Base)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${inv.itemDesc}</td>
                    <td style="text-align: right;">${formatCurrency(inv.itemPrice)}</td>
                </tr>
            </tbody>
        </table>

        <div class="print-totals">
            <div class="totals-inner">
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(inv.itemPrice)}</span>
                </div>
                ${taxBreakdownHTML}
                <div class="totals-row grand">
                    <span>Total Invoice Value:</span>
                    <span>${formatCurrency(inv.totalAmount)}</span>
                </div>
            </div>
        </div>

        <div class="gst-declaration">
            <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.</p>
            <p style="margin-top: 4px;">* This is a computer-generated tax invoice and does not require a physical signature.</p>
        </div>
    `;

    openModal('invoice-modal');
}

// Payment reminder templates logic
function selectInvoiceForReminder(id) {
    state.activeReminderInvoiceId = id;
    updateReminderTemplate();
}

function updateReminderTemplate() {
    const textBox = document.getElementById('reminder-text-box');
    const selectedId = state.activeReminderInvoiceId;

    if (!selectedId) {
        textBox.innerHTML = `<span style="color: var(--text-light)">Please click the chat message icon (💬) next to any invoice in the log above to pre-fill the templates.</span>`;
        return;
    }

    const inv = state.invoices.find(item => item.id === selectedId);
    if (!inv) {
        textBox.innerHTML = `<span style="color: var(--text-light)">Invoice not found.</span>`;
        return;
    }

    const amountStr = formatCurrency(inv.totalAmount);
    
    // Dynamic text configurations
    let reminderText = '';
    if (state.activeReminderType === 'polite') {
        reminderText = `Hi Team ${inv.brandName},

Hope you are doing well.

Just sending a gentle nudge regarding Invoice ${inv.number} (${amountStr}) for "${inv.itemDesc}", dated ${formatDate(inv.date)}. 

Please confirm if this has been processed for payment. Let me know if you need any other documents.

Best,
${inv.creatorName}`;
    } else if (state.activeReminderType === 'firm') {
        reminderText = `Hello Team ${inv.brandName},

I hope this is well received.

This is a follow-up for the pending payment of Invoice ${inv.number} for the amount of ${amountStr}. The invoice was raised on ${formatDate(inv.date)} and is currently past the standard credit terms.

Could you please share a quick update or payment receipt for the same?

Regards,
${inv.creatorName}`;
    } else if (state.activeReminderType === 'urgent') {
        reminderText = `Dear Accounts Team - ${inv.brandName},

This is an urgent request for payment update on Invoice ${inv.number} (${amountStr}). 

The deliverable "${inv.itemDesc}" has been live for over 14 days, and the invoice remains unpaid past due credit timelines. Please clear the outstanding balance at your earliest convenience to avoid contractual penalties.

Thank you for your cooperation.

Sincerely,
${inv.creatorName}`;
    }

    textBox.innerText = reminderText;
}

// Reminder Tabs Click Event Listeners
document.querySelectorAll('.reminder-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.reminder-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeReminderType = tab.getAttribute('data-reminder-type');
        updateReminderTemplate();
    });
});

// Copy Reminder Text Button
document.getElementById('copy-reminder-btn').addEventListener('click', () => {
    const text = document.getElementById('reminder-text-box').innerText;
    if (!state.activeReminderInvoiceId) {
        alert("Please select an invoice first!");
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert("Reminder message copied to clipboard!");
    });
});


/* ==========================================================================
   Media Kit & Pitch Logic
   ========================================================================== */
function populateMediaKitFormFromState() {
    const channelNameInput = document.getElementById('mk-channel-name');
    if (!channelNameInput) return; // Guard clause in case DOM is not ready
    
    channelNameInput.value = state.profile.name || "";
    document.getElementById('mk-niche').value = state.profile.niche || "";
    document.getElementById('mk-bio').value = state.profile.bio || "";
    document.getElementById('mk-youtube-url').value = state.profile.youtubeUrl || "";
    document.getElementById('mk-instagram-url').value = state.profile.instagramUrl || "";
    document.getElementById('mk-youtube-subs').value = state.profile.youtubeSubs || 0;
    document.getElementById('mk-instagram-followers').value = state.profile.instagramFollowers || 0;
    document.getElementById('mk-avg-views').value = state.profile.avgViews || 0;
    document.getElementById('mk-engagement-rate').value = state.profile.engagementRate || 0.0;
    document.getElementById('mk-rate-dedicated').value = state.profile.rateDedicated || 0;
    document.getElementById('mk-rate-integrated').value = state.profile.rateIntegrated || 0;
}

function initializeMediaKitForm() {
    const form = document.getElementById('mediakit-form');
    
    // Bind form changes to sync to preview in real-time
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        // Only bind input event listeners to non-button fields
        if (input.id !== 'btn-fetch-socials' && !input.dataset.bound) {
            input.addEventListener('input', syncMediaKitPreview);
            input.dataset.bound = "true";
        }
    });

    // Populate fields from state
    populateMediaKitFormFromState();

    syncMediaKitPreview();
}

function syncMediaKitPreview() {
    // Collect stats from form
    const name = document.getElementById('mk-channel-name').value;
    const niche = document.getElementById('mk-niche').value;
    const bio = document.getElementById('mk-bio').value;
    const youtubeUrl = document.getElementById('mk-youtube-url').value;
    const instagramUrl = document.getElementById('mk-instagram-url').value;
    const yt = parseInt(document.getElementById('mk-youtube-subs').value) || 0;
    const ig = parseInt(document.getElementById('mk-instagram-followers').value) || 0;
    const views = parseInt(document.getElementById('mk-avg-views').value) || 0;
    const engagement = parseFloat(document.getElementById('mk-engagement-rate').value) || 0;
    const rateDedicated = parseInt(document.getElementById('mk-rate-dedicated').value) || 0;
    const rateIntegrated = parseInt(document.getElementById('mk-rate-integrated').value) || 0;

    // Update State
    state.profile = {
        name, niche, bio,
        youtubeUrl, instagramUrl,
        youtubeSubs: yt,
        instagramFollowers: ig,
        avgViews: views,
        engagementRate: engagement,
        rateDedicated,
        rateIntegrated
    };
    saveState();

    // Render Preview
    document.getElementById('preview-name').innerText = name || "My Creator Channel";
    document.getElementById('preview-niche').innerText = niche || "Select Niche";
    document.getElementById('preview-bio').innerText = bio || "Your creator bio will appear here...";
    
    document.getElementById('preview-yt-subs').innerText = new Intl.NumberFormat('en-IN').format(yt);
    document.getElementById('preview-ig-followers').innerText = new Intl.NumberFormat('en-IN').format(ig);
    document.getElementById('preview-views').innerText = new Intl.NumberFormat('en-IN').format(views);
    document.getElementById('preview-engagement').innerText = engagement.toFixed(1) + "%";
    
    document.getElementById('preview-rate-dedicated').innerText = formatCurrency(rateDedicated);
    document.getElementById('preview-rate-integrated').innerText = formatCurrency(rateIntegrated);

    // Sync header profile names
    document.getElementById('profile-name-summary').innerText = name || "Your Channel Name";
    document.getElementById('profile-niche-summary').innerText = niche || "Tech & Lifestyle";
}

// Helpers for social media sync scraping
function getYoutubeFetchUrl(input) {
    if (!input) return '';
    input = input.trim();
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }
    if (input.includes('youtube.com')) {
        return 'https://' + input;
    }
    if (input.startsWith('@')) {
        return `https://www.youtube.com/${input}`;
    }
    if (input.startsWith('UC') && input.length === 24) {
        return `https://www.youtube.com/channel/${input}`;
    }
    return `https://www.youtube.com/@${input}`;
}

function getInstagramFetchUrl(input) {
    if (!input) return '';
    input = input.trim();
    if (input.startsWith('http://') || input.startsWith('https://')) {
        return input;
    }
    if (input.includes('instagram.com')) {
        return 'https://' + input;
    }
    if (input.startsWith('@')) {
        return `https://www.instagram.com/${input.substring(1)}`;
    }
    return `https://www.instagram.com/${input}`;
}

function parseSocialCount(valStr) {
    if (!valStr) return 0;
    // Clean commas and lowercase
    let clean = valStr.replace(/,/g, '').trim().toLowerCase();
    
    // Extract numeric start
    let match = clean.match(/^([\d\.]+)/);
    if (!match) return 0;
    let val = parseFloat(match[1]);
    
    // Determine suffix/multiplier
    let suffix = '';
    let suffixMatch = clean.match(/^[\d\.]+\s*([a-z]+)/);
    if (suffixMatch) {
        suffix = suffixMatch[1];
    }
    
    if (suffix.startsWith('m')) {
        val *= 1000000;
    } else if (suffix.startsWith('k')) {
        val *= 1000;
    } else if (suffix.startsWith('b')) {
        val *= 1000000000;
    } else if (suffix.startsWith('lakh')) {
        val *= 100000;
    } else if (suffix.startsWith('crore')) {
        val *= 10000000;
    }
    
    return Math.round(val);
}

function extractYoutubeSubscribers(html) {
    if (!html) return null;
    // Regex 1: "label":"260M subscribers"
    let match = html.match(/"label"\s*:\s*"([^"]+ subscribers)"/i);
    if (match) {
        return parseSocialCount(match[1]);
    }
    // Regex 2: subscriberCountText -> accessibility -> accessibilityData -> label
    match = html.match(/"subscriberCountText"\s*:\s*\{\s*"accessibility"\s*:\s*\{\s*"accessibilityData"\s*:\s*\{\s*"label"\s*:\s*"([^"]+)"/i);
    if (match) {
        return parseSocialCount(match[1]);
    }
    // Regex 3: Simple search for "X subscribers"
    match = html.match(/([\d\.,\s]+[kKmMbB]?(?:\s+million|\s+billion|\s+thousand|\s+lakh|\s+crore)?\s+subscribers)/i);
    if (match) {
        return parseSocialCount(match[1]);
    }
    return null;
}

function extractInstagramFollowers(html) {
    if (!html) return null;
    // Regex 1: content="88.5k Followers, 1,412 Following"
    let match = html.match(/content="([^"]+ Followers)/i);
    if (match) {
        return parseSocialCount(match[1]);
    }
    // Regex 2: content="88.5k Followers"
    match = html.match(/([0-9kKmM\.,\s]+(?:million|billion|lakh|crore)?\s*followers)/i);
    if (match) {
        return parseSocialCount(match[1]);
    }
    return null;
}

async function fetchYoutubeSubsFromInvidious(handleOrId) {
    let query = handleOrId.trim();
    
    // Extract handle/ID if full URL is given
    if (query.startsWith('http://') || query.startsWith('https://')) {
        let parts = query.split('/');
        let lastPart = parts[parts.length - 1];
        if (lastPart.startsWith('@')) {
            query = lastPart;
        } else if (parts.includes('channel')) {
            query = lastPart;
        } else if (parts.includes('c')) {
            query = lastPart;
        } else {
            query = lastPart;
        }
    }

    // Standardize query to start with @ if it's a handle
    if (!query.startsWith('@') && !query.startsWith('UC')) {
        query = '@' + query;
    }

    const instances = [
        'https://vid.puffyan.us',
        'https://yewtu.be',
        'https://invidious.nerdvpn.de',
        'https://invidious.projectsegfaut.im',
        'https://invidious.flokinet.to'
    ];

    let lastError = null;
    for (const instance of instances) {
        try {
            let fetchUrl = '';
            if (query.startsWith('UC') && query.length === 24) {
                fetchUrl = `${instance}/api/v1/channels/${query}`;
            } else {
                fetchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=channel`;
            }
            
            // Set 8-second timeout for fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const res = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = await res.json();
                if (query.startsWith('UC') && query.length === 24) {
                    if (data && typeof data.subCount === 'number') {
                        return data.subCount;
                    }
                } else {
                    if (Array.isArray(data) && data.length > 0) {
                        const channel = data.find(item => item.type === 'channel');
                        if (channel && typeof channel.subCount === 'number') {
                            return channel.subCount;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`Invidious instance ${instance} failed:`, err);
            lastError = err;
        }
    }
    throw lastError || new Error("All Invidious instances failed to fetch YouTube subscribers.");
}

async function fetchHtmlWithProxy(targetUrl) {
    const proxies = [
        {
            url: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
            type: 'text'
        },
        {
            url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            type: 'text'
        },
        {
            url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
            type: 'allorigins-json'
        },
        {
            url: (u) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(u)}`,
            type: 'text'
        }
    ];

    let lastError = null;
    for (const proxy of proxies) {
        try {
            const proxyUrl = proxy.url(targetUrl);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                if (proxy.type === 'text') {
                    const text = await res.text();
                    if (text && text.length > 300) {
                        return text;
                    }
                } else if (proxy.type === 'allorigins-json') {
                    const data = await res.json();
                    if (data && data.contents && data.contents.length > 300) {
                        return data.contents;
                    }
                }
            } else {
                console.warn(`Proxy ${proxy.type} returned status ${res.status}`);
            }
        } catch (err) {
            console.warn(`Proxy ${proxy.type} failed for ${targetUrl}:`, err);
            lastError = err;
        }
    }
    throw lastError || new Error("All CORS proxies failed to fetch target URL.");
}

// Event listener for fetching social follower/subscriber count
window.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('btn-fetch-socials');
    if (!fetchBtn) return;
    
    fetchBtn.addEventListener('click', async () => {
        const ytInput = document.getElementById('mk-youtube-url').value;
        const igInput = document.getElementById('mk-instagram-url').value;
        
        if (!ytInput && !igInput) {
            alert("Please enter a YouTube link/handle or an Instagram username/link first.");
            return;
        }
        
        const icon = document.getElementById('fetch-socials-icon');
        const btnText = document.getElementById('fetch-socials-text');
        const errorEl = document.getElementById('fetch-socials-error');
        
        // UI Loading State
        fetchBtn.disabled = true;
        icon.classList.add('spin-animation');
        btnText.innerText = "Syncing Live Stats...";
        errorEl.style.display = 'none';
        errorEl.innerText = '';
        
        let fetchedYt = null;
        let fetchedIg = null;
        let errors = [];
        
        // 1. Fetch YouTube Subscribers (Try Invidious API first, fallback to proxy scraping)
        if (ytInput) {
            try {
                // Try Invidious
                fetchedYt = await fetchYoutubeSubsFromInvidious(ytInput);
            } catch (invidiousErr) {
                console.warn("Invidious failed, falling back to HTML scraper...", invidiousErr);
                try {
                    const url = getYoutubeFetchUrl(ytInput);
                    const html = await fetchHtmlWithProxy(url);
                    const subs = extractYoutubeSubscribers(html);
                    if (subs !== null) {
                        fetchedYt = subs;
                    } else {
                        errors.push("Could not parse YouTube subscribers. Check the channel link/handle.");
                    }
                } catch (err) {
                    console.error("YouTube Fetch Error:", err);
                    errors.push("Failed to connect to YouTube. The proxy might be rate-limited.");
                }
            }
        }
        
        // 2. Fetch Instagram Followers
        if (igInput) {
            try {
                const url = getInstagramFetchUrl(igInput);
                const html = await fetchHtmlWithProxy(url);
                const followers = extractInstagramFollowers(html);
                if (followers !== null) {
                    fetchedIg = followers;
                } else {
                    errors.push("Could not parse Instagram followers. Check the username/link.");
                }
            } catch (err) {
                console.error("Instagram Fetch Error:", err);
                errors.push("Failed to connect to Instagram. The proxy might be rate-limited.");
            }
        }
        
        // Apply updates if successful
        if (fetchedYt !== null) {
            document.getElementById('mk-youtube-subs').value = fetchedYt;
        }
        if (fetchedIg !== null) {
            document.getElementById('mk-instagram-followers').value = fetchedIg;
        }
        
        if (fetchedYt !== null || fetchedIg !== null) {
            // Update preview and state
            syncMediaKitPreview();
        }
        
        // Handle error displays
        if (errors.length > 0) {
            errorEl.innerHTML = errors.map(e => `• ${e}`).join('<br>');
            errorEl.style.display = 'block';
        }
        
        // Restore UI State
        fetchBtn.disabled = false;
        icon.classList.remove('spin-animation');
        btnText.innerText = "Fetch Live Followers & Subscribers";
    });
});


// Brand Pitch Creator
document.getElementById('generate-pitch-btn').addEventListener('click', () => {
    const brandName = document.getElementById('pitch-target-brand').value || "Brand Partner";
    const tone = document.getElementById('pitch-tone').value;
    const deliverable = document.getElementById('pitch-deliverable').value;
    const outputBox = document.getElementById('pitch-output-text');

    const formattedYt = new Intl.NumberFormat('en-IN').format(state.profile.youtubeSubs);
    const formattedIg = new Intl.NumberFormat('en-IN').format(state.profile.instagramFollowers);
    const formattedViews = new Intl.NumberFormat('en-IN').format(state.profile.avgViews);

    let emailSubject = '';
    let emailBody = '';

    if (tone === 'polite') {
        emailSubject = `Collaboration Proposal: ${state.profile.name} x ${brandName}`;
        emailBody = `Subject: ${emailSubject}

Dear Marketing Team at ${brandName},

I hope this email finds you well. 

My name is ${state.profile.name}, and I run a content platform focused on "${state.profile.niche}" where I have built an engaged community of over ${formattedYt} YouTube subscribers and ${formattedIg} Instagram followers. 

I have been following ${brandName}'s recent campaigns and believe our audience demographics align perfectly. In my latest content cycles, we average ${formattedViews} views per video with a solid ${state.profile.engagementRate}% engagement rate.

I would love to pitch a ${deliverable === 'dedicated' ? 'dedicated sponsor integration' : 'sponsorship reel'} showcasing your services to my core audience. 

I have attached my live statistics summary sheet for your reference. Looking forward to discussing how we can add value to ${brandName} this quarter.

Best regards,
${state.profile.name}`;
    } else if (tone === 'bold') {
        emailSubject = `ROI-Driven Partnership Offer for ${brandName}`;
        emailBody = `Subject: ${emailSubject}

Hi ${brandName} Marketing Team,

I'm reaching out to discuss a direct marketing opportunity for ${brandName}.

I run ${state.profile.name}, a rapidly growing hub for "${state.profile.niche}" enthusiasts. With a reach of ${formattedViews} average views per post and a strong ${state.profile.engagementRate}% engagement index, my community represents an active segment of users looking for products like yours.

We are currently planning sponsorship slots for our upcoming reviews. I am offering a high-impact ${deliverable === 'dedicated' ? 'dedicated feature' : 'focused integration video'} that directly highlights ${brandName}'s unique features.

Let me know if I can share our pricing sheet and custom video outlines.

Best,
${state.profile.name}
Portfolio: [Link to Live Media Kit]`;
    } else if (tone === 'creative') {
        emailSubject = `Let's Create Together: Custom Video Concept for ${brandName}!`;
        emailBody = `Subject: ${emailSubject}

Hey Team ${brandName},

I love your brand's style, and I've got a killer content concept that would fit your product perfectly!

I'm the creator behind ${state.profile.name}. We talk about "${state.profile.niche}" and help our audience make smart choices. Our community is super active—we have ${formattedYt} subscribers on YouTube and average ${formattedViews} impressions per campaign.

I want to script a unique, storyline-based ${deliverable === 'dedicated' ? 'dedicated feature' : 'review segment'} built specifically for ${brandName}. It will fit naturally into my next major release.

Are you open to a quick chat to brainstorm this? Let me know!

Cheers,
${state.profile.name}`;
    }

    outputBox.innerText = emailBody;
});

// Copy Pitch Button Event Listener
document.getElementById('copy-pitch-btn').addEventListener('click', () => {
    const text = document.getElementById('pitch-output-text').innerText;
    if (text.startsWith("Press Generate")) {
        alert("Please generate a pitch first!");
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert("Sponsorship Pitch email copied to clipboard!");
    });
});


/* ==========================================================================
   Branding Assets Logic
   ========================================================================== */
const assetCodes = {
    tech: `<!-- TECH CODE CARD HTML -->
<div class="code-card-wrapper">
  <div class="card-bar">
    <span class="btn-dot r"></span>
    <span class="btn-dot y"></span>
    <span class="btn-dot g"></span>
    <div class="card-title">index.js</div>
  </div>
  <pre class="code-body">
<code>const solver = (data) => {
  return data.map(item => item.value);
};</code>
  </pre>
</div>

/* MINIMAL TECH CARD CSS */
.code-card-wrapper {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.card-bar {
  background: #1e293b;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.btn-dot.r { background: #ef4444; }
.btn-dot.y { background: #eab308; }
.btn-dot.g { background: #22c55e; }
.card-title {
  color: #94a3b8;
  font-size: 11px;
  margin-left: 6px;
}
.code-body {
  padding: 16px;
  margin: 0;
  color: #38bdf8;
  font-size: 13px;
}`,
    finance: `<!-- FINANCE HIGHLIGHT CARD HTML -->
<div class="fin-metric-card">
  <div class="fin-top">
    <span class="fin-label">PORTFOLIO YIELD</span>
    <span class="fin-percentage">+12.4%</span>
  </div>
  <div class="fin-main-val">₹4,25,000</div>
  <div class="fin-desc">Compounded Annual Return Estimation</div>
</div>

/* MINIMAL FINANCE CARD CSS */
.fin-metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  width: 280px;
  font-family: system-ui, sans-serif;
}
.fin-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.fin-label {
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.fin-percentage {
  color: #10b981;
  font-size: 11px;
  font-weight: 700;
  background: #ecfdf5;
  padding: 2px 6px;
  border-radius: 4px;
}
.fin-main-val {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
}
.fin-desc {
  color: #94a3b8;
  font-size: 11px;
  margin-top: 4px;
}`,
    lowerthird: `<!-- MINIMAL LOWER THIRD HTML -->
<div class="name-overlay-tag">
  <div class="left-indicator"></div>
  <div class="info-block">
    <div class="main-handle">HARSHAL TECH</div>
    <div class="sub-handle">Subscribe for coding tips</div>
  </div>
</div>

/* MINIMAL LOWER THIRD CSS */
.name-overlay-tag {
  display: flex;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8px 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  width: max-content;
}
.left-indicator {
  width: 4px;
  background: #2563eb;
  margin-right: 12px;
  border-radius: 2px;
}
.info-block {
  display: flex;
  flex-direction: column;
}
.main-handle {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.5px;
}
.sub-handle {
  font-size: 11px;
  color: #64748b;
}`
};

function copyAssetCode(type) {
    const code = assetCodes[type];
    if (!code) return;

    const modalTitle = document.getElementById('asset-modal-title');
    const modalContent = document.getElementById('asset-code-content');
    const copyBtn = document.getElementById('asset-modal-copy-btn');

    // Title settings
    if (type === 'tech') modalTitle.innerText = "Minimalist Coding Card Code";
    if (type === 'finance') modalTitle.innerText = "Premium Growth Metric Card Code";
    if (type === 'lowerthird') modalTitle.innerText = "Minimal Lower Third Code";

    modalContent.textContent = code;

    // Reset button logic
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(code).then(() => {
            alert("Code snippet copied successfully!");
        });
    };

    openModal('code-asset-modal');
}


/* ==========================================================================
   Campaign Tracker Logic (Kanban Board)
   ========================================================================== */
function renderCampaigns() {
    const columns = ['signed', 'script', 'draft', 'published', 'cleared'];
    
    // Clear lists
    columns.forEach(col => {
        document.getElementById(`list-${col}`).innerHTML = '';
        document.getElementById(`count-${col}`).innerText = '0';
    });

    const counts = { signed: 0, script: 0, draft: 0, published: 0, cleared: 0 };

    state.campaigns.forEach(camp => {
        const colList = document.getElementById(`list-${camp.status}`);
        if (!colList) return;

        counts[camp.status]++;

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.innerHTML = `
            <span class="kcard-brand">${camp.brand}</span>
            <span class="kcard-title">${camp.title}</span>
            <span class="kcard-amount">${formatCurrency(camp.amount)}</span>
            <div class="kcard-footer">
                <span class="kcard-date"><i class="fa-regular fa-calendar-days"></i> ${formatDate(camp.deadline)}</span>
                <div class="kcard-actions">
                    <button class="kcard-act-btn" onclick="moveCampaign('${camp.id}', 'left')" title="Move Phase Left"><i class="fa-solid fa-arrow-left"></i></button>
                    <button class="kcard-act-btn" onclick="moveCampaign('${camp.id}', 'right')" title="Move Phase Right"><i class="fa-solid fa-arrow-right"></i></button>
                    <button class="kcard-act-btn delete" onclick="deleteCampaign('${camp.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
        colList.appendChild(card);
    });

    // Update Counts
    columns.forEach(col => {
        document.getElementById(`count-${col}`).innerText = counts[col];
    });
}

// Add campaign logic
document.getElementById('add-campaign-btn').addEventListener('click', () => {
    // Set default deadline date (one week from today)
    const deadlineInput = document.getElementById('c-deadline');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    deadlineInput.value = futureDate.toISOString().split('T')[0];

    openModal('campaign-modal');
});

document.getElementById('campaign-modal-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const newCamp = {
        id: "camp-" + Date.now(),
        brand: document.getElementById('c-brand-name').value,
        title: document.getElementById('c-campaign-title').value,
        amount: parseFloat(document.getElementById('c-amount').value) || 0,
        deadline: document.getElementById('c-deadline').value,
        status: document.getElementById('c-status').value
    };

    state.campaigns.push(newCamp);
    saveState();
    renderCampaigns();
    renderDashboard();
    closeModal('campaign-modal');
    
    // Reset Form
    document.getElementById('campaign-modal-form').reset();
});

function moveCampaign(id, direction) {
    const camp = state.campaigns.find(c => c.id === id);
    if (!camp) return;

    const columns = ['signed', 'script', 'draft', 'published', 'cleared'];
    const currentIndex = columns.indexOf(camp.status);

    if (direction === 'left' && currentIndex > 0) {
        camp.status = columns[currentIndex - 1];
    } else if (direction === 'right' && currentIndex < columns.length - 1) {
        camp.status = columns[currentIndex + 1];
    }

    saveState();
    renderCampaigns();
    renderDashboard();
}

function deleteCampaign(id) {
    if (confirm("Remove this campaign from tracker?")) {
        state.campaigns = state.campaigns.filter(c => c.id !== id);
        saveState();
        renderCampaigns();
        renderDashboard();
    }
}


/* ==========================================================================
   Modal Controls
   ========================================================================== */
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Close modals when clicking overlay background
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal(overlay.id);
        }
    });
});


/* ==========================================================================
   App Initializer
   ========================================================================== */
/* ==========================================================================
   Global Window Bindings (For inline HTML event listeners)
   ========================================================================== */
window.navigateToTab = navigateToTab;
window.closeModal = closeModal;
window.openModal = openModal;
window.copyAssetCode = copyAssetCode;
window.viewInvoice = viewInvoice;
window.markInvoicePaid = markInvoicePaid;
window.selectInvoiceForReminder = selectInvoiceForReminder;
window.deleteInvoice = deleteInvoice;
window.moveCampaign = moveCampaign;
window.deleteCampaign = deleteCampaign;
window.switchAuthTab = switchAuthTab;

/* ==========================================================================
   Firebase Auth Logic & Event Listeners
   ========================================================================== */
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const errorEl = document.getElementById('auth-error-msg');
    
    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
    }
    if (isFirebaseConfigured) {
        errorEl.style.display = 'none';
    }
}

function getFriendlyAuthError(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'The email address is badly formatted.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
            return 'No account exists with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email address.';
        case 'auth/weak-password':
            return 'The password is too weak. Choose at least 6 characters.';
        case 'auth/operation-not-allowed':
            return 'Google Sign-In or Email authentication is not enabled in the Firebase Console (Authentication -> Sign-in method).';
        case 'auth/popup-closed-by-user':
            return 'The sign-in popup was closed before completing authentication.';
        case 'auth/popup-blocked':
            return 'The sign-in popup was blocked by your browser. Please allow popups for this site.';
        case 'auth/unauthorized-domain':
            return 'This domain (or localhost port) is not authorized in the Firebase Console (Authentication -> Settings -> Authorized Domains).';
        default:
            return 'An error occurred during authentication. Please check your setup.';
    }
}

function showAuthError(err) {
    console.error("Firebase Auth Error Details:", err);
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) {
        const friendlyMessage = getFriendlyAuthError(err.code);
        errorEl.innerHTML = `<strong>Error:</strong> ${friendlyMessage}<br><span style="font-size:11px; opacity:0.85; font-family: monospace; display:block; margin-top:4px;">Code: ${err.code || err.message || err}</span>`;
        errorEl.style.display = 'block';
    }
}

function refreshUI() {
    // Set profile summary values in sidebar
    const displayName = state.profile.name || (currentUser ? (currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : "")) : "") || "Creator";
    document.getElementById('profile-name-summary').innerText = displayName;
    document.getElementById('profile-niche-summary').innerText = state.profile.niche || "Tech & Lifestyle";
    
    // Populate form inputs from state first to prevent syncMediaKitPreview from overwriting state with empty form values
    populateMediaKitFormFromState();
    
    // Auto sync profile stats in memory to initial form inputs
    syncMediaKitPreview();

    // Refresh active tab
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        const activeTabId = activeLink.getAttribute('data-tab');
        navigateToTab(activeTabId);
    } else {
        navigateToTab('dashboard');
    }
}

// Attach Auth Listeners
window.addEventListener('DOMContentLoaded', () => {
    // Set dynamic date in header
    const liveDateEl = document.getElementById('live-date');
    if (liveDateEl) {
        liveDateEl.innerText = new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    const logoutBtn = document.getElementById('btn-logout');

    if (!isFirebaseConfigured) {
        // If Firebase is not configured, redirect to login.html to show configuration error
        window.location.href = 'login.html';
        return;
    }

    // Auth state observer
    onAuthStateChanged(auth, async (user) => {
        const appContainer = document.querySelector('.app-container');
        if (user) {
            currentUser = user;
            
            // Show app container
            if (appContainer) appContainer.style.display = 'flex';
            
            // Load state from Firestore & LocalStorage
            await loadState();
            
            // Refresh Dashboard & Forms
            refreshUI();
        } else {
            currentUser = null;
            
            // Reset global in-memory state on sign-out
            resetStateToDefault();
            
            // Redirect to login.html to enforce compulsory login
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // Clear local storage on sign out
                localStorage.removeItem(getStorageKey());
            } catch (err) {
                console.error("Logout failed:", err);
            }
        });
    }
});
