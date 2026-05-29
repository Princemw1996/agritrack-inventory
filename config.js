// Supabase client (global)
const SUPABASE_URL = "https://njzjazzpmeaoufrqqldm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qemphenpwbWVhb3VmcnFxbGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODQ0MjQsImV4cCI6MjA5MzM2MDQyNH0.YW06qCB-mgeheuVbdH9_2U8qDoytqb7v0NFZg1FhKKI";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUserRole = null;
let currentUserId = null;
let currentUserShops = [];

// Helper to show message in the module container
function showMessage(text, isError = false) {
    const container = document.getElementById('moduleContainer');
    const existing = container.querySelector('.message');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `message ${isError ? 'error' : 'success'}`;
    div.textContent = text;
    container.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

// Fetch user role from user_roles table
async function fetchUserRole(userId) {
    const { data, error } = await sb.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return data?.role || null;
}

// Fetch user's assigned shops
async function fetchUserShops(userId) {
    const { data, error } = await sb.from('user_shops').select('shop_id').eq('user_id', userId);
    if (error) return [];
    return data.map(row => row.shop_id);
}

function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
// ========== AUDIT LOGGING ==========
async function logAction(action, tableName, recordId, details) {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        await sb.from('audit_logs').insert({
            user_id: user.id,
            user_email: user.email,
            action: action,
            table_name: tableName,
            record_id: recordId,
            details: details
        });
    } catch (err) {
        console.error('Failed to log action:', err);
    }
}