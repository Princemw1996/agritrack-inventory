// api/admin.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  // CORS headers (adjust origin for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Extract and verify admin session token
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No authorization token' });
  }

  // Get the user from the token
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user has admin role
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError || !roleData || roleData.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized (admin only)' });
  }

  // 2. Handle actions
  const { action } = req.body;

  // CREATE USER
  if (action === 'create') {
    const { email, password, role, shopIds } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Missing email, password, or role' });
    }
    try {
      // Create user in Supabase Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      // Insert role
      await supabaseAdmin.from('user_roles').insert({
        user_id: newUser.user.id,
        role: role,
      });

      // Insert shop assignments (if role is shopkeeper)
      if (role === 'shopkeeper' && Array.isArray(shopIds) && shopIds.length > 0) {
        const assignments = shopIds.map(shopId => ({
          user_id: newUser.user.id,
          shop_id: shopId,
        }));
        await supabaseAdmin.from('user_shops').insert(assignments);
      }

      return res.status(200).json({ success: true, user: newUser.user });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE USER
  else if (action === 'delete') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      // Delete user from auth (cascade will remove from user_roles and user_shops if foreign keys set)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // LIST USERS (optional)
  else if (action === 'list') {
    try {
      // Fetch users from auth (might be paginated; for simplicity, fetch all)
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      // Get roles and shop assignments for each user
      const enriched = await Promise.all(users.users.map(async (u) => {
        const { data: role } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', u.id).maybeSingle();
        const { data: shops } = await supabaseAdmin.from('user_shops').select('shop_id').eq('user_id', u.id);
        return {
          id: u.id,
          email: u.email,
          role: role?.role || 'shopkeeper',
          shopIds: shops?.map(s => s.shop_id) || []
        };
      }));
      return res.status(200).json({ users: enriched });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // UPDATE SHOPS for a user
  else if (action === 'updateShops') {
    const { userId, shopIds } = req.body;
    if (!userId || !Array.isArray(shopIds)) {
      return res.status(400).json({ error: 'Missing userId or shopIds array' });
    }
    try {
      // Delete existing assignments
      await supabaseAdmin.from('user_shops').delete().eq('user_id', userId);
      // Insert new ones
      if (shopIds.length > 0) {
        const assignments = shopIds.map(shopId => ({ user_id: userId, shop_id: shopId }));
        await supabaseAdmin.from('user_shops').insert(assignments);
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  else {
    return res.status(400).json({ error: 'Unknown action' });
  }
}