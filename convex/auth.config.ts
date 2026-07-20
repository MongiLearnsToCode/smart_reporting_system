// Convex validates Supabase-issued JWTs as a Custom JWT provider.
//
// Supabase issues an *access token* (a plain JWT), NOT an OIDC ID token, so the
// OIDC provider form (`{ domain, applicationID }`) rejects it with
// "Could not parse as OIDC ID token". The customJwt provider validates the token
// directly against Supabase's JWKS.
//
// Requires Supabase asymmetric (ES256/P-256) JWT signing so the JWKS is published.
// - issuer:  must equal the token's `iss` claim.
// - applicationID: checked against the token's `aud` claim ("authenticated" for
//   signed-in Supabase users).
// In a Convex function, `ctx.auth.getUserIdentity().subject` is then the Supabase
// user id (the JWT `sub`).
export default {
  providers: [
    {
      type: 'customJwt',
      applicationID: 'authenticated',
      issuer: 'https://eitfdhcmdzsieudrwkhm.supabase.co/auth/v1',
      jwks: 'https://eitfdhcmdzsieudrwkhm.supabase.co/auth/v1/.well-known/jwks.json',
      algorithm: 'ES256',
    },
  ],
};
