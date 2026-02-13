// ═══════════════════════════════════════
//  novaState.js — shared session store
//  All pages read/write through these helpers.
//
//  Your login API returns:
//  { "accessToken": "eyJ...", "refreshToken": "...", "message": "Login successful" }
// ═══════════════════════════════════════

const NovaState = (() => {
    const KEY_TOKEN = 'nova_jwt';
    const KEY_USER  = 'nova_user';
    const KEY_CODE  = 'nova_meeting_code';

    // Decode JWT payload without a library
    function decodeJwt(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload; // { sub, userId, role, iat, exp }
        } catch { return {}; }
    }

    return {
        // ── token ──────────────────────────────
        setToken(token) { sessionStorage.setItem(KEY_TOKEN, token); },
        getToken()      { return sessionStorage.getItem(KEY_TOKEN); },
        clearToken()    { sessionStorage.removeItem(KEY_TOKEN); },

        // ── save from login response directly ──
        // Pass the full login response object:
        // { accessToken, refreshToken, message }
        saveLoginResponse(data, emailFallback = '') {
            const token = data?.accessToken || null;
            if (!token) return false;

            sessionStorage.setItem(KEY_TOKEN, token);

            // Decode JWT to get userId, role, sub (email)
            const jwt = decodeJwt(token);
            const user = {
                id:     jwt?.userId  || null,
                email:  jwt?.sub     || emailFallback,
                role:   jwt?.role    || 'USER',
                // Name not in JWT — use email prefix as display name
                name:   (jwt?.sub || emailFallback).split('@')[0],
            };
            sessionStorage.setItem(KEY_USER, JSON.stringify(user));
            return true;
        },

        // ── user info ──────────────────────────
        setUser(obj)  { sessionStorage.setItem(KEY_USER, JSON.stringify(obj)); },
        getUser()     {
            try { return JSON.parse(sessionStorage.getItem(KEY_USER)) || {}; }
            catch { return {}; }
        },
        clearUser()   { sessionStorage.removeItem(KEY_USER); },

        // ── meeting code (set just before entering room) ──
        setMeetingCode(code) { sessionStorage.setItem(KEY_CODE, code); },
        getMeetingCode()     { return sessionStorage.getItem(KEY_CODE); },
        clearMeetingCode()   { sessionStorage.removeItem(KEY_CODE); },

        // ── full logout ────────────────────────
        logout() {
            sessionStorage.removeItem(KEY_TOKEN);
            sessionStorage.removeItem(KEY_USER);
            sessionStorage.removeItem(KEY_CODE);
        },

        isLoggedIn() {
            const token = sessionStorage.getItem(KEY_TOKEN);
            if (!token) return false;
            // Check token not expired
            try {
                const { exp } = decodeJwt(token);
                if (exp && Date.now() / 1000 > exp) {
                    // Token expired — clean up
                    sessionStorage.removeItem(KEY_TOKEN);
                    return false;
                }
            } catch {}
            return true;
        },

        decodeJwt
    };
})();
