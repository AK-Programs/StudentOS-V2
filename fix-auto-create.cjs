const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `            if (regStepRef.current !== 'landing') {
              console.log('[Auth] Profile not found, but registration is in progress. Skipping auto-creation.');
              setFirebaseOnboardingUser(supabaseUser as any);
              setDataLoading(false);
              return;
            }

            const newProfile: UserProfile = {`;

const replacement = `            // User authenticated via OAuth but has no profile yet.
            // Force them into the registration flow to select their role/grade/etc.
            console.log('[Auth] Profile not found for OAuth user. Redirecting to onboarding.');
            setFirebaseOnboardingUser(supabaseUser as any);
            setRegStep('details');
            setLinkedGoogleUid(supabaseUser.id);
            setLinkedGoogleEmail(supabaseUser.email || '');
            setLinkedGooglePhoto(supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || '');
            setDataLoading(false);
            return;

            // Deprecated auto-creation
            const newProfile: UserProfile = {`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Fixed auto-creation of profiles");
