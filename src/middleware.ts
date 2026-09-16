import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' }
});

// Everything under the app is protected except: NextAuth's own routes, the
// login page, static assets, and the public client-facing invoice/quotation
// pages + their APIs (those are meant to be opened without logging in).
//
// `brand/` matters as much as the /p/ pages do: the logo lives there, and it
// renders on the login screen and on every client-facing invoice — both of
// which are viewed by someone who is not (and shouldn't have to be) signed
// in. Leave it out and the logo silently 307s to /login and shows broken.
export const config = {
  matcher: [
    '/((?!api/auth|login|p/|api/public|brand/|_next/static|_next/image|favicon.ico).*)'
  ]
};
