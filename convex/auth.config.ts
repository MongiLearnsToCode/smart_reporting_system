// Convex trusts Supabase-issued JWTs as an OIDC provider.
//
// Requires Supabase to sign tokens asymmetrically (RS256/ES256) so its JWKS is
// published at `<domain>/.well-known/jwks.json`. Enable "asymmetric JWT signing
// keys" in the Supabase dashboard (Project Settings → JWT keys) before this works.
//
// `applicationID` matches the `aud` claim, which Supabase sets to "authenticated"
// for signed-in users. In a Convex function, `ctx.auth.getUserIdentity().subject`
// is then the Supabase user id (the JWT `sub`).
export default {
  providers: [
    {
      domain: 'https://eitfdhcmdzsieudrwkhm.supabase.co/auth/v1',
      applicationID: 'authenticated',
    },
  ],
};
