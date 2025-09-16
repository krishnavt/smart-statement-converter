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
                    
                    <!-- Sign Up Link -->
                    <p class="auth-switch" style="text-align: center; margin-top: 2rem; color: #6B7280;">
                        Don't have an account? <a href="/api/register" style="color: #4F46E5; text-decoration: none; font-weight: 500;">Create one</a>
                    </p>
                </div>
            </div>
        </div>
    </section>

    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Login successful! Redirecting to dashboard...');
            window.location.href = '/';
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}