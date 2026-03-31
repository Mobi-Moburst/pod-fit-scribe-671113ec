import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a client with the caller's JWT to check their role
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using direct query with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list": {
        // List all users with their roles
        const { data: { users }, error } = await adminClient.auth.admin.listUsers();
        if (error) throw error;

        const { data: roles } = await adminClient.from("user_roles").select("*");
        const roleMap = new Map<string, string>();
        roles?.forEach((r: any) => roleMap.set(r.user_id, r.role));

        const result = users.map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          role: roleMap.get(u.id) || "user",
        }));

        return new Response(JSON.stringify({ users: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "invite": {
        const { email, role = "user" } = params;
        if (!email) {
          return new Response(JSON.stringify({ error: "Email is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Generate a random temporary password
        const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });
        if (createError) throw createError;

        // Assign role
        const { error: roleError } = await adminClient.from("user_roles").insert({
          user_id: newUser.user!.id,
          role,
        });
        if (roleError) throw roleError;

        // Send password reset so user can set their own password
        // We use the admin client's generateLink to create a reset link
        const { error: resetError } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        // Non-critical if this fails — admin can manually trigger reset

        return new Response(JSON.stringify({ 
          success: true, 
          user: { id: newUser.user!.id, email },
          message: "User created. They'll need to use 'Forgot Password' on login to set their password."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_role": {
        const { user_id, role } = params;
        if (!user_id || !role) {
          return new Response(JSON.stringify({ error: "user_id and role required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Don't allow removing your own admin role
        if (user_id === caller.id && role !== "admin") {
          return new Response(JSON.stringify({ error: "Cannot remove your own admin role" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upsert the role
        const { error } = await adminClient.from("user_roles").upsert(
          { user_id, role },
          { onConflict: "user_id,role" }
        );

        // Delete other roles for this user (one role at a time)
        await adminClient.from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .neq("role", role);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { user_id } = params;
        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient.auth.admin.deleteUser(user_id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
