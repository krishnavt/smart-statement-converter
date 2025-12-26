export default function handler(req, res) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Smart Statement Converter</title>
    <meta name="description" content="Login to Smart Statement Converter to access your account and convert PDF bank statements.">
    <link rel="stylesheet" href="/styles.css">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <nav class="navbar">
                <div class="nav-brand">
                    <div class="logo">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <rect x="4" y="8" width="24" height="16" rx="2" stroke="#4F46E5" stroke-width="2" fill="#4F46E5"/>
                            <rect x="6" y="10" width="20" height="2" fill="white"/>
                            <rect x="6" y="14" width="12" height="2" fill="white"/>
                            <rect x="6" y="18" width="16" height="2" fill="white"/>
                        </svg>
                        <a href="/" style="text-decoration: none; color: inherit;">
                            <span>SMART STATEMENT CONVERTER</span>
                        </a>
                    </div>
                </div>
                <div class="nav-menu">
                    <a href="/#pricing" class="nav-link">Pricing</a>
                    <a href="/api/login" class="nav-link">Login</a>
                    <a href="/api/register" class="nav-link primary">Register</a>
                    <div class="language-selector">
                        <select id="languageSelect">
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                        </select>
                    </div>
                </div>
            </nav>
        </div>
    </header>

    <!-- Login Section -->
    <section class="hero" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container">
            <div class="hero-content" style="max-width: 400px; margin: 0 auto;">
                <h1 class="hero-title" style="font-size: 2.5rem; margin-bottom: 1rem;">Welcome Back</h1>
                <p class="hero-subtitle" style="margin-bottom: 2rem;">Sign in to your account to continue converting your bank statements.</p>
                
                <!-- Login Form -->
                <div class="login-form-container" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.1);">
                    <form id="loginForm" style="width: 100%;">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="loginEmail" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Email Address</label>
                            <input type="email" id="loginEmail" required style="width: 100%; padding: 0.75rem; border: 2px solid #E5E7EB; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;" placeholder="Enter your email">
                        </div>
                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label for="loginPassword" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Password</label>
                            <input type="password" id="loginPassword" required style="width: 100%; padding: 0.75rem; border: 2px solid #E5E7EB; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s;" placeholder="Enter your password">
                        </div>
                        
                        <button type="submit" class="btn primary full-width" style="width: 100%; background: #4F46E5; color: white; padding: 0.875rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background-color 0.2s;">
                            Sign In
                        </button>
                    </form>
                    
                    <!-- Divider -->
                    <div style="margin: 2rem 0; text-align: center; position: relative;">
                        <span style="background: white; padding: 0 1rem; color: #6B7280; font-size: 0.9rem;">or</span>
                        <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #E5E7EB; z-index: -1;"></div>
                    </div>
                    
                    <!-- Google Sign In -->
                    <button id="googleSignInBtn" class="google-auth-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 0.875rem 1rem; background: white; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: all 0.2s;">
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>
                    
                    <!-- Sign Up Link -->
                    <p class="auth-switch" style="text-align: center; margin-top: 2rem; color: #6B7280;">
                        Don't have an account? <a href="/api/register" style="color: #4F46E5; text-decoration: none; font-weight: 500;">Create one</a>
                    </p>
                </div>
            </div>
        </div>
    </section>

    <script>
        let googleClientId = '';

        // Load Google Client ID
        fetch('/api/auth/config')
            .then(response => response.json())
            .then(data => {
                googleClientId = data.googleClientId;
                initializeGoogleSignIn();
            })
            .catch(error => {
                console.error('❌ Error loading auth config:', error);
            });

        function initializeGoogleSignIn() {
            const btn = document.getElementById('googleSignInBtn');
            if (!btn) return;

            btn.addEventListener('click', async () => {
                try {
                    // Use direct OAuth2 popup flow
                    const redirectUri = window.location.origin + '/oauth-callback.html';
                    const scope = 'email profile openid';
                    const state = Math.random().toString(36).substring(7);

                    sessionStorage.setItem('oauth_state', state);

                    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                    authUrl.searchParams.set('client_id', googleClientId);
                    authUrl.searchParams.set('redirect_uri', redirectUri);
                    authUrl.searchParams.set('response_type', 'token id_token');
                    authUrl.searchParams.set('scope', scope);
                    authUrl.searchParams.set('state', state);
                    authUrl.searchParams.set('nonce', Math.random().toString(36).substring(7));

                    const width = 500;
                    const height = 600;
                    const left = window.screenX + (window.outerWidth - width) / 2;
                    const top = window.screenY + (window.outerHeight - height) / 2;

                    const popup = window.open(
                        authUrl.toString(),
                        'Google Sign-In',
                        `width=${width},height=${height},left=${left},top=${top}`
                    );

                    window.addEventListener('message', async (event) => {
                        if (event.origin !== window.location.origin) return;

                        if (event.data.type === 'google-auth-success') {
                            popup?.close();

                            if (event.data.state !== sessionStorage.getItem('oauth_state')) {
                                alert('State mismatch - possible CSRF attack');
                                return;
                            }

                            await handleGoogleSignIn({ credential: event.data.id_token });
                        }
                    }, { once: true });

                } catch (error) {
                    console.error('❌ Google OAuth failed:', error);
                    alert('Authentication failed. Please try again.');
                }
            });
        }

        async function handleGoogleSignIn(response) {
            console.log('Google Sign-In response received');
            
            // Show loading
            const loadingOverlay = document.createElement('div');
            loadingOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
            loadingOverlay.innerHTML = '<div style="background:white;padding:2rem;border-radius:8px;text-align:center;"><div style="border:4px solid #f3f3f3;border-top:4px solid #4F46E5;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div><p>Signing you in with Google...</p></div>';
            document.body.appendChild(loadingOverlay);
            
            // Send the credential to your backend
            fetch('/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: response.credential
                })
            })
            .then(response => response.json())
            .then(data => {
                document.body.removeChild(loadingOverlay);
                
                if (data.success) {
                    // Store user data and token
                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    
                    alert(\`Welcome \${data.user.name}! Redirecting to dashboard...\`);
                    window.location.href = '/';
                } else {
                    alert('Google authentication failed: ' + data.message);
                }
            })
            .catch(error => {
                document.body.removeChild(loadingOverlay);
                console.error('Authentication error:', error);
                alert('Authentication failed. Please try again.');
            });
        }
        
        // Regular form login
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Regular login not implemented yet. Please use Google Sign-In.');
        });
        
        // Add CSS for loading spinner
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}