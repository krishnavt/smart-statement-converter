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
                    <div id="googleSignInDiv" style="display: flex; justify-content: center; margin-bottom: 2rem;"></div>
                    
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
        
        // Load Google Client ID with detailed logging
        console.log('🔍 Loading Google Client ID from /api/auth/config');
        console.log('🌍 Current domain:', window.location.origin);
        console.log('🌍 Current URL:', window.location.href);
        
        fetch('/api/auth/config')
            .then(response => {
                console.log('📡 Config response status:', response.status);
                console.log('📡 Config response headers:', response.headers);
                return response.json();
            })
            .then(data => {
                console.log('✅ Config data received:', data);
                googleClientId = data.googleClientId;
                console.log('🔑 Google Client ID set to:', googleClientId);
                console.log('🔑 Client ID length:', googleClientId ? googleClientId.length : 'undefined');
                initializeGoogleSignIn();
            })
            .catch(error => {
                console.error('❌ Error loading auth config:', error);
            });
        
        function initializeGoogleSignIn() {
            console.log('🚀 Initializing Google Sign-In...');
            console.log('🔑 Using Client ID:', googleClientId);
            
            if (!googleClientId) {
                console.error('❌ Google Client ID not configured or empty');
                document.getElementById('googleSignInDiv').innerHTML = '<p style="color: red;">Google Client ID not configured</p>';
                return;
            }
            
            if (!window.google || !window.google.accounts) {
                console.error('❌ Google Identity Services not loaded');
                document.getElementById('googleSignInDiv').innerHTML = '<p style="color: red;">Google Identity Services not loaded</p>';
                return;
            }
            
            console.log('⚙️ Calling google.accounts.id.initialize...');
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleSignIn,
                    auto_select: false,
                    cancel_on_tap_outside: true
                });
                console.log('✅ Google Sign-In initialized successfully');
                
                console.log('🎨 Rendering Google Sign-In button...');
                window.google.accounts.id.renderButton(
                    document.getElementById('googleSignInDiv'),
                    {
                        theme: 'outline',
                        size: 'large',
                        text: 'signin_with',
                        shape: 'rectangular'
                    }
                );
                console.log('✅ Google Sign-In button rendered');
                
            } catch (error) {
                console.error('❌ Error initializing Google Sign-In:', error);
                document.getElementById('googleSignInDiv').innerHTML = '<p style="color: red;">Error: ' + error.message + '</p>';
            }
        }
        
        function handleGoogleSignIn(response) {
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