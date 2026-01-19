import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Remove X-Frame-Options header to allow iframe embedding from any origin
  // This is necessary because Vercel preview deployments set it to 'deny' by default
  response.headers.delete("X-Frame-Options");
  
  // Use Content-Security-Policy to allow embedding from any origin
  // If you want to restrict to specific domains, replace '*' with your Bubble domain(s)
  // Example: "frame-ancestors 'self' https://bubble.io https://*.bubble.io;"
  response.headers.set("Content-Security-Policy", "frame-ancestors *;");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

