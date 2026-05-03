const SUPABASE_URL = "https://njzjazzpmeaoufrqqldm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qemphenpwbWVhb3VmcnFxbGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODQ0MjQsImV4cCI6MjA5MzM2MDQyNH0.YW06qCB-mgeheuVbdH9_2U8qDoytqb7v0NFZg1FhKKI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getLocations() {
    const { data, error } = await supabase.from('locations').select('*');
    if (error) throw error;
    return data;
}

async function getProducts() {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data;
}

function showMessage(containerId, message, type) {
    const container = document.getElementById(containerId);
    let msgDiv = container.querySelector('.message');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        container.appendChild(msgDiv);
    }
    msgDiv.textContent = message;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => { msgDiv.style.display = 'none'; }, 4000);
}