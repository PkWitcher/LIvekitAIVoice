import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_EMAIL = "admin@gmail.com";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Admin routes protection
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/api/admin")) {
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  // If logged in as admin and visiting admin login, redirect to admin dashboard
  if (user && user.email?.toLowerCase() === ADMIN_EMAIL && pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Regular user routes protection
  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/api/dispatch") ||
      pathname.startsWith("/api/queue") ||
      pathname.startsWith("/api/calls") ||
      pathname.startsWith("/api/stats"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and visiting login page, redirect to dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/dispatch",
    "/api/queue",
    "/api/calls",
    "/api/stats",
  ],
};
