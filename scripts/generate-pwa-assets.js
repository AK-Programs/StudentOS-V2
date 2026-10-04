import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, 'screenshots');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Brand SVG for Standard 192x192 and 512x512 Icons (Purpose: Any)
const standardIconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background with smooth rounded corners -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGrad)"/>
  
  <!-- Outer subtle border ring -->
  <rect x="${size * 0.02}" y="${size * 0.02}" width="${size * 0.96}" height="${size * 0.96}" rx="${size * 0.21}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="${size * 0.015}"/>

  <!-- Central Emblem / Cap & S Logo -->
  <g filter="url(#glow)">
    <!-- Graduation Cap / Scholar Motif -->
    <path d="M ${size * 0.5} ${size * 0.24} 
             L ${size * 0.78} ${size * 0.35} 
             L ${size * 0.5} ${size * 0.46} 
             L ${size * 0.22} ${size * 0.35} Z" 
          fill="url(#accentGrad)"/>
    <path d="M ${size * 0.3} ${size * 0.40} 
             L ${size * 0.3} ${size * 0.49} 
             C ${size * 0.3} ${size * 0.56}, ${size * 0.7} ${size * 0.56}, ${size * 0.7} ${size * 0.49} 
             L ${size * 0.7} ${size * 0.40}" 
          fill="none" stroke="url(#accentGrad)" stroke-width="${size * 0.03}" stroke-linecap="round"/>
    
    <!-- Bold 'S' Monogram -->
    <text x="${size * 0.5}" y="${size * 0.82}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${size * 0.38}" 
          font-weight="900" 
          fill="#ffffff" 
          text-anchor="middle" 
          letter-spacing="-0.02em">S</text>
  </g>
</svg>
`;

// 2. Maskable Icon SVG (Purpose: Maskable)
// Crucial: Must fill entire canvas with solid background and keep logo in safe central 80% circle
const maskableIconSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="maskableBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4338ca"/>
      <stop offset="50%" stop-color="#3730a3"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="maskableAccent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="mglow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.015}" stdDeviation="${size * 0.02}" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <!-- Full-bleed background for maskable adaptive cropping -->
  <rect width="${size}" height="${size}" fill="url(#maskableBg)"/>
  
  <!-- Safe Zone Inner Motif (Within 75% safe area) -->
  <g filter="url(#mglow)">
    <path d="M ${size * 0.5} ${size * 0.28} 
             L ${size * 0.74} ${size * 0.38} 
             L ${size * 0.5} ${size * 0.47} 
             L ${size * 0.26} ${size * 0.38} Z" 
          fill="url(#maskableAccent)"/>
    <path d="M ${size * 0.33} ${size * 0.42} 
             L ${size * 0.33} ${size * 0.50} 
             C ${size * 0.33} ${size * 0.56}, ${size * 0.67} ${size * 0.56}, ${size * 0.67} ${size * 0.50} 
             L ${size * 0.67} ${size * 0.42}" 
          fill="none" stroke="url(#maskableAccent)" stroke-width="${size * 0.025}" stroke-linecap="round"/>
    
    <text x="${size * 0.5}" y="${size * 0.77}" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          font-size="${size * 0.31}" 
          font-weight="900" 
          fill="#ffffff" 
          text-anchor="middle">S</text>
  </g>
</svg>
`;

// 3. Desktop Screenshot SVG (1280x720)
const dashboardScreenshotSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#090d16"/>
  
  <!-- Top Navigation Bar -->
  <rect x="0" y="0" width="1280" height="64" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <rect x="24" y="16" width="32" height="32" rx="8" fill="#4f46e5"/>
  <text x="35" y="38" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="18">S</text>
  <text x="68" y="38" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="18">StudentOS</text>
  <rect x="180" y="16" width="90" height="32" rx="16" fill="#1e293b"/>
  <text x="200" y="37" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="12">Solara 10</text>
  
  <!-- Right Profile & AI Badge in Header -->
  <rect x="1100" y="16" width="156" height="32" rx="16" fill="#1e293b"/>
  <circle cx="1120" cy="32" r="10" fill="#10b981"/>
  <text x="1140" y="37" fill="#e2e8f0" font-family="sans-serif" font-weight="bold" font-size="12">Alex Rivera</text>

  <!-- Left Sidebar -->
  <rect x="0" y="64" width="220" height="656" fill="#0b1120" stroke="#1e293b" stroke-width="1"/>
  
  <!-- Active Tab -->
  <rect x="12" y="80" width="196" height="40" rx="10" fill="#4f46e5"/>
  <text x="32" y="105" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">📊 Dashboard</text>
  
  <text x="32" y="145" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">📈 Analytics &amp; Grades</text>
  <text x="32" y="185" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">📝 Tasks &amp; Planner</text>
  <text x="32" y="225" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">🤖 AI Tutor (Orion)</text>
  <text x="32" y="265" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">💬 Peer Chat</text>
  <text x="32" y="305" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">📅 Calendar</text>

  <!-- Main Dashboard Content Grid -->
  <!-- Welcome Banner -->
  <rect x="244" y="84" width="1012" height="120" rx="20" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
  <text x="276" y="130" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="24">Welcome back, Alex! 🚀</text>
  <text x="276" y="160" fill="#a5b4fc" font-family="sans-serif" font-size="14">All assignments up to date. Next class: Advanced Calculus at 10:30 AM.</text>
  
  <!-- Stat Cards -->
  <rect x="244" y="224" width="235" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="268" y="254" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">GPA STANDING</text>
  <text x="268" y="294" fill="#38bdf8" font-family="sans-serif" font-size="32" font-weight="900">3.92</text>

  <rect x="503" y="224" width="235" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="527" y="254" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">ATTENDANCE RATE</text>
  <text x="527" y="294" fill="#10b981" font-family="sans-serif" font-size="32" font-weight="900">98.4%</text>

  <rect x="762" y="224" width="235" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="786" y="254" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">COMPLETED TASKS</text>
  <text x="786" y="294" fill="#f59e0b" font-family="sans-serif" font-size="32" font-weight="900">24 / 26</text>

  <rect x="1021" y="224" width="235" height="110" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="1045" y="254" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="bold">STUDY STREAK</text>
  <text x="1045" y="294" fill="#ec4899" font-family="sans-serif" font-size="32" font-weight="900">14 Days</text>

  <!-- Split Panels: Upcoming Tasks + AI Assistant Preview -->
  <rect x="244" y="354" width="494" height="340" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="268" y="390" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="16">Priority Coursework</text>
  <rect x="268" y="410" width="446" height="54" rx="10" fill="#1e293b"/>
  <text x="288" y="442" fill="#e2e8f0" font-family="sans-serif" font-size="14" font-weight="bold">Physics Lab 4: Circuit Simulation</text>
  
  <rect x="268" y="474" width="446" height="54" rx="10" fill="#1e293b"/>
  <text x="288" y="506" fill="#e2e8f0" font-family="sans-serif" font-size="14" font-weight="bold">Literature Essay: Modernism Analysis</text>
  
  <rect x="268" y="538" width="446" height="54" rx="10" fill="#1e293b"/>
  <text x="288" y="570" fill="#e2e8f0" font-family="sans-serif" font-size="14" font-weight="bold">Math Problem Set: Integrals &amp; Series</text>

  <!-- Right Panel: AI Teacher & Smart Analytics -->
  <rect x="762" y="354" width="494" height="340" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="786" y="390" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="16">AI Study Companion (Orion)</text>
  <rect x="786" y="410" width="446" height="260" rx="14" fill="#182234" stroke="#334155" stroke-width="1"/>
  <text x="806" y="445" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="14">🤖 Orion AI Recommendation</text>
  <text x="806" y="475" fill="#cbd5e1" font-family="sans-serif" font-size="13">"You've shown 94% accuracy in calculus derivatives. I recommend</text>
  <text x="806" y="495" fill="#cbd5e1" font-family="sans-serif" font-size="13">a 15-minute review on integration by parts before Friday's quiz."</text>
  <rect x="806" y="530" width="160" height="36" rx="8" fill="#4f46e5"/>
  <text x="830" y="553" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="12">Start 15-Min Drill</text>
</svg>
`;

// 4. Performance Analytics Screenshot SVG (1280x720)
const performanceScreenshotSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <rect width="1280" height="720" fill="#090d16"/>
  
  <!-- Header -->
  <rect x="0" y="0" width="1280" height="64" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <rect x="24" y="16" width="32" height="32" rx="8" fill="#4f46e5"/>
  <text x="35" y="38" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="18">S</text>
  <text x="68" y="38" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="18">StudentOS</text>

  <!-- Left Sidebar -->
  <rect x="0" y="64" width="220" height="656" fill="#0b1120" stroke="#1e293b" stroke-width="1"/>
  <text x="32" y="105" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">📊 Dashboard</text>
  <rect x="12" y="120" width="196" height="40" rx="10" fill="#4f46e5"/>
  <text x="32" y="145" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">📈 Performance Analytics</text>
  <text x="32" y="185" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14">📝 Tasks &amp; Planner</text>

  <!-- Performance Main Header -->
  <rect x="244" y="84" width="1012" height="90" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="276" y="125" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="22">Performance Analytics &amp; Gradebook</text>
  <text x="276" y="150" fill="#94a3b8" font-family="sans-serif" font-size="13">Verified academic evaluations, report cards, and competency curves.</text>

  <!-- Sub Tabs in Performance Analytics -->
  <rect x="244" y="190" width="1012" height="48" rx="12" fill="#0b1120" stroke="#1e293b" stroke-width="1"/>
  <rect x="252" y="196" width="160" height="36" rx="8" fill="#4f46e5"/>
  <text x="278" y="219" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="13">Overview &amp; Trends</text>
  <rect x="422" y="196" width="160" height="36" rx="8" fill="transparent"/>
  <text x="450" y="219" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="13">Digital Gradebook</text>
  <rect x="592" y="196" width="160" height="36" rx="8" fill="transparent"/>
  <text x="618" y="219" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="13">Official Report Cards</text>

  <!-- Subject Grade Table -->
  <rect x="244" y="254" width="1012" height="430" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="276" y="295" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="16">Term 1 Evaluated Subject Performance</text>
  
  <!-- Row 1 -->
  <rect x="276" y="320" width="948" height="50" rx="10" fill="#1e293b"/>
  <text x="300" y="352" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">Advanced Mathematics</text>
  <text x="750" y="352" fill="#10b981" font-family="sans-serif" font-weight="bold" font-size="14">94% (Grade A)</text>
  <text x="950" y="352" fill="#38bdf8" font-family="sans-serif" font-size="12">Exemplary standing</text>

  <!-- Row 2 -->
  <rect x="276" y="380" width="948" height="50" rx="10" fill="#1e293b"/>
  <text x="300" y="412" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">Physics &amp; Mechanics</text>
  <text x="750" y="412" fill="#10b981" font-family="sans-serif" font-weight="bold" font-size="14">91% (Grade A)</text>
  <text x="950" y="412" fill="#38bdf8" font-family="sans-serif" font-size="12">Exemplary standing</text>

  <!-- Row 3 -->
  <rect x="276" y="440" width="948" height="50" rx="10" fill="#1e293b"/>
  <text x="300" y="472" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">Computer Science (Algorithms)</text>
  <text x="750" y="472" fill="#10b981" font-family="sans-serif" font-weight="bold" font-size="14">98% (Grade A+)</text>
  <text x="950" y="472" fill="#38bdf8" font-family="sans-serif" font-size="12">Top Percentile</text>

  <!-- Row 4 -->
  <rect x="276" y="500" width="948" height="50" rx="10" fill="#1e293b"/>
  <text x="300" y="532" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="14">English Literature</text>
  <text x="750" y="532" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="14">88% (Grade B+)</text>
  <text x="950" y="532" fill="#94a3b8" font-family="sans-serif" font-size="12">Proficient standing</text>
</svg>
`;

// 5. Mobile Screenshot SVG (750x1334)
const mobileScreenshotSvg = `
<svg width="750" height="1334" viewBox="0 0 750 1334" xmlns="http://www.w3.org/2000/svg">
  <rect width="750" height="1334" fill="#090d16"/>
  
  <!-- Mobile Status Bar & Top Nav -->
  <rect x="0" y="0" width="750" height="100" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <rect x="30" y="30" width="40" height="40" rx="10" fill="#4f46e5"/>
  <text x="44" y="58" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="22">S</text>
  <text x="86" y="58" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="22">StudentOS</text>

  <!-- Mobile Hero Card -->
  <rect x="30" y="130" width="690" height="200" rx="24" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
  <text x="60" y="190" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="30">Hello Alex! 🌟</text>
  <text x="60" y="230" fill="#a5b4fc" font-family="sans-serif" font-size="18">Your daily schedule and grades are ready.</text>
  <rect x="60" y="260" width="180" height="44" rx="22" fill="#4f46e5"/>
  <text x="95" y="288" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="16">View Tasks</text>

  <!-- Stat Grid 2x2 -->
  <rect x="30" y="360" width="330" height="160" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="55" y="405" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="bold">CUMULATIVE GPA</text>
  <text x="55" y="465" fill="#38bdf8" font-family="sans-serif" font-size="44" font-weight="900">3.92</text>

  <rect x="390" y="360" width="330" height="160" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="415" y="405" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="bold">ATTENDANCE</text>
  <text x="415" y="465" fill="#10b981" font-family="sans-serif" font-size="44" font-weight="900">98%</text>

  <!-- Upcoming Schedule -->
  <rect x="30" y="550" width="690" height="420" rx="24" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="60" y="605" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="24">Today's Academic Flow</text>
  
  <rect x="60" y="635" width="630" height="80" rx="16" fill="#1e293b"/>
  <text x="85" y="682" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="18">10:30 AM — Advanced Mathematics</text>
  
  <rect x="60" y="730" width="630" height="80" rx="16" fill="#1e293b"/>
  <text x="85" y="777" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="18">01:15 PM — Physics Laboratory</text>
  
  <rect x="60" y="825" width="630" height="80" rx="16" fill="#1e293b"/>
  <text x="85" y="872" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="18">03:00 PM — Orion AI Study Session</text>

  <!-- Mobile Bottom Nav -->
  <rect x="0" y="1220" width="750" height="114" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>
  <text x="75" y="1285" fill="#38bdf8" font-family="sans-serif" font-weight="bold" font-size="20">📊 Home</text>
  <text x="260" y="1285" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="20">📈 Grades</text>
  <text x="450" y="1285" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="20">🤖 Orion</text>
  <text x="620" y="1285" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="20">👤 Profile</text>
</svg>
`;

async function generateAssets() {
  console.log('Generating PWA Icons & Screenshots...');

  // 1. icon-192.png (192x192 PNG)
  await sharp(Buffer.from(standardIconSvg(192)))
    .resize(192, 192)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-192.png'));
  console.log('✓ Created /icons/icon-192.png (192x192)');

  // 2. icon-512.png (512x512 PNG)
  await sharp(Buffer.from(standardIconSvg(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512.png'));
  console.log('✓ Created /icons/icon-512.png (512x512)');

  // 3. icon-512-maskable.png (512x512 PNG with safe-zone maskable padding)
  await sharp(Buffer.from(maskableIconSvg(512)))
    .resize(512, 512)
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-512-maskable.png'));
  console.log('✓ Created /icons/icon-512-maskable.png (512x512)');

  // 4. apple-touch-icon.png (180x180 PNG in public/)
  await sharp(Buffer.from(standardIconSvg(180)))
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  console.log('✓ Created /apple-touch-icon.png (180x180)');

  // 5. Screenshots
  await sharp(Buffer.from(dashboardScreenshotSvg))
    .resize(1280, 720)
    .png()
    .toFile(path.join(SCREENSHOTS_DIR, 'studentos-dashboard.png'));
  console.log('✓ Created /screenshots/studentos-dashboard.png (1280x720)');

  await sharp(Buffer.from(performanceScreenshotSvg))
    .resize(1280, 720)
    .png()
    .toFile(path.join(SCREENSHOTS_DIR, 'studentos-performance.png'));
  console.log('✓ Created /screenshots/studentos-performance.png (1280x720)');

  await sharp(Buffer.from(mobileScreenshotSvg))
    .resize(750, 1334)
    .png()
    .toFile(path.join(SCREENSHOTS_DIR, 'studentos-mobile.png'));
  console.log('✓ Created /screenshots/studentos-mobile.png (750x1334)');

  console.log('All PWA assets successfully generated!');
}

generateAssets().catch(err => {
  console.error('Error generating PWA assets:', err);
  process.exit(1);
});
